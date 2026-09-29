from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.rate_limit import RateLimiter
from app.dependencies.auth import client_ip, get_db, get_limiter
from app.dependencies.profile import get_storage
from app.dependencies.verification import get_verification_review_service
from app.services.admin import AdminService
from app.services.reports import ReportService
from app.services.storage import LocalStorageProvider
from app.services.verification import VerificationReviewService


def get_report_service(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    limiter: Annotated[RateLimiter, Depends(get_limiter)],
) -> ReportService:
    return ReportService(
        session=session,
        settings=settings,
        limiter=limiter,
        request_id=getattr(request.state, "request_id", "-"),
        ip=client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )


def get_admin_service(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    limiter: Annotated[RateLimiter, Depends(get_limiter)],
    storage: Annotated[LocalStorageProvider, Depends(get_storage)],
    review: Annotated[VerificationReviewService, Depends(get_verification_review_service)],
) -> AdminService:
    return AdminService(
        session=session,
        settings=settings,
        limiter=limiter,
        storage=storage,
        review=review,
        request_id=getattr(request.state, "request_id", "-"),
        ip=client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
