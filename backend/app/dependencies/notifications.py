from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.rate_limit import RateLimiter
from app.core.realtime import PresenceStore
from app.dependencies.auth import get_db, get_limiter
from app.services.notifications import NotificationService


def get_notification_service(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    limiter: Annotated[RateLimiter, Depends(get_limiter)],
) -> NotificationService:
    presence = getattr(request.app.state, "presence", None)
    if presence is None and hasattr(request.app.state, "cache"):
        presence = PresenceStore(request.app.state.cache)
    return NotificationService(
        session=session,
        settings=settings,
        limiter=limiter,
        request_id=getattr(request.state, "request_id", "-"),
        jobs=getattr(request.app.state, "jobs", None),
        presence=presence,
        broker=getattr(request.app.state, "broker", None),
    )
