import pytest

from app.config import get_settings
from app.core.cache import MemoryCache
from app.core.errors import AppError, RateLimitError
from app.core.otp import OTPService, otp_email_message
from tests.conftest import CapturingOTPProvider


@pytest.mark.asyncio
async def test_otp_verify_success(
    otp_service: OTPService, otp_provider: CapturingOTPProvider
) -> None:
    await otp_service.issue("user@boomboom.app", "signup")
    code = otp_provider.codes["signup:user@boomboom.app"]
    await otp_service.verify("user@boomboom.app", "signup", code)


@pytest.mark.asyncio
async def test_otp_expiry() -> None:
    settings = get_settings()
    cache = MemoryCache()
    service = OTPService(cache, settings, CapturingOTPProvider())
    await service.issue("user@boomboom.app", "signup")
    await cache.delete("otp:signup:user@boomboom.app")
    with pytest.raises(AppError) as exc:
        await service.verify("user@boomboom.app", "signup", "000000")
    assert exc.value.code == "AUTH_OTP_EXPIRED"


@pytest.mark.asyncio
async def test_otp_retry_limit(otp_service: OTPService) -> None:
    await otp_service.issue("user@boomboom.app", "signup")
    for _ in range(get_settings().otp_max_attempts):
        with pytest.raises(AppError) as exc:
            await otp_service.verify("user@boomboom.app", "signup", "000000")
        assert exc.value.code in {"AUTH_OTP_INVALID", "AUTH_OTP_LOCKED"}
    with pytest.raises(AppError) as exc:
        await otp_service.verify("user@boomboom.app", "signup", "000000")
    assert exc.value.code in {"AUTH_OTP_LOCKED", "AUTH_OTP_EXPIRED"}


def test_otp_email_copy() -> None:
    subject, body = otp_email_message("user@boomboom.app", "4821", "login", 5)
    assert subject == "4821 is your BoomBoom code"
    assert "4821" in body
    assert "4-digit" in body
    assert "5 minutes" in body
    assert "confirm your new email" in otp_email_message(
        "user@boomboom.app", "4821", "email_change", 5
    )[1]


@pytest.mark.asyncio
async def test_otp_resend_cooldown(otp_service: OTPService) -> None:
    await otp_service.issue("user@boomboom.app", "signup")
    with pytest.raises(RateLimitError):
        await otp_service.issue("user@boomboom.app", "signup")
