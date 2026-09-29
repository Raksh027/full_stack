from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.cache import CacheBackend
from app.core.rate_limit import RateLimiter
from app.dependencies.auth import get_cache, get_db, get_limiter
from app.services.discovery import DiscoveryService


def get_discovery_service(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    limiter: Annotated[RateLimiter, Depends(get_limiter)],
    cache: Annotated[CacheBackend, Depends(get_cache)],
) -> DiscoveryService:
    _ = cache
    return DiscoveryService(
        session=session,
        settings=settings,
        limiter=limiter,
        request_id=getattr(request.state, "request_id", "-"),
    )
