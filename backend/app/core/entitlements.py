from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.models.orm import EntitlementCode, UserEntitlement
from app.repositories.subscriptions import EntitlementRepository

PREMIUM_CODES = frozenset(
    {
        EntitlementCode.PREMIUM.value,
        EntitlementCode.UNLIMITED_LIKES.value,
        EntitlementCode.SEE_LIKES.value,
        EntitlementCode.ADVANCED_FILTERS.value,
        EntitlementCode.BOOSTS.value,
    }
)


class EntitlementService:
    def __init__(self, session: AsyncSession) -> None:
        self._rows = EntitlementRepository(session)

    async def has(self, user_id: UUID, code: str) -> bool:
        row = await self._rows.get(user_id, code)
        return self._is_live(row)

    async def require(self, user_id: UUID, code: str) -> None:
        if not await self.has(user_id, code):
            raise AppError(
                "SUBSCRIPTION_REQUIRED", "This feature requires an active subscription.", 403
            )

    def _is_live(self, row: UserEntitlement | None) -> bool:
        if row is None or not row.active:
            return False
        if row.expires_at is None:
            return True
        expires = row.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=UTC)
        return expires > datetime.now(UTC)
