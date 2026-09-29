import pytest

from app.config import get_settings
from app.core.cache import MemoryCache
from app.core.otp import MockOTPProvider, OTPService
from app.core.rate_limit import RateLimiter

pytest_plugins = ["tests.isolation"]


class CapturingOTPProvider(MockOTPProvider):
    def __init__(self) -> None:
        self.codes: dict[str, str] = {}

    async def deliver(self, destination: str, code: str, purpose: str) -> None:
        self.codes[f"{purpose}:{destination.lower()}"] = code
        await super().deliver(destination, code, purpose)


@pytest.fixture
def cache() -> MemoryCache:
    return MemoryCache()


@pytest.fixture
def otp_provider() -> CapturingOTPProvider:
    return CapturingOTPProvider()


@pytest.fixture
def otp_service(cache: MemoryCache, otp_provider: CapturingOTPProvider) -> OTPService:
    return OTPService(cache, get_settings(), otp_provider)


@pytest.fixture
def limiter(cache: MemoryCache) -> RateLimiter:
    return RateLimiter(cache)
