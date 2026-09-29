from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.cache import CacheBackend
from app.core.rate_limit import RateLimiter
from app.dependencies.auth import get_cache, get_db, get_limiter
from app.dependencies.notifications import get_notification_service
from app.services.notifications import NotificationService
from app.services.subscriptions import SubscriptionService


def get_subscription_service(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    limiter: Annotated[RateLimiter, Depends(get_limiter)],
    cache: Annotated[CacheBackend, Depends(get_cache)],
    notifications: Annotated[NotificationService, Depends(get_notification_service)],
) -> SubscriptionService:
    return SubscriptionService(
        session=session,
        settings=settings,
        limiter=limiter,
        request_id=getattr(request.state, "request_id", "-"),
        notifications=notifications,
        cache=cache,
    )
