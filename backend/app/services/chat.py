from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.paging import page_items
from app.core.eligibility import (
    account_can_message,
    parse_user_id,
    require_interactable_target,
    require_not_blocked,
    require_not_self,
)
from app.core.errors import AppError, ForbiddenError, NotFoundError
from app.core.moderation import moderate_text_message
from app.core.rate_limit import RATE_LIMIT_POLICIES, RateLimiter
from app.core.realtime import PresenceStore, RealtimeBroker, conversation_channel, encode_event
from app.core.security import decode_token
from app.models.orm import Conversation, ConversationStatus, MatchStatus, Message, MessageType, User
from app.repositories.chat import ChatRepository
from app.repositories.discovery import BlockRepository
from app.repositories.interactions import (
    ConversationWriteRepository,
    LikeRepository,
    MatchRepository,
)
from app.repositories.profiles import ProfileQueryRepository
from app.services.cards import public_card

logger = logging.getLogger(__name__)

FREE_MESSAGE_LIMIT = 3


class ChatService:
    def __init__(
        self,
        session: AsyncSession,
        settings: Settings,
        limiter: RateLimiter,
        request_id: str,
        broker: RealtimeBroker | None = None,
        presence: PresenceStore | None = None,
        notifier=None,
    ) -> None:
        self._session = session
        self._settings = settings
        self._limiter = limiter
        self._request_id = request_id
        self._broker = broker
        self._presence = presence
        self._notifier = notifier
        self._chat = ChatRepository(session)
        self._blocks = BlockRepository(session)
        self._users = ProfileQueryRepository(session)
        self._likes = LikeRepository(session)
        self._matches = MatchRepository(session)
        self._conversations = ConversationWriteRepository(session)

    async def list_conversations(
        self, actor: User, limit: int = 20, cursor: str | None = None
    ) -> dict[str, Any]:
        rows = await self._chat.list_for_user(actor.id, limit=400)
        items = []
        for conversation, peer_id in rows:
            item = await self._conversation_item(actor, conversation, peer_id)
            if item is not None:
                items.append(item)
        return page_items(items, cursor, limit)

    async def start_direct_message(
        self,
        actor: User,
        target_id: str,
        *,
        content: str,
        client_message_id: str,
    ) -> dict[str, Any]:
        other_id = parse_user_id(target_id)
        require_not_self(actor.id, other_id, "message")
        target = require_interactable_target(await self._users.get_user_bundle(other_id))
        require_not_blocked(await self._blocks.is_blocked_either_way(actor.id, other_id))
        await self._matches.lock_pair(actor.id, other_id)
        await self._likes.insert_idempotent(actor.id, other_id)
        match, _ = await self._matches.insert_active_idempotent(actor.id, other_id)
        if match.blocked_at is not None:
            raise ForbiddenError("Messaging is not allowed.")
        if match.status == MatchStatus.UNMATCHED.value:
            match.status = MatchStatus.ACTIVE.value
            match.unmatched_at = None
            match.unmatched_by_id = None
            await self._session.flush()
        conversation = await self._conversations.ensure_for_match(
            match.id, MatchRepository.canonical_pair(actor.id, other_id)
        )
        message = await self.send_message(
            actor,
            conversation.id,
            content=content,
            client_message_id=client_message_id,
            message_type=MessageType.TEXT.value,
        )
        conversation = await self._chat.get_conversation(conversation.id)
        assert conversation is not None
        item = await self._conversation_item(actor, conversation, other_id)
        return {
            "conversation": item,
            "message": message,
        }

    async def unread_summary(self, actor: User) -> dict[str, Any]:
        counts = await self._chat.unread_counts(actor.id)
        conversations = [
            {"conversationId": str(cid), "unreadCount": count}
            for cid, count in counts.items()
            if count > 0
        ]
        return {
            "total": sum(counts.values()),
            "conversations": conversations,
        }

    async def list_messages(
        self, actor: User, conversation_id: UUID, limit: int, cursor: str | None
    ) -> dict[str, Any]:
        await self._require_member(actor, conversation_id, for_write=False)
        before_created, before_id = self._decode_cursor(cursor, actor.id, conversation_id)
        rows = await self._chat.list_messages(
            conversation_id,
            limit=limit + 1,
            before_created=before_created,
            before_id=before_id,
        )
        has_more = len(rows) > limit
        page = rows[:limit]
        items = [self.serialize_message(item, actor.id) for item in reversed(page)]
        next_cursor = None
        if has_more and page:
            oldest = page[-1]
            next_cursor = self._encode_cursor(
                actor.id, conversation_id, oldest.created_at, oldest.id
            )
        return {"items": items, "nextCursor": next_cursor, "hasMore": has_more}

    async def send_message(
        self,
        actor: User,
        conversation_id: UUID,
        *,
        content: str,
        client_message_id: str,
        message_type: str = MessageType.TEXT.value,
    ) -> dict[str, Any]:
        started = datetime.now(UTC)
        await self._hit("messages", actor.id)
        await self._require_member(actor, conversation_id, for_write=True)
        if message_type != MessageType.TEXT.value:
            raise AppError("VALIDATION_ERROR", "Only TEXT messages are supported.", 422)
        text = moderate_text_message(content)
        if not client_message_id or len(client_message_id) < 8:
            raise AppError("VALIDATION_ERROR", "clientMessageId is required.", 422)
        conversation = await self._chat.get_conversation(conversation_id)
        assert conversation is not None
        existing = await self._chat.get_by_client_id(
            conversation_id, actor.id, client_message_id.strip()
        )
        if existing is None:
            await self._enforce_free_limit(actor.id, conversation_id)
        message, created = await self._chat.insert_message(
            conversation_id=conversation_id,
            sender_id=actor.id,
            client_message_id=client_message_id.strip(),
            content=text,
            message_type=MessageType.TEXT.value,
        )
        if created:
            await self._chat.touch_conversation(conversation, message)
        pending: list[UUID] = []
        if created and self._notifier is not None:
            peer_id = await self._chat.get_peer_id(conversation_id, actor.id)
            if peer_id is not None:
                pending = await self._notifier.persist_message(
                    message_id=message.id,
                    recipient_id=peer_id,
                    conversation_id=conversation_id,
                    preview=text,
                )
        await self._session.commit()
        if self._notifier is not None and pending:
            await self._notifier.enqueue(pending)
        payload = self.serialize_message(message, actor.id)
        if created and self._broker is not None:
            event = encode_event(
                "MESSAGE_RECEIVED",
                self.serialize_message(message, None),
            )
            await self._broker.publish(conversation_channel(conversation_id), event)
            ack = encode_event("MESSAGE_SENT", payload)
            await self._broker.publish(conversation_channel(conversation_id), ack)
        duration_ms = int((datetime.now(UTC) - started).total_seconds() * 1000)
        logger.info(
            "message_persist request_id=%s conversation_id=%s created=%s duration_ms=%s",
            self._request_id,
            conversation_id,
            created,
            duration_ms,
        )
        return payload

    async def mark_read(self, actor: User, conversation_id: UUID) -> dict[str, Any]:
        await self._require_member(actor, conversation_id, for_write=False)
        latest = await self._chat.latest_message(conversation_id)
        if latest is None:
            return {"read": True, "unreadCount": 0}
        updated = await self._chat.mark_read_up_to(conversation_id, actor.id, latest)
        await self._session.commit()
        if updated and self._broker is not None:
            event = encode_event(
                "MESSAGE_READ",
                {
                    "conversationId": str(conversation_id),
                    "readerId": str(actor.id),
                    "messageIds": [str(item.id) for item in updated],
                    "lastReadMessageId": str(latest.id),
                },
            )
            await self._broker.publish(conversation_channel(conversation_id), event)
        return {
            "read": True,
            "unreadCount": await self._chat.unread_count(conversation_id, actor.id),
            "lastReadMessageId": str(latest.id),
        }

    async def mark_delivered(self, message_id: UUID, conversation_id: UUID) -> None:
        message = await self._chat.mark_delivered(message_id)
        await self._session.commit()
        if message is None or self._broker is None:
            return
        event = encode_event(
            "MESSAGE_DELIVERED",
            {
                "conversationId": str(conversation_id),
                "messageId": str(message.id),
                "status": message.status,
            },
        )
        await self._broker.publish(conversation_channel(conversation_id), event)

    async def publish_ephemeral(self, actor: User, conversation_id: UUID, event_type: str) -> None:
        await self._require_member(actor, conversation_id, for_write=False)
        if self._broker is None:
            return
        event = encode_event(
            event_type,
            {"conversationId": str(conversation_id), "userId": str(actor.id)},
        )
        await self._broker.publish(conversation_channel(conversation_id), event)

    async def authorize_socket(self, actor: User, conversation_id: UUID) -> UUID:
        await self._require_member(actor, conversation_id, for_write=False)
        peer = await self._chat.get_peer_id(conversation_id, actor.id)
        if peer is None:
            raise ForbiddenError("Not allowed.")
        return peer

    async def assert_can_write(self, actor: User, conversation_id: UUID) -> None:
        await self._require_member(actor, conversation_id, for_write=True)

    def serialize_message(self, message: Message, viewer_id: UUID | None) -> dict[str, Any]:
        status = str(message.status or "SENT").lower()
        return {
            "id": str(message.id),
            "conversationId": str(message.conversation_id),
            "senderId": str(message.sender_id),
            "clientMessageId": message.client_message_id,
            "clientId": message.client_message_id,
            "messageType": message.message_type,
            "content": message.content,
            "text": message.content,
            "body": message.content,
            "status": status if status in {"sent", "delivered", "read"} else "sent",
            "createdAt": message.created_at.isoformat() if message.created_at else None,
            "time": message.created_at.isoformat() if message.created_at else "",
            "deliveredAt": message.delivered_at.isoformat() if message.delivered_at else None,
            "readAt": message.read_at.isoformat() if message.read_at else None,
            "isMe": viewer_id is not None and message.sender_id == viewer_id,
        }

    async def _conversation_item(
        self, actor: User, conversation: Conversation, peer_id: UUID
    ) -> dict[str, Any] | None:
        peer = await self._users.get_user_bundle(peer_id)
        if peer is None:
            return None
        unread = await self._chat.unread_count(conversation.id, actor.id)
        online = await self._is_online(peer_id)
        last_obj = None
        if conversation.last_message_id is not None:
            last_obj = await self._session.get(Message, conversation.last_message_id)
        preview = (last_obj.content if last_obj else conversation.last_message_preview) or ""
        stamp = (
            (last_obj.created_at if last_obj else None)
            or conversation.last_message_at
            or conversation.updated_at
        )
        liked_peer = await self._likes.get(actor.id, peer_id)
        return {
            "id": str(conversation.id),
            "conversationId": str(conversation.id),
            "matchId": str(conversation.match_id),
            "status": conversation.status,
            "lastMessage": preview,
            "lastMessageId": str(conversation.last_message_id)
            if conversation.last_message_id
            else None,
            "lastSenderId": str(last_obj.sender_id) if last_obj is not None else None,
            "time": stamp.isoformat() if stamp else "",
            "unreadCount": unread,
            "isOnline": online,
            "isRequest": liked_peer is None,
            "user": public_card(peer, is_online=online),
        }

    async def _enforce_free_limit(self, actor_id: UUID, conversation_id: UUID) -> None:
        peer_id = await self._chat.get_peer_id(conversation_id, actor_id)
        if peer_id is None:
            return
        reverse = await self._likes.get(peer_id, actor_id)
        if reverse is not None:
            return
        sent = await self._chat.count_from_sender(conversation_id, actor_id)
        if sent >= FREE_MESSAGE_LIMIT:
            raise AppError(
                "CHAT_LIMIT",
                "You've used your free messages. Wait for them to like you back.",
                429,
            )

    async def _require_member(self, actor: User, conversation_id: UUID, *, for_write: bool) -> None:
        if not account_can_message(actor):
            raise ForbiddenError("Messaging is not available.")
        conversation = await self._chat.get_conversation(conversation_id)
        if conversation is None:
            raise NotFoundError("Conversation not found.")
        member = await self._chat.get_member(conversation_id, actor.id)
        if member is None:
            raise ForbiddenError("Not allowed.")
        match = await self._chat.get_match_for_conversation(conversation_id)
        if match is None:
            raise ForbiddenError("Not allowed.")
        peer_id = await self._chat.get_peer_id(conversation_id, actor.id)
        if peer_id is None:
            raise ForbiddenError("Not allowed.")
        if await self._blocks.is_blocked_either_way(actor.id, peer_id):
            if for_write:
                raise ForbiddenError("Messaging is not allowed.")
            return
        peer = await self._users.get_user_bundle(peer_id)
        if for_write:
            if conversation.status != ConversationStatus.ACTIVE.value:
                raise ForbiddenError("This conversation is closed.")
            if match.status != MatchStatus.ACTIVE.value or match.blocked_at is not None:
                raise ForbiddenError("Messaging is not allowed.")
            if not account_can_message(peer):
                raise ForbiddenError("Messaging is not allowed.")

    async def _is_online(self, user_id: UUID) -> bool:
        if self._presence is None:
            return False
        return await self._presence.is_online(user_id)

    async def _hit(self, policy: str, user_id: UUID) -> None:
        limit, window = RATE_LIMIT_POLICIES[policy]
        await self._limiter.hit(f"{policy}:{user_id}", limit, window)

    def _encode_cursor(
        self, viewer_id: UUID, conversation_id: UUID, created_at: datetime, message_id: UUID
    ) -> str:
        expires = datetime.now(UTC) + timedelta(seconds=self._settings.discovery_cursor_ttl_seconds)
        return jwt.encode(
            {
                "typ": "messages",
                "sub": str(viewer_id),
                "c": str(conversation_id),
                "t": created_at.isoformat(),
                "i": str(message_id),
                "exp": int(expires.timestamp()),
            },
            self._settings.jwt_secret,
            algorithm=self._settings.jwt_algorithm,
        )

    def _decode_cursor(
        self, cursor: str | None, viewer_id: UUID, conversation_id: UUID
    ) -> tuple[datetime | None, UUID | None]:
        if not cursor:
            return None, None
        try:
            payload = decode_token(self._settings, cursor)
        except ExpiredSignatureError as exc:
            raise AppError("VALIDATION_ERROR", "Cursor expired.", 400) from exc
        except InvalidTokenError as exc:
            raise AppError("VALIDATION_ERROR", "Invalid cursor.", 400) from exc
        if (
            payload.get("typ") != "messages"
            or payload.get("sub") != str(viewer_id)
            or payload.get("c") != str(conversation_id)
        ):
            raise ForbiddenError("Invalid cursor.")
        try:
            return datetime.fromisoformat(str(payload["t"])), UUID(str(payload["i"]))
        except (KeyError, ValueError) as exc:
            raise AppError("VALIDATION_ERROR", "Invalid cursor.", 400) from exc
