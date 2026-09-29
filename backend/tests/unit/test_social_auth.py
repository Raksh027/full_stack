import pytest

from app.core.errors import UnauthorizedError
from app.core.social_auth import social_email


def test_social_email_uses_claim() -> None:
    assert social_email("google", {"email": "Ada@Example.com"}) == "ada@example.com"


def test_social_email_apple_fallback() -> None:
    assert (
        social_email("apple", {"sub": "001234.abcd"})
        == "001234.abcd@privaterelay.appleid.com"
    )


def test_social_email_facebook_fallback() -> None:
    assert (
        social_email("facebook", {"id": "999"})
        == "fb_999@privaterelay.boomboom.app"
    )


def test_social_email_google_requires_email() -> None:
    with pytest.raises(UnauthorizedError):
        social_email("google", {})
