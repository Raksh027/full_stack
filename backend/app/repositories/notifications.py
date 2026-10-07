from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import (
    AppNotification,
    DeviceToken,
    NotificationDeliveryStatus,
    NotificationPreference,
    NotificationType,
)


class DeviceTokenRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, device_id: UUID) -> DeviceToken | None:
        result = await self._session.execute(select(DeviceToken).where(DeviceToken.id == device_id))
        return result.scalar_one_or_none()

    async def get_by_token(self, token: str) -> DeviceToken | None:
        result = await self._session.execute(select(DeviceToken).where(DeviceToken.token == token))
        return result.scalar_one_or_none()

    async def list_for_user(self, user_id: UUID) -> list[DeviceToken]:
        result = await self._session.execute(
            select(DeviceToken)
            .where(DeviceToken.user_id == user_id)
            .order_by(DeviceToken.updated_at.desc())
        )
        return list(result.scalars())

    async def list_active_for_user(self, user_id: UUID) -> list[DeviceToken]:
        result = await self._session.execute(
            select(DeviceToken).where(
                DeviceToken.user_id == user_id,
                DeviceToken.is_active.is_(True),
            )
        )
        return list(result.scalars())

    async def deactivate_device_siblings(
        self, user_id: UUID, device_id: str, keep_token: str
    ) -> None:
        await self._session.execute(
            update(DeviceToken)
            .where(
                DeviceToken.user_id == user_id,
                DeviceToken.device_id == device_id,
                DeviceToken.token != keep_token,
                DeviceToken.is_active.is_(True),
            )
            .values(is_active=False)
        )

    async def deactivate_tokens(self, tokens: list[str]) -> None:
        if not tokens:
            return
        await self._session.execute(
            update(DeviceToken).where(DeviceToken.token.in_(tokens)).values(is_active=False)
        )

    async def upsert(
        self,
        user_id: UUID,
        *,
        token: str,
        platform: str,
        device_id: str | None,
        app_version: str | None,
    ) -> DeviceToken:
        now = datetime.now(UTC)
        existing = await self.get_by_token(token)
        if existing is not None:
            existing.user_id = user_id
            existing.platform = platform
            existing.device_id = device_id
            existing.app_version = app_version
            existing.is_active = True
            existing.last_seen_at = now
            await self._session.flush()
            if device_id:
                await self.deactivate_device_siblings(user_id, device_id, token)
            return existing
        row = DeviceToken(
            id=uuid4(),
            user_id=user_id,
            token=token,
            platform=platform,
            device_id=device_id,
            app_version=app_version,
            is_active=True,
            last_seen_at=now,
        )
        self._session.add(row)
        await self._session.flush()
        if device_id:
            await self.deactivate_device_siblings(user_id, device_id, token)
        return row


class NotificationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, notification_id: UUID) -> AppNotification | None:
        result = await self._session.execute(
            select(AppNotification).where(AppNotification.id == notification_id)
        )
        return result.scalar_one_or_none()

    async def insert_idempotent(
        self,
        user_id: UUID,
        *,
        type: str,
        title: str,
        body: str,
        event_key: str,
        data: dict | None,
        related_entity_type: str | None,
        related_entity_id: UUID | None,
    ) -> tuple[AppNotification | None, bool]:
        stmt = (
            pg_insert(AppNotification)
            .values(
                id=uuid4(),
                user_id=user_id,
                type=type,
                title=title,
                body=body,
                data=data,
                related_entity_type=related_entity_type,
                related_entity_id=related_entity_id,
                event_key=event_key,
                is_read=False,
                delivery_status=NotificationDeliveryStatus.CREATED.value,
            )
            .on_conflict_do_nothing(constraint="uq_notifications_user_event")
            .returning(AppNotification.id)
        )
        result = await self._session.execute(stmt)
        inserted_id = result.scalar_one_or_none()
        await self._session.flush()
        row_result = await self._session.execute(
            select(AppNotification).where(
                AppNotification.user_id == user_id,
                AppNotification.event_key == event_key,
            )
        )
        row = row_result.scalar_one_or_none()
        return row, inserted_id is not None

    async def insert_many_idempotent(
        self,
        rows: list[dict],
    ) -> list[UUID]:
        if not rows:
            return []
        stmt = (
            pg_insert(AppNotification)
            .values(rows)
            .on_conflict_do_nothing(constraint="uq_notifications_user_event")
            .returning(AppNotification.id)
        )
        result = await self._session.execute(stmt)
        await self._session.flush()
        return [row[0] for row in result.all()]

    async def created_ids_for_entity(self, related_entity_type: str, related_entity_id: UUID) -> list[UUID]:
        result = await self._session.execute(
            select(AppNotification.id).where(
                AppNotification.related_entity_type == related_entity_type,
                AppNotification.related_entity_id == related_entity_id,
                AppNotification.delivery_status == NotificationDeliveryStatus.CREATED.value,
            )
        )
        return [row[0] for row in result.all()]

    async def list_for_user(
        self,
        user_id: UUID,
        limit: int,
        after: datetime | None,
        after_id: UUID | None,
    ) -> list[AppNotification]:
        conditions = [AppNotification.user_id == user_id]
        if after is not None and after_id is not None:
            from sqlalchemy import and_, or_

            conditions.append(
                or_(
                    AppNotification.created_at < after,
                    and_(AppNotification.created_at == after, AppNotification.id < after_id),
                )
            )
        result = await self._session.execute(
            select(AppNotification)
            .where(*conditions)
            .order_by(AppNotification.created_at.desc(), AppNotification.id.desc())
            .limit(limit)
        )
        return list(result.scalars())

    async def unread_count(self, user_id: UUID) -> int:
        result = await self._session.execute(
            select(func.count())
            .select_from(AppNotification)
            .where(AppNotification.user_id == user_id, AppNotification.is_read.is_(False))
        )
        return int(result.scalar_one())

    async def count_unread_visible(self, user_id: UUID, prefs: NotificationPreference) -> int:
        kind = AppNotification.data_json["kind"].as_string()
        tonight = and_(
            AppNotification.type == NotificationType.EVENT_UPDATE.value,
            kind == "tonight",
        )
        other_event = and_(
            AppNotification.type == NotificationType.EVENT_UPDATE.value,
            or_(kind.is_(None), kind != "tonight"),
        )
        included = [kind == "test"]
        if prefs.likes:
            included.append(
                AppNotification.type.in_(
                    [
                        NotificationType.LIKE_RECEIVED.value,
                        NotificationType.OFFER_RECEIVED.value,
                    ]
                )
            )
        if prefs.matches:
            included.append(AppNotification.type == NotificationType.MATCH_CREATED.value)
        if prefs.messages:
            included.append(AppNotification.type == NotificationType.NEW_MESSAGE.value)
        if getattr(prefs, "profile_views", True):
            included.append(
                AppNotification.type.in_(
                    [
                        NotificationType.PROFILE_VIEW.value,
                        NotificationType.PROFILE_ACTIVITY.value,
                    ]
                )
            )
        if getattr(prefs, "traveller_alerts", True):
            included.append(AppNotification.type == NotificationType.TRAVEL_UPDATE.value)
        if getattr(prefs, "free_tonight", True):
            included.append(tonight)
        if prefs.general:
            included.append(other_event)
            included.append(
                AppNotification.type.notin_(
                    [
                        NotificationType.LIKE_RECEIVED.value,
                        NotificationType.OFFER_RECEIVED.value,
                        NotificationType.MATCH_CREATED.value,
                        NotificationType.NEW_MESSAGE.value,
                        NotificationType.PROFILE_VIEW.value,
                        NotificationType.PROFILE_ACTIVITY.value,
                        NotificationType.TRAVEL_UPDATE.value,
                        NotificationType.EVENT_UPDATE.value,
                    ]
                )
            )
        result = await self._session.execute(
            select(func.count())
            .select_from(AppNotification)
            .where(
                AppNotification.user_id == user_id,
                AppNotification.is_read.is_(False),
                or_(*included),
            )
        )
        return int(result.scalar_one())

    async def mark_read(self, user_id: UUID, notification_id: UUID) -> AppNotification | None:
        row = await self.get(notification_id)
        if row is None or row.user_id != user_id:
            return None
        if not row.is_read:
            row.is_read = True
            row.read_at = datetime.now(UTC)
            await self._session.flush()
        return row

    async def mark_all_read(self, user_id: UUID) -> int:
        result = await self._session.execute(
            update(AppNotification)
            .where(AppNotification.user_id == user_id, AppNotification.is_read.is_(False))
            .values(is_read=True, read_at=datetime.now(UTC))
        )
        return int(result.rowcount or 0)

    async def set_status(self, notification_id: UUID, status: str) -> None:
        await self._session.execute(
            update(AppNotification)
            .where(AppNotification.id == notification_id)
            .values(delivery_status=status)
        )


class NotificationPreferenceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, user_id: UUID) -> NotificationPreference | None:
        result = await self._session.execute(
            select(NotificationPreference).where(NotificationPreference.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_or_create(self, user_id: UUID) -> NotificationPreference:
        row = await self.get(user_id)
        if row is not None:
            return row
        row = NotificationPreference(id=uuid4(), user_id=user_id)
        self._session.add(row)
        await self._session.flush()
        return row

    async def general_allowed_map(self, user_ids: list[UUID]) -> dict[UUID, bool]:
        if not user_ids:
            return {}
        result = await self._session.execute(
            select(NotificationPreference.user_id, NotificationPreference.general).where(
                NotificationPreference.user_id.in_(user_ids)
            )
        )
        found = {row[0]: bool(row[1]) for row in result.all()}
        return {user_id: found.get(user_id, True) for user_id in user_ids}
