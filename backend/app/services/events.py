from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.eligibility import account_is_active
from app.core.errors import AppError, ConflictError, ForbiddenError, NotFoundError
from app.core.event_rules import (
    event_update_summary,
    is_owned_event_cover_key,
    meaningful_event_changes,
)
from app.core.rate_limit import RATE_LIMIT_POLICIES, RateLimiter
from app.core.security import decode_token
from app.core.verification_rules import is_verification_storage_key
from app.models.orm import (
    EventRsvpStatus,
    EventStatus,
    SocialEvent,
    User,
    utcnow,
)
from app.repositories.events import EventRepository
from app.schemas.events import EventCreateRequest, EventUpdateRequest
from app.schemas.profile import UploadUrlRequest
from app.services.interfaces import EventService
from app.services.notifications import NotificationService
from app.services.storage import LocalStorageProvider, sniff_image_type

logger = logging.getLogger(__name__)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


class SocialEventService(EventService):
    def __init__(
        self,
        session: AsyncSession,
        settings: Settings,
        limiter: RateLimiter,
        request_id: str,
        storage: LocalStorageProvider,
        public_base: str,
        notifications: NotificationService | None = None,
    ) -> None:
        self._session = session
        self._settings = settings
        self._limiter = limiter
        self._request_id = request_id
        self._events = EventRepository(session)
        self._storage = storage
        self._public_base = public_base
        self._notifications = notifications

    async def list_events(self, actor: User, limit: int, cursor: str | None) -> dict[str, Any]:
        await self._hit("events_list", actor.id)
        after_starts, after_id = self._decode_cursor(cursor, actor.id)
        rows = await self._events.list_upcoming(
            now=utcnow(),
            limit=limit + 1,
            after_starts_at=after_starts,
            after_id=after_id,
        )
        has_more = len(rows) > limit
        page = rows[:limit]
        counts = await self._events.counts_going([row.id for row in page])
        rsvps = await self._events.rsvps_for_user(actor.id, [row.id for row in page])
        next_cursor = None
        if has_more and page:
            last = page[-1]
            next_cursor = self._encode_cursor(actor.id, last.starts_at, last.id)
        return {
            "items": [
                self._serialize(row, actor, counts.get(row.id, 0), rsvps.get(row.id))
                for row in page
            ],
            "nextCursor": next_cursor,
            "hasMore": has_more,
        }

    async def get_event(self, actor: User, event_id: UUID) -> dict[str, Any]:
        await self._hit("events_list", actor.id)
        row = await self._events.get(event_id)
        if row is None or row.status == EventStatus.HIDDEN.value:
            raise NotFoundError("Event not found.")
        count = await self._events.count_going(row.id)
        rsvp = await self._events.get_rsvp(row.id, actor.id)
        return self._serialize(row, actor, count, rsvp)

    async def create_event(self, actor: User, payload: EventCreateRequest) -> dict[str, Any]:
        self._require_active(actor)
        await self._hit("events_mutate", actor.id)
        event = SocialEvent(
            host_user_id=actor.id,
            title=payload.title,
            description=payload.description,
            location=payload.location,
            latitude=payload.latitude,
            longitude=payload.longitude,
            starts_at=_as_utc(payload.starts_at),
            ends_at=_as_utc(payload.ends_at),
            capacity=payload.capacity,
            price=payload.price,
            status=EventStatus.PUBLISHED.value,
        )
        row = await self._events.create(event)
        await self._session.commit()
        logger.info("event_created request_id=%s event_id=%s", self._request_id, row.id)
        return self._serialize(row, actor, 0, None)

    async def update_event(
        self, actor: User, event_id: UUID, payload: EventUpdateRequest
    ) -> dict[str, Any]:
        self._require_active(actor)
        await self._hit("events_mutate", actor.id)
        row = await self._events.get(event_id)
        if row is None:
            raise NotFoundError("Event not found.")
        if row.host_user_id != actor.id:
            raise ForbiddenError("Only the host can update this event.")
        self._require_host_can_mutate(row)
        before = self._visible_fields(row)
        data = payload.model_dump(exclude_unset=True)
        starts = _as_utc(data["starts_at"]) if "starts_at" in data and data["starts_at"] else None
        ends = _as_utc(data["ends_at"]) if "ends_at" in data and data["ends_at"] else None
        next_starts = starts or row.starts_at
        next_ends = ends or row.ends_at
        if next_ends < next_starts:
            raise AppError("VALIDATION_ERROR", "endsAt must be greater than or equal to startsAt.", 422)
        if "title" in data:
            row.title = data["title"]
        if "description" in data:
            row.description = data["description"]
        if "location" in data:
            row.location = data["location"]
        if "latitude" in data:
            row.latitude = data["latitude"]
        if "longitude" in data:
            row.longitude = data["longitude"]
        if starts is not None:
            row.starts_at = starts
        if ends is not None:
            row.ends_at = ends
        if "capacity" in data:
            going = await self._events.count_going(row.id)
            if data["capacity"] is not None and going > data["capacity"]:
                raise ConflictError(
                    "EVENT_CAPACITY",
                    "Capacity cannot be lower than the current attendee count.",
                )
            row.capacity = data["capacity"]
        if "price" in data and data["price"] is not None:
            row.price = data["price"]
        changed = meaningful_event_changes(before, self._visible_fields(row))
        summary = event_update_summary(changed)
        pending_ids: list[UUID] = []
        if summary is not None and self._notifications is not None:
            recipients = await self._events.list_going_recipient_ids(
                row.id, exclude_user_id=actor.id
            )
            pending_ids = await self._notifications.persist_event_update(
                event_id=row.id,
                host_user_id=actor.id,
                title=row.title,
                summary=summary,
                recipient_ids=recipients,
                revision=str(uuid4()),
            )
        elif self._notifications is not None:
            pending_ids = await self._notifications.pending_event_update_ids(row.id)
        await self._session.commit()
        if self._notifications is not None:
            await self._notifications.enqueue(pending_ids)
        await self._session.refresh(row)
        loaded = await self._events.get(row.id)
        assert loaded is not None
        count = await self._events.count_going(loaded.id)
        rsvp = await self._events.get_rsvp(loaded.id, actor.id)
        return self._serialize(loaded, actor, count, rsvp)

    def _visible_fields(self, row: SocialEvent) -> dict[str, Any]:
        return {
            "title": row.title,
            "description": row.description,
            "location": row.location,
            "latitude": row.latitude,
            "longitude": row.longitude,
            "starts_at": row.starts_at,
            "ends_at": row.ends_at,
            "capacity": row.capacity,
            "price": row.price,
        }

    async def cancel_event(self, actor: User, event_id: UUID) -> dict[str, Any]:
        self._require_active(actor)
        await self._hit("events_mutate", actor.id)
        row = await self._events.get(event_id)
        if row is None:
            raise NotFoundError("Event not found.")
        if row.host_user_id != actor.id:
            raise ForbiddenError("Only the host can cancel this event.")
        self._require_host_can_mutate(row)
        row.status = EventStatus.CANCELLED.value
        await self._session.commit()
        loaded = await self._events.get(row.id)
        assert loaded is not None
        count = await self._events.count_going(loaded.id)
        rsvp = await self._events.get_rsvp(loaded.id, actor.id)
        return self._serialize(loaded, actor, count, rsvp)

    async def create_cover_upload_url(
        self, actor: User, event_id: UUID, body: UploadUrlRequest
    ) -> dict[str, Any]:
        await self._hit("events_mutate", actor.id)
        await self._hosted_published_event(actor, event_id)
        return await self._storage.create_upload_target(
            actor.id,
            body.content_type,
            body.filename,
            body.byte_size,
            purpose="event",
            event_id=event_id,
        )

    async def set_cover(self, actor: User, event_id: UUID, storage_key: str) -> dict[str, Any]:
        await self._hit("events_mutate", actor.id)
        row = await self._hosted_published_event(actor, event_id)
        key = storage_key.strip()
        if is_verification_storage_key(key) or not is_owned_event_cover_key(
            actor.id, event_id, key
        ):
            raise ForbiddenError("This upload does not belong to this event.")
        if not await self._storage.object_exists(key):
            raise AppError("EVENT_COVER_INVALID", "Uploaded object was not found.", 400)
        data = await self._storage.read_bytes(key)
        if sniff_image_type(data) is None:
            raise AppError("EVENT_COVER_INVALID", "File is not a supported image.", 422)
        previous = row.cover_storage_key
        row.cover_storage_key = key
        row.cover_url = self._storage.public_url(key, self._public_base)
        if previous and previous != key:
            await self._storage.delete_object(previous)
        await self._session.commit()
        await self._session.refresh(row)
        return await self.get_event(actor, event_id)

    async def remove_cover(self, actor: User, event_id: UUID) -> dict[str, Any]:
        await self._hit("events_mutate", actor.id)
        row = await self._hosted_published_event(actor, event_id)
        previous = row.cover_storage_key
        row.cover_storage_key = None
        row.cover_url = None
        if previous:
            await self._storage.delete_object(previous)
        await self._session.commit()
        await self._session.refresh(row)
        return await self.get_event(actor, event_id)

    async def rsvp(self, actor: User, event_id: UUID) -> dict[str, Any]:
        self._require_active(actor)
        await self._hit("events_rsvp", actor.id)
        locked = await self._events.get_for_update(event_id)
        if locked is None:
            raise NotFoundError("Event not found.")
        if locked.status == EventStatus.HIDDEN.value:
            raise ConflictError("EVENT_HIDDEN", "This event is no longer available.")
        if locked.status != EventStatus.PUBLISHED.value:
            raise ConflictError("EVENT_CANCELLED", "This event is cancelled.")
        existing = await self._events.get_rsvp(event_id, actor.id)
        if existing is not None and existing.status == EventRsvpStatus.GOING.value:
            await self._session.commit()
            return await self.get_event(actor, event_id)
        going = await self._events.count_going(event_id)
        if locked.capacity is not None and going >= locked.capacity:
            raise ConflictError("EVENT_FULL", "This event is full.")
        await self._events.upsert_going(event_id, actor.id)
        await self._session.commit()
        return await self.get_event(actor, event_id)

    async def cancel_rsvp(self, actor: User, event_id: UUID) -> dict[str, Any]:
        self._require_active(actor)
        await self._hit("events_rsvp", actor.id)
        locked = await self._events.get_for_update(event_id)
        if locked is None:
            raise NotFoundError("Event not found.")
        existing = await self._events.get_rsvp(event_id, actor.id)
        if existing is None:
            raise NotFoundError("RSVP not found.")
        existing.status = EventRsvpStatus.CANCELLED.value
        await self._session.commit()
        return await self.get_event(actor, event_id)

    def _require_active(self, actor: User) -> None:
        if not account_is_active(actor):
            raise ForbiddenError("Your account cannot perform this action.")

    async def _hosted_published_event(self, actor: User, event_id: UUID) -> SocialEvent:
        self._require_active(actor)
        row = await self._events.get(event_id)
        if row is None:
            raise NotFoundError("Event not found.")
        if row.host_user_id != actor.id:
            raise ForbiddenError("Only the host can update this event cover.")
        self._require_host_can_mutate(row)
        return row

    def _require_host_can_mutate(self, row: SocialEvent) -> None:
        if row.status == EventStatus.HIDDEN.value:
            raise ConflictError("EVENT_HIDDEN", "This event is no longer available.")
        if row.status != EventStatus.PUBLISHED.value:
            raise ConflictError("EVENT_CANCELLED", "This event is cancelled.")

    async def _hit(self, policy: str, user_id: UUID) -> None:
        limit, window = RATE_LIMIT_POLICIES[policy]
        await self._limiter.hit(f"{policy}:{user_id}", limit, window)

    def _serialize(self, row: SocialEvent, actor: User, attendee_count: int, rsvp) -> dict[str, Any]:
        host = row.host
        profile = host.profile if host is not None else None
        host_name = (profile.display_name if profile is not None else None) or "Host"
        price = float(row.price) if isinstance(row.price, Decimal) else float(row.price or 0)
        my_rsvp = rsvp.status if rsvp is not None else None
        return {
            "id": str(row.id),
            "title": row.title,
            "description": row.description,
            "location": row.location,
            "latitude": row.latitude,
            "longitude": row.longitude,
            "startsAt": row.starts_at.isoformat() if row.starts_at else None,
            "endsAt": row.ends_at.isoformat() if row.ends_at else None,
            "coverImageUrl": self._cover_url(row),
            "coverStorageKey": row.cover_storage_key,
            "imageUrl": self._cover_url(row) or "",
            "capacity": row.capacity,
            "attendeeCount": attendee_count,
            "attendees": attendee_count,
            "myRsvp": my_rsvp,
            "isHost": row.host_user_id == actor.id,
            "hostId": str(row.host_user_id),
            "hostName": host_name,
            "price": price,
            "status": row.status,
        }

    def _cover_url(self, row: SocialEvent) -> str | None:
        if not row.cover_storage_key:
            return None
        if row.cover_url:
            return row.cover_url
        return self._storage.public_url(row.cover_storage_key, self._public_base)

    def _encode_cursor(self, viewer_id: UUID, starts_at: datetime, row_id: UUID) -> str:
        expires = datetime.now(UTC) + timedelta(seconds=self._settings.discovery_cursor_ttl_seconds)
        return jwt.encode(
            {
                "typ": "events",
                "sub": str(viewer_id),
                "t": starts_at.isoformat(),
                "i": str(row_id),
                "exp": int(expires.timestamp()),
            },
            self._settings.jwt_secret,
            algorithm=self._settings.jwt_algorithm,
        )

    def _decode_cursor(
        self, cursor: str | None, viewer_id: UUID
    ) -> tuple[datetime | None, UUID | None]:
        if not cursor:
            return None, None
        try:
            payload = decode_token(self._settings, cursor)
        except ExpiredSignatureError as exc:
            raise AppError("VALIDATION_ERROR", "Invalid cursor.", 400) from exc
        except InvalidTokenError as exc:
            raise AppError("VALIDATION_ERROR", "Invalid cursor.", 400) from exc
        if payload.get("typ") != "events" or payload.get("sub") != str(viewer_id):
            raise ForbiddenError("Invalid cursor.")
        try:
            starts = datetime.fromisoformat(str(payload["t"]))
            row_id = UUID(str(payload["i"]))
        except (KeyError, ValueError, TypeError) as exc:
            raise AppError("VALIDATION_ERROR", "Invalid cursor.", 400) from exc
        return _as_utc(starts), row_id
