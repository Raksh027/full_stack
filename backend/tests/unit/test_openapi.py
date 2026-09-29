from fastapi import FastAPI

from app.api.v1.router import api_router
from app.main import OPENAPI_TAGS


def test_openapi_contains_auth_paths() -> None:
    app = FastAPI()
    app.include_router(api_router)
    spec = app.openapi()
    paths = spec["paths"]
    assert "/api/v1/auth/register" in paths
    assert "/api/v1/auth/login" in paths
    assert "/api/v1/auth/refresh" in paths
    assert "/api/v1/auth/logout" in paths
    assert "/api/v1/auth/verify-otp" in paths
    assert "/api/v1/auth/forgot-password" in paths
    assert "/api/v1/auth/reset-password" in paths
    assert "/api/v1/auth/me" in paths
    assert "/api/v1/auth/resend-otp" in paths
    assert "/api/v1/likes" in paths
    assert "/api/v1/favorites" in paths
    assert "/api/v1/matches" in paths
    assert "/api/v1/conversations" in paths
    assert "/api/v1/chat/unread-count" in paths
    assert "/api/v1/verification/status" in paths
    assert "/api/v1/verification/start" in paths
    assert "/api/v1/verification/submit" in paths
    assert "/api/v1/reports" in paths
    assert "/api/v1/events" in paths
    assert "/api/v1/events/{event_id}" in paths
    assert "/api/v1/events/{event_id}/rsvp" in paths
    assert "/api/v1/events/{event_id}/cover" in paths
    assert "/api/v1/events/{event_id}/cover/upload-url" in paths
    assert "/api/v1/admin/dashboard" in paths
    assert "/api/v1/admin/events" in paths
    assert "/api/v1/admin/events/{event_id}" in paths
    assert "/api/v1/subscriptions/catalog" in paths
    assert "/api/v1/subscriptions/verify" in paths
    assert "/api/v1/subscriptions/razorpay/order" in paths
    assert "/api/v1/subscriptions/razorpay/verify" in paths
    assert "/api/v1/entitlements" in paths
    assert "/api/v1/webhooks/google-play" in paths
    assert "/api/v1/webhooks/apple" in paths
    assert "/api/v1/webhooks/razorpay" in paths


def test_openapi_tags_reserved_for_later_phases() -> None:
    names = {tag["name"] for tag in OPENAPI_TAGS}
    assert names == {
        "Authentication",
        "Health",
        "Users",
        "Profiles",
        "Discovery",
        "Matching",
        "Chat",
        "Notifications",
        "Media",
        "Verification",
        "Events",
        "Travel",
        "Tonight",
        "Subscriptions",
        "Safety",
        "Admin",
    }
