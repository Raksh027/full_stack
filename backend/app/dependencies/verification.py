from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.rate_limit import RateLimiter
from app.dependencies.auth import client_ip, get_db, get_limiter
from app.dependencies.notifications import get_notification_service
from app.dependencies.profile import get_storage
from app.services.notifications import NotificationService
from app.services.storage import LocalStorageProvider
from app.services.verification import VerificationReviewService, VerificationService
from app.services.verification_provider import MockVerificationProvider, VerificationProvider


def get_verification_provider(request: Request) -> VerificationProvider:
    existing = getattr(request.app.state, "verification_provider", None)
    if existing is not None:
        return existing
    provider = MockVerificationProvider()
    request.app.state.verification_provider = provider
    return provider


def get_verification_service(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    limiter: Annotated[RateLimiter, Depends(get_limiter)],
    storage: Annotated[LocalStorageProvider, Depends(get_storage)],
    provider: Annotated[VerificationProvider, Depends(get_verification_provider)],
    notifications: Annotated[NotificationService, Depends(get_notification_service)],
) -> VerificationService:
    return VerificationService(
        session=session,
        settings=settings,
        limiter=limiter,
        storage=storage,
        provider=provider,
        request_id=getattr(request.state, "request_id", "-"),
        ip=client_ip(request),
        user_agent=request.headers.get("User-Agent"),
        notifications=notifications,
    )


def get_verification_review_service(
    service: Annotated[VerificationService, Depends(get_verification_service)],
) -> VerificationReviewService:
    return VerificationReviewService(service)
