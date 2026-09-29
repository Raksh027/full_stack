from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.rate_limit import RateLimiter
from app.dependencies.auth import get_db, get_limiter
from app.dependencies.notifications import get_notification_service
from app.dependencies.profile import get_storage, request_base
from app.services.events import SocialEventService
from app.services.notifications import NotificationService
from app.services.storage import LocalStorageProvider


def get_event_service(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    limiter: Annotated[RateLimiter, Depends(get_limiter)],
    storage: Annotated[LocalStorageProvider, Depends(get_storage)],
    notifications: Annotated[NotificationService, Depends(get_notification_service)],
) -> SocialEventService:
    return SocialEventService(
        session=session,
        settings=settings,
        limiter=limiter,
        request_id=getattr(request.state, "request_id", "-"),
        storage=storage,
        public_base=request_base(request),
        notifications=notifications,
    )
