from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import and_, or_, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import Conversation, ConversationMember, Favorite, Like, Match, MatchStatus


class LikeRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, actor_id: UUID, target_id: UUID) -> Like | None:
        result = await self._session.execute(
            select(Like).where(Like.actor_id == actor_id, Like.target_id == target_id)
        )
        return result.scalar_one_or_none()

    async def insert_idempotent(self, actor_id: UUID, target_id: UUID) -> tuple[Like, bool]:
        existing = await self.get(actor_id, target_id)
        if existing is not None:
            return existing, False
        stmt = (
            pg_insert(Like)
            .values(id=uuid4(), actor_id=actor_id, target_id=target_id)
            .on_conflict_do_nothing(constraint="uq_likes_actor_target")
            .returning(Like.id)
        )
        result = await self._session.execute(stmt)
        inserted_id = result.scalar_one_or_none()
        await self._session.flush()
        row = await self.get(actor_id, target_id)
        assert row is not None
        return row, inserted_id is not None

    async def delete(self, actor_id: UUID, target_id: UUID) -> bool:
        row = await self.get(actor_id, target_id)
        if row is None:
            return False
        await self._session.delete(row)
        await self._session.flush()
        return True

    async def list_outgoing(
        self, actor_id: UUID, limit: int, after: datetime | None, after_id: UUID | None
    ):
        conditions = [Like.actor_id == actor_id]
        if after is not None and after_id is not None:
            conditions.append(
                or_(Like.created_at < after, and_(Like.created_at == after, Like.id < after_id))
            )
        result = await self._session.execute(
            select(Like)
            .where(*conditions)
            .order_by(Like.created_at.desc(), Like.id.desc())
            .limit(limit)
        )
        return list(result.scalars())

    async def list_incoming(
        self, target_id: UUID, limit: int, after: datetime | None, after_id: UUID | None
    ):
        conditions = [Like.target_id == target_id]
        if after is not None and after_id is not None:
            conditions.append(
                or_(Like.created_at < after, and_(Like.created_at == after, Like.id < after_id))
            )
        result = await self._session.execute(
            select(Like)
            .where(*conditions)
            .order_by(Like.created_at.desc(), Like.id.desc())
            .limit(limit)
        )
        return list(result.scalars())


class FavoriteRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, user_id: UUID, target_user_id: UUID) -> Favorite | None:
        result = await self._session.execute(
            select(Favorite).where(
                Favorite.user_id == user_id,
                Favorite.target_user_id == target_user_id,
            )
        )
        return result.scalar_one_or_none()

    async def insert_idempotent(self, user_id: UUID, target_user_id: UUID) -> tuple[Favorite, bool]:
        existing = await self.get(user_id, target_user_id)
        if existing is not None:
            return existing, False
        stmt = (
            pg_insert(Favorite)
            .values(id=uuid4(), user_id=user_id, target_user_id=target_user_id)
            .on_conflict_do_nothing(constraint="uq_favorites_user_target")
            .returning(Favorite.id)
        )
        result = await self._session.execute(stmt)
        inserted_id = result.scalar_one_or_none()
        await self._session.flush()
        row = await self.get(user_id, target_user_id)
        assert row is not None
        return row, inserted_id is not None

    async def delete(self, user_id: UUID, target_user_id: UUID) -> bool:
        row = await self.get(user_id, target_user_id)
        if row is None:
            return False
        await self._session.delete(row)
        await self._session.flush()
        return True

    async def list_for_user(
        self, user_id: UUID, limit: int, after: datetime | None, after_id: UUID | None
    ) -> list[Favorite]:
        conditions = [Favorite.user_id == user_id]
        if after is not None and after_id is not None:
            conditions.append(
                or_(
                    Favorite.created_at < after,
                    and_(Favorite.created_at == after, Favorite.id < after_id),
                )
            )
        result = await self._session.execute(
            select(Favorite)
            .where(*conditions)
            .order_by(Favorite.created_at.desc(), Favorite.id.desc())
            .limit(limit)
        )
        return list(result.scalars())


class MatchRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    @staticmethod
    def canonical_pair(left: UUID, right: UUID) -> tuple[UUID, UUID]:
        return (left, right) if left < right else (right, left)

    async def lock_pair(self, left: UUID, right: UUID) -> None:
        user_a, user_b = self.canonical_pair(left, right)
        await self._session.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:a), hashtext(:b))"),
            {"a": str(user_a), "b": str(user_b)},
        )

    async def get_pair(self, left: UUID, right: UUID) -> Match | None:
        user_a, user_b = self.canonical_pair(left, right)
        result = await self._session.execute(
            select(Match).where(Match.user_a_id == user_a, Match.user_b_id == user_b)
        )
        return result.scalar_one_or_none()

    async def get(self, match_id: UUID) -> Match | None:
        return await self._session.get(Match, match_id)

    async def insert_active_idempotent(self, left: UUID, right: UUID) -> tuple[Match, bool]:
        user_a, user_b = self.canonical_pair(left, right)
        existing = await self.get_pair(left, right)
        if existing is not None:
            return existing, False
        stmt = (
            pg_insert(Match)
            .values(
                id=uuid4(),
                user_a_id=user_a,
                user_b_id=user_b,
                status=MatchStatus.ACTIVE.value,
            )
            .on_conflict_do_nothing(constraint="uq_matches_pair")
            .returning(Match.id)
        )
        result = await self._session.execute(stmt)
        inserted_id = result.scalar_one_or_none()
        await self._session.flush()
        row = await self.get_pair(left, right)
        assert row is not None
        return row, inserted_id is not None

    async def list_for_user(
        self,
        user_id: UUID,
        *,
        status: str | None,
        limit: int,
        after: datetime | None,
        after_id: UUID | None,
    ) -> list[Match]:
        conditions = [or_(Match.user_a_id == user_id, Match.user_b_id == user_id)]
        if status:
            conditions.append(Match.status == status)
        if after is not None and after_id is not None:
            conditions.append(
                or_(
                    Match.created_at < after,
                    and_(Match.created_at == after, Match.id < after_id),
                )
            )
        result = await self._session.execute(
            select(Match)
            .where(*conditions)
            .order_by(Match.created_at.desc(), Match.id.desc())
            .limit(limit)
        )
        return list(result.scalars())

    async def unmatch(self, match: Match, actor_id: UUID, *, blocked: bool = False) -> Match:
        now = datetime.now(UTC)
        match.status = MatchStatus.UNMATCHED.value
        match.unmatched_at = now
        match.unmatched_by_id = actor_id
        if blocked:
            match.blocked_at = now
        match.updated_at = now
        await self._session.flush()
        return match

    async def apply_block(self, blocker_id: UUID, blocked_id: UUID) -> Match | None:
        match = await self.get_pair(blocker_id, blocked_id)
        if match is None:
            return None
        if match.status == MatchStatus.ACTIVE.value or match.blocked_at is None:
            await self.unmatch(match, blocker_id, blocked=True)
        elif match.blocked_at is None:
            match.blocked_at = datetime.now(UTC)
            await self._session.flush()
        return match


class ConversationWriteRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_match(self, match_id: UUID) -> Conversation | None:
        result = await self._session.execute(
            select(Conversation).where(Conversation.match_id == match_id)
        )
        return result.scalar_one_or_none()

    async def ensure_for_match(self, match_id: UUID, user_ids: tuple[UUID, UUID]) -> Conversation:
        existing = await self.get_by_match(match_id)
        if existing is not None:
            await self._ensure_members(existing.id, user_ids)
            return existing
        stmt = (
            pg_insert(Conversation)
            .values(id=uuid4(), match_id=match_id)
            .on_conflict_do_nothing(constraint="uq_conversations_match_id")
            .returning(Conversation.id)
        )
        await self._session.execute(stmt)
        await self._session.flush()
        conversation = await self.get_by_match(match_id)
        assert conversation is not None
        await self._ensure_members(conversation.id, user_ids)
        return conversation

    async def _ensure_members(self, conversation_id: UUID, user_ids: tuple[UUID, UUID]) -> None:
        for user_id in user_ids:
            stmt = (
                pg_insert(ConversationMember)
                .values(id=uuid4(), conversation_id=conversation_id, user_id=user_id)
                .on_conflict_do_nothing(constraint="uq_conversation_members_pair")
            )
            await self._session.execute(stmt)
        await self._session.flush()
