from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.errors import AppError, ForbiddenError, NotFoundError
from app.core.jobs import JobQueue
from app.core.rate_limit import RATE_LIMIT_POLICIES, RateLimiter
from app.core.realtime import PresenceStore, encode_event, user_notify_channel
from app.core.security import decode_token
from app.models.orm import (
    NotificationDeliveryStatus,
    NotificationPreference,
    NotificationType,
    User,
)
from app.repositories.notifications import (
    DeviceTokenRepository,
    NotificationPreferenceRepository,
    NotificationRepository,
)
from app.repositories.profiles import ProfileQueryRepository

PREF_FIELDS = (
    "matches",
    "likes",
    "favorites",
    "messages",
    "message_preview",
    "general",
    "all_enabled",
    "profile_views",
    "cross_path",
    "traveller_alerts",
    "free_tonight",
    "email_enabled",
)

PREF_ALIASES = {
    "all": "all_enabled",
    "profileViews": "profile_views",
    "crossPath": "cross_path",
    "travellerAlerts": "traveller_alerts",
    "freeTonight": "free_tonight",
    "email": "email_enabled",
    "messagePreview": "message_preview",
}


def notification_visible(prefs: NotificationPreference, row_type: str) -> bool:
    if row_type in {
        NotificationType.LIKE_RECEIVED.value,
        NotificationType.OFFER_RECEIVED.value,
    }:
        return bool(prefs.likes)
    if row_type == NotificationType.MATCH_CREATED.value:
        return bool(prefs.matches)
    if row_type == NotificationType.NEW_MESSAGE.value:
        return bool(prefs.messages)
    if row_type in {
        NotificationType.PROFILE_VIEW.value,
        NotificationType.PROFILE_ACTIVITY.value,
    }:
        return bool(getattr(prefs, "profile_views", True))
    if row_type == NotificationType.TRAVEL_UPDATE.value:
        return bool(getattr(prefs, "traveller_alerts", True))
    if row_type == NotificationType.EVENT_UPDATE.value:
        return bool(getattr(prefs, "free_tonight", True))
    return bool(prefs.general)

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(
        self,
        session: AsyncSession,
        settings: Settings,
        limiter: RateLimiter,
        request_id: str,
        jobs: JobQueue | None = None,
        presence: PresenceStore | None = None,
        broker: Any | None = None,
    ) -> None:
        self._session = session
        self._settings = settings
        self._limiter = limiter
        self._request_id = request_id
        self._jobs = jobs
        self._presence = presence
        self._broker = broker
        self._devices = DeviceTokenRepository(session)
        self._inbox = NotificationRepository(session)
        self._prefs = NotificationPreferenceRepository(session)
        self._users = ProfileQueryRepository(session)

    async def register_device(
        self,
        actor: User,
        *,
        token: str,
        platform: str,
        device_id: str | None,
        app_version: str | None,
    ) -> dict[str, Any]:
        await self._hit("device_register", actor.id)
        cleaned = token.strip()
        if len(cleaned) < 8:
            raise AppError("VALIDATION_ERROR", "Device token is required.", 422)
        row = await self._devices.upsert(
            actor.id,
            token=cleaned,
            platform=(platform or "unknown").strip().lower()[:32],
            device_id=(device_id or "").strip()[:128] or None,
            app_version=(app_version or "").strip()[:32] or None,
        )
        await self._session.commit()
        logger.info(
            "device_registered request_id=%s device_id=%s platform=%s",
            self._request_id,
            row.id,
            row.platform,
        )
        return self._serialize_device(row)

    async def list_devices(self, actor: User) -> list[dict[str, Any]]:
        rows = await self._devices.list_for_user(actor.id)
        return [self._serialize_device(row) for row in rows]

    async def delete_device(self, actor: User, device_id: UUID) -> dict[str, Any]:
        await self._hit("device_delete", actor.id)
        row = await self._devices.get(device_id)
        if row is None or row.user_id != actor.id:
            raise NotFoundError("Device not found.")
        row.is_active = False
        await self._session.commit()
        logger.info("device_deactivated request_id=%s device_id=%s", self._request_id, row.id)
        return {"deactivated": True, "id": str(row.id)}

    async def list_notifications(
        self, actor: User, limit: int, cursor: str | None
    ) -> dict[str, Any]:
        await self._hit("notification_list", actor.id)
        after, after_id = self._decode_cursor(cursor, actor.id)
        rows = await self._inbox.list_for_user(actor.id, max(limit * 3, 40), after, after_id)
        prefs = await self._prefs.get_or_create(actor.id)
        visible = [row for row in rows if notification_visible(prefs, row.type)]
        has_more = len(visible) > limit
        page = visible[:limit]
        next_cursor = None
        if has_more and page:
            last = page[-1]
            next_cursor = self._encode_cursor(actor.id, last.created_at, last.id)
        return {
            "items": [self._serialize_notification(row) for row in page],
            "nextCursor": next_cursor,
            "hasMore": has_more,
        }

    async def unread_count(self, actor: User) -> dict[str, Any]:
        await self._hit("notification_read", actor.id)
        prefs = await self._prefs.get_or_create(actor.id)
        rows = await self._inbox.list_for_user(actor.id, 80, None, None)
        count = sum(
            1
            for row in rows
            if not row.is_read and notification_visible(prefs, row.type)
        )
        return {"count": count}

    async def mark_read(self, actor: User, notification_id: UUID) -> dict[str, Any]:
        await self._hit("notification_read", actor.id)
        row = await self._inbox.mark_read(actor.id, notification_id)
        if row is None:
            raise NotFoundError("Notification not found.")
        await self._session.commit()
        return self._serialize_notification(row)

    async def mark_all_read(self, actor: User) -> dict[str, Any]:
        await self._hit("notification_read", actor.id)
        updated = await self._inbox.mark_all_read(actor.id)
        await self._session.commit()
        return {"updated": updated}

    async def get_preferences(self, actor: User) -> dict[str, Any]:
        prefs = await self._prefs.get_or_create(actor.id)
        await self._session.commit()
        return self._serialize_prefs(prefs)

    async def update_preferences(self, actor: User, payload: dict[str, Any]) -> dict[str, Any]:
        prefs = await self._prefs.get_or_create(actor.id)
        normalized = {PREF_ALIASES.get(key, key): value for key, value in payload.items()}
        for field in PREF_FIELDS:
            if field in normalized and normalized[field] is not None:
                setattr(prefs, field, bool(normalized[field]))
        if "all_enabled" in normalized and normalized["all_enabled"] is not None:
            prefs.general = bool(normalized["all_enabled"])
        await self._session.commit()
        return self._serialize_prefs(prefs)

    async def persist_like(
        self,
        *,
        like_id: UUID,
        actor_id: UUID,
        target_id: UUID,
        is_offer: bool = False,
    ) -> list[UUID]:
        if not await self._allowed(target_id, "likes"):
            return []
        actor = await self._actor_label(actor_id)
        ntype = (
            NotificationType.OFFER_RECEIVED.value
            if is_offer
            else NotificationType.LIKE_RECEIVED.value
        )
        title = "New offer" if is_offer else "New like"
        body = (
            f"{actor['name']} sent you a Super Like"
            if is_offer
            else f"{actor['name']} liked your profile"
        )
        row, created = await self._inbox.insert_idempotent(
            target_id,
            type=ntype,
            title=title,
            body=body,
            event_key=f"like:{like_id}",
            data={
                "type": ntype,
                "kind": "offer" if is_offer else "like",
                "entity_id": str(like_id),
                "likeId": str(like_id),
                "userId": actor["userId"],
                "user_id": actor["userId"],
                "name": actor["name"],
                "photo": actor["photo"],
            },
            related_entity_type="user",
            related_entity_id=actor_id,
        )
        return [row.id] if created and row is not None else []

    async def persist_match(
        self,
        *,
        match_id: UUID,
        user_a_id: UUID,
        user_b_id: UUID,
        conversation_id: UUID | None,
    ) -> list[UUID]:
        created_ids: list[UUID] = []
        for user_id, other_id in ((user_a_id, user_b_id), (user_b_id, user_a_id)):
            if not await self._allowed(user_id, "matches"):
                continue
            other = await self._actor_label(other_id)
            data = {
                "type": NotificationType.MATCH_CREATED.value,
                "kind": "match",
                "entity_id": str(match_id),
                "matchId": str(match_id),
                "userId": other["userId"],
                "user_id": other["userId"],
                "name": other["name"],
                "photo": other["photo"],
            }
            if conversation_id is not None:
                data["conversationId"] = str(conversation_id)
                data["conversation_id"] = str(conversation_id)
            row, created = await self._inbox.insert_idempotent(
                user_id,
                type=NotificationType.MATCH_CREATED.value,
                title="It's a match",
                body=f"You and {other['name']} liked each other",
                event_key=f"match:{match_id}",
                data=data,
                related_entity_type="match",
                related_entity_id=match_id,
            )
            if created and row is not None:
                created_ids.append(row.id)
        return created_ids

    async def persist_view(
        self,
        *,
        view_id: UUID,
        viewer_id: UUID,
        viewed_id: UUID,
    ) -> list[UUID]:
        if viewer_id == viewed_id:
            return []
        if not await self._allowed(viewed_id, "profile_views"):
            return []
        viewer = await self._actor_label(viewer_id)
        day = datetime.now(UTC).date().isoformat()
        row, created = await self._inbox.insert_idempotent(
            viewed_id,
            type=NotificationType.PROFILE_VIEW.value,
            title="Profile view",
            body=f"{viewer['name']} viewed your profile",
            event_key=f"view:{viewer_id}:{viewed_id}:{day}",
            data={
                "type": NotificationType.PROFILE_VIEW.value,
                "kind": "view",
                "entity_id": str(view_id),
                "userId": viewer["userId"],
                "user_id": viewer["userId"],
                "name": viewer["name"],
                "photo": viewer["photo"],
            },
            related_entity_type="user",
            related_entity_id=viewer_id,
        )
        return [row.id] if created and row is not None else []

    async def persist_travel(
        self,
        *,
        journey_id: UUID,
        traveler_id: UUID,
        to_city: str,
        from_city: str,
        recipient_ids: list[UUID],
    ) -> list[UUID]:
        traveler = await self._actor_label(traveler_id)
        dest = (to_city or "your city").strip() or "your city"
        origin = (from_city or "abroad").strip() or "abroad"
        created_ids: list[UUID] = []
        for user_id in recipient_ids:
            if user_id == traveler_id:
                continue
            if not await self._allowed(user_id, "traveller_alerts"):
                continue
            row, created = await self._inbox.insert_idempotent(
                user_id,
                type=NotificationType.TRAVEL_UPDATE.value,
                title="Traveller nearby",
                body=f"{traveler['name']} is heading to {dest} from {origin}",
                event_key=f"travel:{journey_id}:{user_id}",
                data={
                    "type": NotificationType.TRAVEL_UPDATE.value,
                    "kind": "travel",
                    "entity_id": str(journey_id),
                    "userId": traveler["userId"],
                    "name": traveler["name"],
                    "photo": traveler["photo"],
                },
                related_entity_type="travel_journey",
                related_entity_id=journey_id,
            )
            if created and row is not None:
                created_ids.append(row.id)
        return created_ids

    async def persist_tonight(
        self,
        *,
        post_id: UUID,
        host_id: UUID,
        activity: str,
        venue: str,
        recipient_ids: list[UUID],
    ) -> list[UUID]:
        host = await self._actor_label(host_id)
        place = (venue or "").strip()
        what = (activity or "tonight").strip() or "tonight"
        body = f"{host['name']} is free for {what}"
        if place:
            body = f"{body} at {place}"
        created_ids: list[UUID] = []
        for user_id in recipient_ids:
            if user_id == host_id:
                continue
            if not await self._allowed(user_id, "free_tonight"):
                continue
            row, created = await self._inbox.insert_idempotent(
                user_id,
                type=NotificationType.EVENT_UPDATE.value,
                title="Free tonight",
                body=body,
                event_key=f"tonight:{post_id}:{user_id}",
                data={
                    "type": NotificationType.EVENT_UPDATE.value,
                    "kind": "tonight",
                    "entity_id": str(post_id),
                    "userId": host["userId"],
                    "name": host["name"],
                    "photo": host["photo"],
                },
                related_entity_type="tonight_post",
                related_entity_id=post_id,
            )
            if created and row is not None:
                created_ids.append(row.id)
        return created_ids

    async def persist_message(
        self,
        *,
        message_id: UUID,
        recipient_id: UUID,
        conversation_id: UUID,
        preview: str | None,
    ) -> list[UUID]:
        if not await self._allowed(recipient_id, "messages"):
            return []
        prefs = await self._prefs.get_or_create(recipient_id)
        body = "You have a new message"
        if prefs.message_preview and preview:
            body = preview[:80]
        row, created = await self._inbox.insert_idempotent(
            recipient_id,
            type=NotificationType.NEW_MESSAGE.value,
            title="New message",
            body=body,
            event_key=f"message:{message_id}",
            data={
                "type": NotificationType.NEW_MESSAGE.value,
                "entity_id": str(conversation_id),
            },
            related_entity_type="conversation",
            related_entity_id=conversation_id,
        )
        if not created or row is None:
            return []
        if self._presence is not None:
            focused = await self._presence.focused_conversation(recipient_id)
            if focused == conversation_id:
                return []
        return [row.id]

    async def persist_verification(
        self,
        *,
        user_id: UUID,
        request_id: UUID,
        event: str,
    ) -> list[UUID]:
        if not await self._allowed(user_id, "general"):
            return []
        titles = {
            NotificationType.VERIFICATION_SUBMITTED.value: (
                "Verification submitted",
                "Your selfie is in review.",
            ),
            NotificationType.VERIFICATION_APPROVED.value: (
                "You're verified",
                "Your profile now shows a verified badge.",
            ),
            NotificationType.VERIFICATION_REJECTED.value: (
                "Verification not approved",
                "You can try again with a new selfie.",
            ),
        }
        title, body = titles.get(
            event, ("Verification update", "Your verification status changed.")
        )
        row, created = await self._inbox.insert_idempotent(
            user_id,
            type=event,
            title=title,
            body=body,
            event_key=f"verification:{request_id}:{event}",
            data={"type": event, "entity_id": str(request_id)},
            related_entity_type="verification",
            related_entity_id=request_id,
        )
        return [row.id] if created and row is not None else []

    async def persist_subscription(
        self,
        *,
        user_id: UUID,
        subscription_id: UUID,
        event: str,
    ) -> list[UUID]:
        if not await self._allowed(user_id, "general"):
            return []
        titles = {
            "SUBSCRIPTION_PURCHASED": ("Premium activated", "Your subscription is active."),
            "SUBSCRIPTION_RENEWED": ("Subscription renewed", "Your Premium period was extended."),
            "SUBSCRIPTION_CANCELLED": (
                "Subscription cancelled",
                "You keep Premium until the current period ends.",
            ),
            "SUBSCRIPTION_EXPIRED": ("Premium ended", "Your subscription is no longer active."),
            "SUBSCRIPTION_REVOKED": ("Subscription revoked", "This purchase is no longer valid."),
            "SUBSCRIPTION_BILLING_ISSUE": (
                "Billing issue",
                "There is a problem renewing Premium.",
            ),
        }
        title, body = titles.get(
            event, ("Subscription update", "Your subscription status changed.")
        )
        row, created = await self._inbox.insert_idempotent(
            user_id,
            type=NotificationType.SUBSCRIPTION_EVENT.value,
            title=title,
            body=body,
            event_key=f"subscription:{subscription_id}:{event}",
            data={
                "type": NotificationType.SUBSCRIPTION_EVENT.value,
                "entity_id": str(subscription_id),
            },
            related_entity_type="subscription",
            related_entity_id=subscription_id,
        )
        return [row.id] if created and row is not None else []

    async def persist_event_update(
        self,
        *,
        event_id: UUID,
        host_user_id: UUID,
        title: str,
        summary: str,
        recipient_ids: list[UUID],
        revision: str,
    ) -> list[UUID]:
        origin = self._settings.public_app_origin.rstrip("/")
        payload = {
            "type": NotificationType.EVENT_UPDATE.value,
            "eventId": str(event_id),
            "entity_id": str(event_id),
            "deepLink": f"{origin}/events/{event_id}",
        }
        event_key = f"event_update:{event_id}:{revision}"
        rows = []
        for user_id in recipient_ids:
            if user_id == host_user_id:
                continue
            if not await self._allowed(user_id, "general"):
                continue
            rows.append(
                {
                    "id": uuid4(),
                    "user_id": user_id,
                    "type": NotificationType.EVENT_UPDATE.value,
                    "title": title[:160],
                    "body": summary[:320],
                    "data": payload,
                    "related_entity_type": "event",
                    "related_entity_id": event_id,
                    "event_key": event_key,
                    "is_read": False,
                    "delivery_status": NotificationDeliveryStatus.CREATED.value,
                }
            )
        return await self._inbox.insert_many_idempotent(rows)

    async def pending_event_update_ids(self, event_id: UUID) -> list[UUID]:
        return await self._inbox.created_ids_for_entity("event", event_id)

    async def persist_test(self, actor: User) -> dict[str, Any]:
        await self._hit("notification_test", actor.id)
        row, _ = await self._inbox.insert_idempotent(
            actor.id,
            type=NotificationType.PROFILE_ACTIVITY.value,
            title="Test notification",
            body="Push delivery check",
            event_key=f"test:{datetime.now(UTC).timestamp()}:{actor.id}",
            data={"type": NotificationType.PROFILE_ACTIVITY.value, "entity_id": str(actor.id)},
            related_entity_type="user",
            related_entity_id=actor.id,
        )
        await self._session.commit()
        if row is not None:
            await self.enqueue([row.id])
        return self._serialize_notification(row) if row is not None else {}

    async def enqueue(self, notification_ids: list[UUID]) -> None:
        if not notification_ids:
            return
        rows = []
        for notification_id in notification_ids:
            row = await self._inbox.get(notification_id)
            if row is not None:
                rows.append(row)
            if self._jobs is not None:
                await self._inbox.set_status(
                    notification_id, NotificationDeliveryStatus.QUEUED.value
                )
                await self._jobs.enqueue(
                    {"notification_id": str(notification_id), "attempt": 0}
                )
        if self._jobs is not None:
            await self._session.commit()
        await self._publish_push(rows)

    async def _publish_push(self, rows: list[Any]) -> None:
        if self._broker is None:
            return
        for row in rows:
            await self._broker.publish(
                user_notify_channel(row.user_id),
                encode_event(row.type, self._serialize_notification(row)),
            )

    async def _actor_label(self, user_id: UUID) -> dict[str, str | None]:
        bundle = await self._users.get_user_bundle(user_id)
        name = "Someone"
        photo = None
        if bundle is not None and bundle.profile is not None:
            name = bundle.profile.display_name or "Someone"
            media = [
                item
                for item in list(getattr(bundle.profile, "media", None) or [])
                if getattr(item, "deleted_at", None) is None
            ]
            media.sort(
                key=lambda item: (
                    not bool(getattr(item, "is_primary", False)),
                    int(getattr(item, "sort_order", 0) or 0),
                )
            )
            if media:
                photo = getattr(media[0], "url", None) or getattr(media[0], "thumbnail_url", None)
        return {"userId": str(user_id), "name": name, "photo": photo}

    async def _allowed(self, user_id: UUID, category: str) -> bool:
        prefs = await self._prefs.get_or_create(user_id)
        return bool(getattr(prefs, category, False))

    async def _hit(self, policy: str, user_id: UUID) -> None:
        limit, window = RATE_LIMIT_POLICIES[policy]
        await self._limiter.hit(f"{policy}:{user_id}", limit, window)

    def _serialize_device(self, row) -> dict[str, Any]:
        return {
            "id": str(row.id),
            "platform": row.platform,
            "deviceId": row.device_id,
            "appVersion": row.app_version,
            "isActive": row.is_active,
            "lastSeenAt": row.last_seen_at.isoformat() if row.last_seen_at else None,
        }

    def _serialize_notification(self, row) -> dict[str, Any]:
        return {
            "id": str(row.id),
            "type": row.type,
            "title": row.title,
            "body": row.body,
            "data": row.data_json or {},
            "relatedEntityType": row.related_entity_type,
            "relatedEntityId": str(row.related_entity_id) if row.related_entity_id else None,
            "isRead": row.is_read,
            "createdAt": row.created_at.isoformat() if row.created_at else None,
            "time": row.created_at.isoformat() if row.created_at else "",
            "readAt": row.read_at.isoformat() if row.read_at else None,
            "deliveryStatus": row.delivery_status,
        }

    def _serialize_prefs(self, prefs: NotificationPreference) -> dict[str, Any]:
        return {
            "matches": prefs.matches,
            "likes": prefs.likes,
            "favorites": prefs.favorites,
            "messages": prefs.messages,
            "messagePreview": prefs.message_preview,
            "general": prefs.general,
            "all": getattr(prefs, "all_enabled", prefs.general),
            "profileViews": getattr(prefs, "profile_views", True),
            "crossPath": getattr(prefs, "cross_path", True),
            "travellerAlerts": getattr(prefs, "traveller_alerts", True),
            "freeTonight": getattr(prefs, "free_tonight", True),
            "email": getattr(prefs, "email_enabled", False),
        }

    def _encode_cursor(self, viewer_id: UUID, created_at: datetime, row_id: UUID) -> str:
        expires = datetime.now(UTC) + timedelta(seconds=self._settings.discovery_cursor_ttl_seconds)
        return jwt.encode(
            {
                "typ": "notifications",
                "sub": str(viewer_id),
                "t": created_at.isoformat(),
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
            raise AppError("VALIDATION_ERROR", "Cursor expired.", 400) from exc
        except InvalidTokenError as exc:
            raise AppError("VALIDATION_ERROR", "Invalid cursor.", 400) from exc
        if payload.get("typ") != "notifications" or payload.get("sub") != str(viewer_id):
            raise ForbiddenError("Invalid cursor.")
        try:
            return datetime.fromisoformat(str(payload["t"])), UUID(str(payload["i"]))
        except (KeyError, ValueError) as exc:
            raise AppError("VALIDATION_ERROR", "Invalid cursor.", 400) from exc
