from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.cache import CacheBackend
from app.core.rate_limit import RateLimiter
from app.dependencies.auth import client_ip, get_cache, get_db, get_limiter
from app.services.profile import ProfileService
from app.services.storage import LocalStorageProvider


def get_storage(settings: Annotated[Settings, Depends(get_settings)]) -> LocalStorageProvider:
    return LocalStorageProvider(settings)


def request_base(request: Request) -> str:
    return str(request.base_url).rstrip("/")


def get_profile_service(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    limiter: Annotated[RateLimiter, Depends(get_limiter)],
    cache: Annotated[CacheBackend, Depends(get_cache)],
    storage: Annotated[LocalStorageProvider, Depends(get_storage)],
) -> ProfileService:
    return ProfileService(
        session=session,
        settings=settings,
        limiter=limiter,
        cache=cache,
        storage=storage,
        request_id=getattr(request.state, "request_id", "-"),
        ip=client_ip(request),
        user_agent=request.headers.get("User-Agent"),
        public_base=request_base(request),
    )
