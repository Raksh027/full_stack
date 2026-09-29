import pytest

from app.config import get_settings
from app.core.cache import MemoryCache
from app.core.errors import RateLimitError
from app.core.rate_limit import RateLimiter
from app.core.security import create_access_token, decode_token, hash_password, verify_password


@pytest.mark.asyncio
async def test_password_hash_roundtrip() -> None:
    hashed = hash_password("password1")
    assert hashed != "password1"
    assert verify_password("password1", hashed)
    assert not verify_password("wrong-pass", hashed)


def test_jwt_roundtrip() -> None:
    settings = get_settings()
    token, expires = create_access_token(settings, "user-1", "session-1")
    payload = decode_token(settings, token)
    assert payload["sub"] == "user-1"
    assert payload["sid"] == "session-1"
    assert payload["typ"] == "access"
    assert expires.tzinfo is not None


@pytest.mark.asyncio
async def test_rate_limiter_blocks_after_limit() -> None:
    limiter = RateLimiter(MemoryCache())
    await limiter.hit("login:1", 2, 60)
    await limiter.hit("login:1", 2, 60)
    with pytest.raises(RateLimitError):
        await limiter.hit("login:1", 2, 60)
