from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.eligibility import (
    parse_user_id,
    require_interactable_target,
    require_not_blocked,
    require_not_self,
)
from app.core.entitlements import EntitlementService
from app.core.errors import AppError, ForbiddenError, NotFoundError
from app.core.rate_limit import RATE_LIMIT_POLICIES, RateLimiter
from app.core.security import decode_token
from app.models.orm import EntitlementCode, Match, MatchStatus, User
from app.repositories.chat import ChatRepository
from app.repositories.discovery import BlockRepository
from app.repositories.interactions import (
    ConversationWriteRepository,
    FavoriteRepository,
    LikeRepository,
    MatchRepository,
)
from app.repositories.profiles import ProfileQueryRepository
from app.services.cards import public_card
from app.services.notifications import NotificationService

logger = logging.getLogger(__name__)


class InteractionService:
    def __init__(
        self,
        session: AsyncSession,
        settings: Settings,
        limiter: RateLimiter,
        request_id: str,
        notifier: NotificationService | None = None,
    ) -> None:
        self._session = session
        self._settings = settings
        self._limiter = limiter
        self._request_id = request_id
        self._likes = LikeRepository(session)
        self._favorites = FavoriteRepository(session)
        self._matches = MatchRepository(session)
        self._conversations = ConversationWriteRepository(session)
        self._chat = ChatRepository(session)
        self._blocks = BlockRepository(session)
        self._users = ProfileQueryRepository(session)
        self._notifier = notifier
        self._entitlements = EntitlementService(session)

    async def like(
        self, actor: User, target_id: str, *, superlike: bool = False
    ) -> dict[str, Any]:
        await self._hit("likes", actor.id)
        other_id = parse_user_id(target_id)
        require_not_self(actor.id, other_id, "like")
        target = require_interactable_target(await self._users.get_user_bundle(other_id))
        require_not_blocked(await self._blocks.is_blocked_either_way(actor.id, other_id))
        await self._matches.lock_pair(actor.id, other_id)
        like, created = await self._likes.insert_idempotent(actor.id, other_id)
        if superlike:
            like.is_superlike = True
        reverse = await self._likes.get(other_id, actor.id)
        match_payload = None
        matched = False
        match_id = None
        if reverse is not None:
            match, _ = await self._matches.insert_active_idempotent(actor.id, other_id)
            if match.status == MatchStatus.UNMATCHED.value and match.blocked_at is None:
                match.status = MatchStatus.ACTIVE.value
                match.unmatched_at = None
                match.unmatched_by_id = None
                await self._session.flush()
            if match.blocked_at is None and match.status == MatchStatus.ACTIVE.value:
                conversation = await self._conversations.ensure_for_match(
                    match.id, MatchRepository.canonical_pair(actor.id, other_id)
                )
                matched = True
                match_id = match.id
                match_payload = {
                    "id": str(match.id),
                    "conversationId": str(conversation.id),
                }
        pending: list = []
        if created and self._notifier is not None:
            pending.extend(
                await self._notifier.persist_like(
                    like_id=like.id,
                    actor_id=actor.id,
                    target_id=other_id,
                    is_offer=superlike,
                )
            )
        if matched and self._notifier is not None and match_id is not None:
            conversation_id = UUID(match_payload["conversationId"]) if match_payload else None
            pending.extend(
                await self._notifier.persist_match(
                    match_id=match_id,
                    user_a_id=actor.id,
                    user_b_id=other_id,
                    conversation_id=conversation_id,
                )
            )
        await self._session.commit()
        if self._notifier is not None and pending:
            await self._notifier.enqueue(pending)
        logger.info(
            "like_upsert request_id=%s actor=%s matched=%s",
            self._request_id,
            actor.id,
            matched,
        )
        return {
            "liked": True,
            "matched": matched,
            "likeId": str(like.id),
            "matchId": match_payload["id"] if match_payload else None,
            "conversationId": match_payload["conversationId"] if match_payload else None,
            "user": public_card(target),
        }

    async def unlike(self, actor: User, target_id: str) -> dict[str, Any]:
        other_id = parse_user_id(target_id, field="user_id")
        await self._likes.delete(actor.id, other_id)
        await self._session.commit()
        return {"liked": False}

    async def list_outgoing(self, actor: User, limit: int, cursor: str | None) -> dict[str, Any]:
        after, after_id = self._decode_cursor(cursor, actor.id, "likes_out")
        rows = await self._likes.list_outgoing(actor.id, limit + 1, after, after_id)
        return await self._page_users(actor.id, rows, limit, "likes_out", lambda row: row.target_id)

    async def list_incoming(
        self, actor: User, limit: int, cursor: str | None, gate: bool = True
    ) -> dict[str, Any]:
        after, after_id = self._decode_cursor(cursor, actor.id, "likes_in")
        rows = await self._likes.list_incoming(actor.id, limit + 1, after, after_id)
        filtered = []
        for row in rows:
            if await self._likes.get(actor.id, row.actor_id) is not None:
                continue
            match = await self._matches.get_pair(actor.id, row.actor_id)
            if match is not None and match.status == MatchStatus.ACTIVE.value:
                continue
            filtered.append(row)
        if gate and not await self._entitlements.has(actor.id, EntitlementCode.SEE_LIKES.value):
            return {
                "items": [],
                "total": len(filtered),
                "gated": True,
                "requiredEntitlement": EntitlementCode.SEE_LIKES.value,
                "nextCursor": None,
            }
        return await self._page_users(
            actor.id, filtered[: limit + 1], limit, "likes_in", lambda row: row.actor_id
        )

    async def favorite(self, actor: User, target_id: str) -> dict[str, Any]:
        await self._hit("likes", actor.id)
        other_id = parse_user_id(target_id)
        require_not_self(actor.id, other_id, "favorite")
        target = require_interactable_target(await self._users.get_user_bundle(other_id))
        require_not_blocked(await self._blocks.is_blocked_either_way(actor.id, other_id))
        favorite, _ = await self._favorites.insert_idempotent(actor.id, other_id)
        await self._session.commit()
        return {"favorited": True, "id": str(favorite.id), "user": public_card(target)}

    async def unfavorite(self, actor: User, target_id: str) -> dict[str, Any]:
        other_id = parse_user_id(target_id, field="user_id")
        await self._favorites.delete(actor.id, other_id)
        await self._session.commit()
        return {"favorited": False}

    async def list_favorites(self, actor: User, limit: int, cursor: str | None) -> dict[str, Any]:
        after, after_id = self._decode_cursor(cursor, actor.id, "favorites")
        rows = await self._favorites.list_for_user(actor.id, limit + 1, after, after_id)
        return await self._page_users(
            actor.id, rows, limit, "favorites", lambda row: row.target_user_id
        )

    async def list_matches(self, actor: User, limit: int, cursor: str | None) -> dict[str, Any]:
        after, after_id = self._decode_cursor(cursor, actor.id, "matches")
        rows = await self._matches.list_for_user(
            actor.id,
            status=MatchStatus.ACTIVE.value,
            limit=limit + 1,
            after=after,
            after_id=after_id,
        )
        has_more = len(rows) > limit
        page = rows[:limit]
        items = []
        for match in page:
            other_id = match.user_b_id if match.user_a_id == actor.id else match.user_a_id
            other = await self._users.get_user_bundle(other_id)
            if other is None:
                continue
            conversation = await self._conversations.get_by_match(match.id)
            created = match.created_at.isoformat() if match.created_at else None
            items.append(
                {
                    "id": str(match.id),
                    "status": match.status,
                    "createdAt": created,
                    "matchedAt": created,
                    "isNew": True,
                    "conversationId": str(conversation.id) if conversation else None,
                    "user": public_card(other),
                }
            )
        next_cursor = None
        if has_more and page:
            last = page[-1]
            next_cursor = self._encode_cursor(actor.id, "matches", last.created_at, last.id)
        return {"items": items, "nextCursor": next_cursor, "hasMore": has_more}

    async def get_match(self, actor: User, match_id: UUID) -> dict[str, Any]:
        match = await self._require_participant(actor.id, match_id)
        other_id = match.user_b_id if match.user_a_id == actor.id else match.user_a_id
        other = await self._users.get_user_bundle(other_id)
        if other is None:
            raise NotFoundError("Match not found.")
        conversation = await self._conversations.get_by_match(match.id)
        return {
            "id": str(match.id),
            "status": match.status,
            "createdAt": match.created_at.isoformat() if match.created_at else None,
            "unmatchedAt": match.unmatched_at.isoformat() if match.unmatched_at else None,
            "conversationId": str(conversation.id) if conversation else None,
            "user": public_card(other),
        }

    async def unmatch(self, actor: User, match_id: UUID) -> dict[str, Any]:
        match = await self._require_participant(actor.id, match_id)
        await self._matches.unmatch(match, actor.id, blocked=False)
        await self._chat.close_for_match(match.id)
        await self._session.commit()
        logger.info("unmatch request_id=%s match_id=%s", self._request_id, match.id)
        return {"unmatched": True, "status": MatchStatus.UNMATCHED.value}

    async def apply_block(self, blocker_id: UUID, blocked_id: UUID) -> None:
        match = await self._matches.apply_block(blocker_id, blocked_id)
        if match is not None:
            await self._chat.close_for_match(match.id)

    async def _require_participant(self, actor_id: UUID, match_id: UUID) -> Match:
        match = await self._matches.get(match_id)
        if match is None:
            raise NotFoundError("Match not found.")
        if actor_id not in {match.user_a_id, match.user_b_id}:
            raise ForbiddenError("Not allowed.")
        return match

    async def _page_users(
        self, viewer_id: UUID, rows, limit: int, typ: str, target_fn
    ) -> dict[str, Any]:
        has_more = len(rows) > limit
        page = rows[:limit]
        items = []
        for row in page:
            other = await self._users.get_user_bundle(target_fn(row))
            if other is None:
                continue
            items.append(
                {
                    "id": str(row.id),
                    "createdAt": row.created_at.isoformat() if row.created_at else None,
                    "user": public_card(other),
                }
            )
        next_cursor = None
        if has_more and page:
            last = page[-1]
            next_cursor = self._encode_cursor(viewer_id, typ, last.created_at, last.id)
        return {"items": items, "nextCursor": next_cursor, "hasMore": has_more}

    async def _hit(self, policy: str, user_id: UUID) -> None:
        limit, window = RATE_LIMIT_POLICIES[policy]
        await self._limiter.hit(f"{policy}:{user_id}", limit, window)

    def _encode_cursor(self, viewer_id: UUID, typ: str, created_at: datetime, row_id: UUID) -> str:
        expires = datetime.now(UTC) + timedelta(seconds=self._settings.discovery_cursor_ttl_seconds)
        return jwt.encode(
            {
                "typ": typ,
                "sub": str(viewer_id),
                "t": created_at.isoformat(),
                "i": str(row_id),
                "exp": int(expires.timestamp()),
            },
            self._settings.jwt_secret,
            algorithm=self._settings.jwt_algorithm,
        )

    def _decode_cursor(
        self, cursor: str | None, viewer_id: UUID, typ: str
    ) -> tuple[datetime | None, UUID | None]:
        if not cursor:
            return None, None
        try:
            payload = decode_token(self._settings, cursor)
        except ExpiredSignatureError as exc:
            raise AppError("VALIDATION_ERROR", "Cursor expired.", 400) from exc
        except InvalidTokenError as exc:
            raise AppError("VALIDATION_ERROR", "Invalid cursor.", 400) from exc
        if payload.get("typ") != typ or payload.get("sub") != str(viewer_id):
            raise ForbiddenError("Invalid cursor.")
        try:
            return datetime.fromisoformat(str(payload["t"])), UUID(str(payload["i"]))
        except (KeyError, ValueError) as exc:
            raise AppError("VALIDATION_ERROR", "Invalid cursor.", 400) from exc
