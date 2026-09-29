from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import (
    BillingWebhookEvent,
    SubscriptionEvent,
    SubscriptionProduct,
    UserEntitlement,
    UserSubscription,
)


class ProductRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_active(self, platform: str | None = None) -> list[SubscriptionProduct]:
        stmt = select(SubscriptionProduct).where(SubscriptionProduct.active.is_(True))
        if platform:
            stmt = stmt.where(SubscriptionProduct.platform == platform)
        result = await self._session.execute(stmt.order_by(SubscriptionProduct.billing_period))
        return list(result.scalars())

    async def get(self, platform: str, product_id: str) -> SubscriptionProduct | None:
        result = await self._session.execute(
            select(SubscriptionProduct).where(
                SubscriptionProduct.platform == platform,
                SubscriptionProduct.product_id == product_id,
            )
        )
        return result.scalar_one_or_none()


class SubscriptionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, row: UserSubscription) -> UserSubscription:
        self._session.add(row)
        await self._session.flush()
        return row

    async def get(self, subscription_id: UUID) -> UserSubscription | None:
        return await self._session.get(UserSubscription, subscription_id)

    async def get_by_ref(self, platform: str, provider_ref_hash: str) -> UserSubscription | None:
        result = await self._session.execute(
            select(UserSubscription).where(
                UserSubscription.platform == platform,
                UserSubscription.provider_ref_hash == provider_ref_hash,
            )
        )
        return result.scalar_one_or_none()

    async def latest_for_user(self, user_id: UUID) -> UserSubscription | None:
        result = await self._session.execute(
            select(UserSubscription)
            .where(UserSubscription.user_id == user_id)
            .order_by(UserSubscription.updated_at.desc())
        )
        return result.scalars().first()

    async def list_for_user(
        self, user_id: UUID, limit: int, offset: int
    ) -> tuple[list[UserSubscription], int]:
        stmt = select(UserSubscription).where(UserSubscription.user_id == user_id)
        return await self._page(stmt, limit, offset)

    async def list_page(
        self, *, status: str | None, platform: str | None, limit: int, offset: int
    ) -> tuple[list[UserSubscription], int]:
        stmt = select(UserSubscription)
        if status:
            stmt = stmt.where(UserSubscription.status == status)
        if platform:
            stmt = stmt.where(UserSubscription.platform == platform)
        return await self._page(stmt, limit, offset)

    async def _page(
        self, stmt: Select, limit: int, offset: int
    ) -> tuple[list[UserSubscription], int]:
        total = await self._session.scalar(select(func.count()).select_from(stmt.subquery()))
        result = await self._session.execute(
            stmt.order_by(UserSubscription.updated_at.desc()).limit(limit).offset(offset)
        )
        return list(result.scalars()), int(total or 0)


class EntitlementRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, user_id: UUID, code: str) -> UserEntitlement | None:
        result = await self._session.execute(
            select(UserEntitlement).where(
                UserEntitlement.user_id == user_id,
                UserEntitlement.code == code,
            )
        )
        return result.scalar_one_or_none()

    async def list_for_user(self, user_id: UUID) -> list[UserEntitlement]:
        result = await self._session.execute(
            select(UserEntitlement).where(UserEntitlement.user_id == user_id)
        )
        return list(result.scalars())

    async def upsert(
        self,
        *,
        user_id: UUID,
        code: str,
        active: bool,
        expires_at: datetime | None,
        source: str,
        product_id: str | None,
        subscription_id: UUID | None,
    ) -> UserEntitlement:
        row = await self.get(user_id, code)
        if row is None:
            row = UserEntitlement(
                user_id=user_id,
                code=code,
                active=active,
                expires_at=expires_at,
                source=source,
                product_id=product_id,
                subscription_id=subscription_id,
            )
            self._session.add(row)
        else:
            row.active = active
            row.expires_at = expires_at
            row.source = source
            row.product_id = product_id
            row.subscription_id = subscription_id
            row.updated_at = datetime.now(UTC)
        await self._session.flush()
        return row


class SubscriptionEventRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, row: SubscriptionEvent) -> SubscriptionEvent:
        self._session.add(row)
        await self._session.flush()
        return row

    async def exists_provider_event(self, provider_event_id: str) -> bool:
        result = await self._session.execute(
            select(SubscriptionEvent.id).where(
                SubscriptionEvent.provider_event_id == provider_event_id
            )
        )
        return result.scalar_one_or_none() is not None

    async def list_for_user(self, user_id: UUID, limit: int = 40) -> list[SubscriptionEvent]:
        result = await self._session.execute(
            select(SubscriptionEvent)
            .where(SubscriptionEvent.user_id == user_id)
            .order_by(SubscriptionEvent.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars())


class WebhookEventRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, provider: str, event_id: str) -> BillingWebhookEvent | None:
        result = await self._session.execute(
            select(BillingWebhookEvent).where(
                BillingWebhookEvent.provider == provider,
                BillingWebhookEvent.event_id == event_id,
            )
        )
        return result.scalar_one_or_none()

    async def claim(
        self,
        *,
        provider: str,
        event_id: str,
        event_type: str,
        platform: str | None,
        product_id: str | None,
        provider_observed_at: datetime | None,
    ) -> tuple[BillingWebhookEvent, bool]:
        existing = await self.get(provider, event_id)
        if existing is not None:
            return existing, False
        row = BillingWebhookEvent(
            provider=provider,
            event_id=event_id,
            event_type=event_type,
            status="RECEIVED",
            platform=platform,
            product_id=product_id,
            provider_observed_at=provider_observed_at,
        )
        self._session.add(row)
        await self._session.flush()
        return row, True

    async def finish(
        self,
        row: BillingWebhookEvent,
        *,
        status: str,
        processing_result: str,
        error_category: str | None,
        duration_ms: int,
    ) -> None:
        row.status = status
        row.processing_result = processing_result
        row.error_category = error_category
        row.duration_ms = duration_ms
        row.processed_at = datetime.now(UTC)
        await self._session.flush()
