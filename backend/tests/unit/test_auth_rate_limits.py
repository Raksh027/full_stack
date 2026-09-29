import asyncio

import pytest
from pydantic import ValidationError

from app.config import AppEnv, Settings
from app.core.cache import MemoryCache
from app.core.errors import RateLimitError
from app.core.rate_limit import (
    RATE_LIMIT_POLICIES,
    STAGING_AUTH_RATE_LIMIT_POLICIES,
    RateLimiter,
    resolve_rate_limit_policy,
)
from app.schemas.auth import LoginRequest, RegisterRequest

_JWT = "replace-with-a-long-random-local-dev-secret"


def _settings(env: AppEnv) -> Settings:
    return Settings(app_env=env, jwt_secret=_JWT)


def test_staging_register_policy() -> None:
    assert _settings(AppEnv.STAGING).rate_limit_policy("registration") == (20, 600)
    assert STAGING_AUTH_RATE_LIMIT_POLICIES["registration"] == (20, 600)


def test_staging_login_policy() -> None:
    assert _settings(AppEnv.STAGING).rate_limit_policy("login") == (30, 600)
    assert STAGING_AUTH_RATE_LIMIT_POLICIES["login"] == (30, 600)


@pytest.mark.parametrize("env", [AppEnv.PRODUCTION, AppEnv.DEVELOPMENT])
def test_non_staging_register_policy(env: AppEnv) -> None:
    assert _settings(env).rate_limit_policy("registration") == (5, 3600)
    assert RATE_LIMIT_POLICIES["registration"] == (5, 3600)


@pytest.mark.parametrize("env", [AppEnv.PRODUCTION, AppEnv.DEVELOPMENT])
def test_non_staging_login_policy(env: AppEnv) -> None:
    assert _settings(env).rate_limit_policy("login") == (10, 900)
    assert RATE_LIMIT_POLICIES["login"] == (10, 900)


def test_staging_does_not_override_non_auth_policies() -> None:
    staging = _settings(AppEnv.STAGING)
    production = _settings(AppEnv.PRODUCTION)
    assert staging.rate_limit_policy("otp_generation") == production.rate_limit_policy(
        "otp_generation"
    )
    assert staging.rate_limit_policy("forgot_password") == RATE_LIMIT_POLICIES[
        "forgot_password"
    ]


@pytest.mark.asyncio
async def test_21st_staging_register_hit_is_rejected() -> None:
    limiter = RateLimiter(MemoryCache())
    limit, window = _settings(AppEnv.STAGING).rate_limit_policy("registration")
    assert (limit, window) == (20, 600)
    for _ in range(20):
        await limiter.hit("register:10.0.0.1", limit, window)
    with pytest.raises(RateLimitError) as exc:
        await limiter.hit("register:10.0.0.1", limit, window)
    assert exc.value.status_code == 429
    assert exc.value.code == "AUTH_RATE_LIMITED"


@pytest.mark.asyncio
async def test_31st_staging_login_hit_is_rejected() -> None:
    limiter = RateLimiter(MemoryCache())
    limit, window = _settings(AppEnv.STAGING).rate_limit_policy("login")
    assert (limit, window) == (30, 600)
    for _ in range(30):
        await limiter.hit("login:10.0.0.1", limit, window)
    with pytest.raises(RateLimitError) as exc:
        await limiter.hit("login:10.0.0.1", limit, window)
    assert exc.value.status_code == 429
    assert exc.value.code == "AUTH_RATE_LIMITED"


def test_client_cannot_supply_app_env_on_auth_bodies() -> None:
    register = RegisterRequest.model_validate(
        {
            "email": "qa@example.com",
            "password": "password12",
            "app_env": "staging",
            "APP_ENV": "staging",
        }
    )
    login = LoginRequest.model_validate(
        {
            "email": "qa@example.com",
            "password": "password12",
            "app_env": "staging",
        }
    )
    assert "app_env" not in RegisterRequest.model_fields
    assert "app_env" not in LoginRequest.model_fields
    dumped = register.model_dump()
    assert "app_env" not in dumped
    assert "APP_ENV" not in dumped
    assert "app_env" not in login.model_dump()


def test_request_claimed_env_does_not_change_server_policy() -> None:
    server = _settings(AppEnv.PRODUCTION)
    client_claimed_staging = "staging"
    # Limits come only from server Settings.app_env, never from request data.
    assert client_claimed_staging == "staging"
    assert server.rate_limit_policy("registration") == (5, 3600)
    assert server.rate_limit_policy("login") == (10, 900)
    assert resolve_rate_limit_policy("registration", is_staging=False) == (5, 3600)


def test_settings_rejects_unknown_app_env() -> None:
    with pytest.raises(ValidationError):
        Settings(app_env="not-an-env", jwt_secret=_JWT)


class _AtomicMemoryCache(MemoryCache):
    """INCR analog: serialize counter updates like Redis INCR."""

    def __init__(self) -> None:
        super().__init__()
        self._lock = asyncio.Lock()

    async def incr(self, key: str) -> int:
        async with self._lock:
            return await super().incr(key)


@pytest.mark.asyncio
async def test_rate_limiter_incr_is_atomic_under_concurrency() -> None:
    cache = _AtomicMemoryCache()
    limiter = RateLimiter(cache)
    limit, window = 30, 600
    results: list[str] = []

    async def one_hit() -> None:
        try:
            await limiter.hit("login:concurrent", limit, window)
            results.append("ok")
        except RateLimitError:
            results.append("limited")

    await asyncio.gather(*[one_hit() for _ in range(40)])
    assert results.count("ok") == 30
    assert results.count("limited") == 10
    assert int(cache._data["rl:login:concurrent"]) == 40
