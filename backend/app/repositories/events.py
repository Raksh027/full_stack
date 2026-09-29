from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Select, String, and_, cast, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.orm import EventRsvp, EventRsvpStatus, Profile, SocialEvent, User, UserStatus


class EventRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def _with_host(self, stmt: Select) -> Select:
        return stmt.options(selectinload(SocialEvent.host).selectinload(User.profile))

    async def get(self, event_id: UUID) -> SocialEvent | None:
        result = await self._session.execute(
            self._with_host(select(SocialEvent).where(SocialEvent.id == event_id))
        )
        return result.scalar_one_or_none()

    async def get_for_update(self, event_id: UUID) -> SocialEvent | None:
        result = await self._session.execute(
            select(SocialEvent).where(SocialEvent.id == event_id).with_for_update()
        )
        return result.scalar_one_or_none()

    async def list_upcoming(
        self,
        *,
        now: datetime,
        limit: int,
        after_starts_at: datetime | None,
        after_id: UUID | None,
    ) -> list[SocialEvent]:
        stmt = (
            self._with_host(select(SocialEvent))
            .where(
                SocialEvent.status == "PUBLISHED",
                SocialEvent.ends_at >= now,
            )
            .order_by(SocialEvent.starts_at.asc(), SocialEvent.id.asc())
            .limit(limit)
        )
        if after_starts_at is not None and after_id is not None:
            stmt = stmt.where(
                or_(
                    SocialEvent.starts_at > after_starts_at,
                    and_(SocialEvent.starts_at == after_starts_at, SocialEvent.id > after_id),
                )
            )
        result = await self._session.execute(stmt)
        return list(result.scalars())

    async def create(self, event: SocialEvent) -> SocialEvent:
        self._session.add(event)
        await self._session.flush()
        return await self.get(event.id) or event

    async def count_going(self, event_id: UUID) -> int:
        result = await self._session.execute(
            select(func.count())
            .select_from(EventRsvp)
            .where(
                EventRsvp.event_id == event_id,
                EventRsvp.status == EventRsvpStatus.GOING.value,
            )
        )
        return int(result.scalar_one())

    async def counts_going(self, event_ids: list[UUID]) -> dict[UUID, int]:
        if not event_ids:
            return {}
        result = await self._session.execute(
            select(EventRsvp.event_id, func.count())
            .where(
                EventRsvp.event_id.in_(event_ids),
                EventRsvp.status == EventRsvpStatus.GOING.value,
            )
            .group_by(EventRsvp.event_id)
        )
        counts = {event_id: 0 for event_id in event_ids}
        for event_id, total in result.all():
            counts[event_id] = int(total)
        return counts

    async def get_rsvp(self, event_id: UUID, user_id: UUID) -> EventRsvp | None:
        result = await self._session.execute(
            select(EventRsvp).where(EventRsvp.event_id == event_id, EventRsvp.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def rsvps_for_user(
        self, user_id: UUID, event_ids: list[UUID]
    ) -> dict[UUID, EventRsvp]:
        if not event_ids:
            return {}
        result = await self._session.execute(
            select(EventRsvp).where(
                EventRsvp.user_id == user_id,
                EventRsvp.event_id.in_(event_ids),
            )
        )
        return {row.event_id: row for row in result.scalars()}

    async def list_going_recipient_ids(
        self, event_id: UUID, *, exclude_user_id: UUID
    ) -> list[UUID]:
        result = await self._session.execute(
            select(EventRsvp.user_id)
            .join(User, User.id == EventRsvp.user_id)
            .where(
                EventRsvp.event_id == event_id,
                EventRsvp.status == EventRsvpStatus.GOING.value,
                EventRsvp.user_id != exclude_user_id,
                User.deleted_at.is_(None),
                User.status == UserStatus.ACTIVE.value,
            )
        )
        return [row[0] for row in result.all()]

    async def upsert_going(self, event_id: UUID, user_id: UUID) -> EventRsvp:
        existing = await self.get_rsvp(event_id, user_id)
        if existing is not None:
            existing.status = EventRsvpStatus.GOING.value
            await self._session.flush()
            return existing
        stmt = (
            pg_insert(EventRsvp)
            .values(
                id=uuid4(),
                event_id=event_id,
                user_id=user_id,
                status=EventRsvpStatus.GOING.value,
            )
            .on_conflict_do_update(
                constraint="uq_event_rsvps_event_user",
                set_={"status": EventRsvpStatus.GOING.value},
            )
            .returning(EventRsvp.id)
        )
        await self._session.execute(stmt)
        await self._session.flush()
        row = await self.get_rsvp(event_id, user_id)
        assert row is not None
        await self._session.refresh(row)
        return row

    async def admin_list(
        self,
        *,
        query: str | None,
        status: str | None,
        limit: int,
        offset: int,
    ) -> tuple[list[SocialEvent], int]:
        stmt = self._with_host(select(SocialEvent))
        if status:
            stmt = stmt.where(SocialEvent.status == status)
        if query:
            term = f"%{query.strip()}%"
            stmt = stmt.outerjoin(SocialEvent.host).outerjoin(User.profile)
            stmt = stmt.where(
                or_(
                    SocialEvent.title.ilike(term),
                    Profile.display_name.ilike(term),
                    cast(SocialEvent.id, String).ilike(term),
                    cast(SocialEvent.host_user_id, String).ilike(term),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.distinct().subquery())
        total = await self._session.scalar(count_stmt)
        result = await self._session.execute(
            stmt.distinct()
            .order_by(SocialEvent.created_at.desc(), SocialEvent.id.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars()), int(total or 0)
