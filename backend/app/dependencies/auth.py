from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.cache import CacheBackend, RedisCache
from app.core.errors import UnauthorizedError
from app.core.jobs import RedisJobQueue
from app.core.otp import MockOTPProvider, OTPService, SmtpOTPProvider
from app.core.push import build_push_provider
from app.core.rate_limit import RateLimiter
from app.core.realtime import ConnectionHub, PresenceStore, RedisBroker
from app.db.session import create_engine, create_session_factory
from app.models.orm import User
from app.services.auth import AuthService

bearer = HTTPBearer(auto_error=False)


def get_cache(request: Request) -> CacheBackend:
    return request.app.state.cache


def get_limiter(cache: Annotated[CacheBackend, Depends(get_cache)]) -> RateLimiter:
    return RateLimiter(cache)


def get_otp(
    cache: Annotated[CacheBackend, Depends(get_cache)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> OTPService:
    provider = SmtpOTPProvider(settings) if settings.smtp_enabled else MockOTPProvider()
    return OTPService(cache, settings, provider)


async def get_db(request: Request) -> AsyncIterator[AsyncSession]:
    factory = request.app.state.session_factory
    async with factory() as session:
        yield session


def client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def get_auth_service(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    otp: Annotated[OTPService, Depends(get_otp)],
    limiter: Annotated[RateLimiter, Depends(get_limiter)],
    cache: Annotated[CacheBackend, Depends(get_cache)],
) -> AuthService:
    return AuthService(
        session=session,
        settings=settings,
        otp=otp,
        limiter=limiter,
        cache=cache,
        request_id=getattr(request.state, "request_id", "-"),
        ip=client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )


@dataclass
class CurrentAuth:
    user: User
    service: AuthService


async def get_current_auth(
    request: Request,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
    otp: Annotated[OTPService, Depends(get_otp)],
    limiter: Annotated[RateLimiter, Depends(get_limiter)],
    cache: Annotated[CacheBackend, Depends(get_cache)],
) -> AsyncIterator[CurrentAuth]:
    if creds is None or creds.scheme.lower() != "bearer":
        raise UnauthorizedError()
    factory = request.app.state.session_factory
    async with factory() as session:
        service = AuthService(
            session=session,
            settings=settings,
            otp=otp,
            limiter=limiter,
            cache=cache,
            request_id=getattr(request.state, "request_id", "-"),
            ip=client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
        user = await service.resolve_user(creds.credentials)
        yield CurrentAuth(user=user, service=service)


async def get_current_user(
    current: Annotated[CurrentAuth, Depends(get_current_auth)],
) -> User:
    return current.user


def init_runtime(app, settings: Settings) -> None:
    engine = create_engine(settings)
    app.state.engine = engine
    app.state.session_factory = create_session_factory(engine)
    app.state.redis = Redis.from_url(settings.redis_url, decode_responses=False)
    app.state.cache = RedisCache(app.state.redis)
    app.state.broker = RedisBroker(app.state.redis)
    app.state.hub = ConnectionHub()
    app.state.presence = PresenceStore(app.state.cache)
    app.state.jobs = RedisJobQueue(app.state.redis)
    app.state.push = build_push_provider(settings)


async def shutdown_runtime(app) -> None:
    redis: Redis | None = getattr(app.state, "redis", None)
    if redis is not None:
        await redis.aclose()
    engine = getattr(app.state, "engine", None)
    if engine is not None:
        await engine.dispose()
