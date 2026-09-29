import pytest

from app.core.account_delete import normalize_delete_reason
from app.core.cache import MemoryCache
from app.core.errors import AppError
from app.core.otp import OTPService
from app.config import get_settings
from tests.conftest import CapturingOTPProvider


def test_delete_reason_must_be_known() -> None:
    assert normalize_delete_reason("privacy") == ("privacy", None)
    with pytest.raises(AppError) as missing:
        normalize_delete_reason("  ")
    assert missing.value.code == "VALIDATION_ERROR"
    with pytest.raises(AppError) as invalid:
        normalize_delete_reason("spam")
    assert invalid.value.code == "VALIDATION_ERROR"


def test_other_reason_requires_details() -> None:
    with pytest.raises(AppError) as missing:
        normalize_delete_reason("other")
    assert missing.value.code == "VALIDATION_ERROR"
    assert normalize_delete_reason("other", "  Too many notifications  ") == (
        "other",
        "Too many notifications",
    )
    assert normalize_delete_reason("privacy", "ignored") == ("privacy", None)


@pytest.mark.asyncio
async def test_otp_clear_removes_all_purposes() -> None:
    cache = MemoryCache()
    settings = get_settings()
    otp = OTPService(cache, settings, CapturingOTPProvider())
    await otp.issue("gone@boomboom.app", "login")
    await otp.clear_destination("gone@boomboom.app")
    assert await cache.get("otp:login:gone@boomboom.app") is None
    assert await cache.get("otp-cd:login:gone@boomboom.app") is None
