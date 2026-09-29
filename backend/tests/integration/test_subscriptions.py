import base64
import json
from datetime import UTC, datetime, timedelta

import pytest

from tests.isolation import IsolatedApp

pytestmark = pytest.mark.integration


@pytest.fixture
async def env(isolated_app: IsolatedApp):
    yield isolated_app


async def _register(env: IsolatedApp, prefix: str = "sub"):
    email = f"{prefix}.{__import__('uuid').uuid4().hex[:10]}@boomboom.app"
    register = await env.http.post(
        "/api/v1/auth/register", json={"email": email, "password": "password12"}
    )
    assert register.status_code == 201
    code = env.otp.codes["signup:" + email]
    verified = await env.http.post("/api/v1/auth/verify-otp", json={"email": email, "otp": code})
    token = verified.json()["data"]["accessToken"]
    user_id = verified.json()["data"]["userId"]
    return {"Authorization": f"Bearer {token}"}, user_id


def _rtdn(
    token: str,
    message_id: str,
    *,
    notification_type: int = 2,
    package: str = "com.boomboomapp.date",
    event_ms: int | None = None,
):
    payload = {
        "packageName": package,
        "eventTimeMillis": str(event_ms or int(datetime.now(UTC).timestamp() * 1000)),
        "subscriptionNotification": {
            "notificationType": notification_type,
            "purchaseToken": token,
            "subscriptionId": "com.boomboom.premium.monthly",
        },
    }
    return {
        "message": {
            "data": base64.b64encode(json.dumps(payload).encode()).decode(),
            "messageId": message_id,
            "publishTime": datetime.now(UTC).isoformat(),
        },
        "subscription": "projects/test/subscriptions/play-rtdn",
    }


def _token(
    *,
    txn: str,
    product: str = "com.boomboom.premium.monthly",
    status: str = "ACTIVE",
    app="com.boomboomapp.date",
):
    return json.dumps(
        {
            "valid": True,
            "productId": product,
            "applicationId": app,
            "status": status,
            "expiresAt": (datetime.now(UTC) + timedelta(days=30)).isoformat(),
            "transactionId": txn,
            "autoRenewing": True,
        }
    )


async def test_catalog_and_verify_and_entitlements(env, monkeypatch) -> None:
    monkeypatch.setenv("SUBSCRIPTION_VERIFY_MODE", "mock")
    headers, _ = await _register(env, "own")
    catalog = await env.http.get("/api/v1/subscriptions/catalog", headers=headers)
    assert catalog.status_code == 200
    products = [item["productId"] for item in catalog.json()["data"]["items"]]
    assert "com.boomboom.premium.monthly" in products
    proof = {
        "platform": "GOOGLE",
        "productId": "com.boomboom.premium.monthly",
        "purchaseToken": _token(txn="txn-owner"),
        "applicationId": "com.boomboomapp.date",
    }
    verified = await env.http.post("/api/v1/subscriptions/verify", headers=headers, json=proof)
    assert verified.status_code == 200
    assert verified.json()["data"]["subscription"]["active"] is True
    again = await env.http.post("/api/v1/subscriptions/verify", headers=headers, json=proof)
    assert again.status_code == 200
    entitlements = await env.http.get("/api/v1/entitlements", headers=headers)
    codes = {item["code"] for item in entitlements.json()["data"]["items"] if item["active"]}
    assert "PREMIUM" in codes
    assert "SEE_LIKES" in codes
    incoming = await env.http.get("/api/v1/likes/incoming", headers=headers)
    assert incoming.status_code == 200
    assert incoming.json()["data"].get("gated") is not True


async def test_invalid_and_reuse_and_webhook(env, monkeypatch) -> None:
    monkeypatch.setenv("SUBSCRIPTION_VERIFY_MODE", "mock")
    monkeypatch.setenv("GOOGLE_PLAY_WEBHOOK_SECRET", "hook-secret")
    from app.config import get_settings

    get_settings.cache_clear()
    a, _ = await _register(env, "aa")
    b, _ = await _register(env, "bb")
    bad = await env.http.post(
        "/api/v1/subscriptions/verify",
        headers=a,
        json={
            "platform": "GOOGLE",
            "productId": "com.boomboom.premium.monthly",
            "purchaseToken": "mock_invalid",
        },
    )
    assert bad.status_code == 400
    token = _token(txn="shared-txn")
    first = await env.http.post(
        "/api/v1/subscriptions/verify",
        headers=a,
        json={
            "platform": "GOOGLE",
            "productId": "com.boomboom.premium.monthly",
            "purchaseToken": token,
        },
    )
    assert first.status_code == 200
    stolen = await env.http.post(
        "/api/v1/subscriptions/verify",
        headers=b,
        json={
            "platform": "GOOGLE",
            "productId": "com.boomboom.premium.monthly",
            "purchaseToken": token,
        },
    )
    assert stolen.status_code == 409
    denied = await env.http.post(
        "/api/v1/webhooks/google-play",
        json=_rtdn(token, "evt-1"),
    )
    assert denied.status_code == 401
    hooked = await env.http.post(
        "/api/v1/webhooks/google-play",
        headers={"X-Webhook-Secret": "hook-secret"},
        json=_rtdn(token, "evt-1"),
    )
    assert hooked.status_code == 200
    assert hooked.json()["data"]["matched"] is True
    replay = await env.http.post(
        "/api/v1/webhooks/google-play",
        headers={"X-Webhook-Secret": "hook-secret"},
        json=_rtdn(token, "evt-1"),
    )
    assert replay.json()["data"]["duplicate"] is True
    malformed = await env.http.post(
        "/api/v1/webhooks/google-play",
        headers={"X-Webhook-Secret": "hook-secret"},
        json={"message": {"messageId": "bad", "data": "%%%"}},
    )
    assert malformed.status_code == 200
    assert malformed.json()["data"]["accepted"] is False
    wrong_pkg = await env.http.post(
        "/api/v1/webhooks/google-play",
        headers={"X-Webhook-Secret": "hook-secret"},
        json=_rtdn(token, "evt-pkg", package="com.other.app"),
    )
    assert wrong_pkg.status_code == 200
    assert wrong_pkg.json()["data"]["accepted"] is False
    other = await env.http.get("/api/v1/subscriptions/me", headers=b)
    assert other.json()["data"]["subscription"] is None
    get_settings.cache_clear()


async def test_incoming_likes_gated_without_premium(env) -> None:
    headers, _ = await _register(env, "free")
    incoming = await env.http.get("/api/v1/likes/incoming", headers=headers)
    assert incoming.status_code == 200
    assert incoming.json()["data"]["gated"] is True
    assert incoming.json()["data"]["items"] == []


async def test_admin_subscription_read_only(env, monkeypatch) -> None:
    monkeypatch.setenv("SUBSCRIPTION_VERIFY_MODE", "mock")
    headers, user_id = await _register(env, "adm")
    listed = await env.http.get("/api/v1/admin/subscriptions", headers=headers)
    assert listed.status_code == 403
    detail = await env.http.get(f"/api/v1/admin/users/{user_id}/subscription", headers=headers)
    assert detail.status_code == 403


async def test_webhook_lifecycle_and_ordering(env, monkeypatch) -> None:
    monkeypatch.setenv("SUBSCRIPTION_VERIFY_MODE", "mock")
    monkeypatch.setenv("GOOGLE_PLAY_WEBHOOK_SECRET", "hook-secret")
    from app.config import get_settings

    get_settings.cache_clear()
    headers, _ = await _register(env, "life")
    active = _token(txn="life-txn")
    verified = await env.http.post(
        "/api/v1/subscriptions/verify",
        headers=headers,
        json={
            "platform": "GOOGLE",
            "productId": "com.boomboom.premium.monthly",
            "purchaseToken": active,
        },
    )
    assert verified.status_code == 200
    cancelled = json.dumps(
        {
            "valid": True,
            "productId": "com.boomboom.premium.monthly",
            "applicationId": "com.boomboomapp.date",
            "status": "CANCELLED",
            "expiresAt": (datetime.now(UTC) + timedelta(days=20)).isoformat(),
            "transactionId": "life-txn",
            "cancelled": True,
            "autoRenewing": False,
        }
    )
    now_ms = int(datetime.now(UTC).timestamp() * 1000)
    cancel_hook = await env.http.post(
        "/api/v1/webhooks/google-play",
        headers={"X-Webhook-Secret": "hook-secret"},
        json=_rtdn(cancelled, "life-cancel", notification_type=3, event_ms=now_ms),
    )
    assert cancel_hook.status_code == 200
    me = await env.http.get("/api/v1/subscriptions/me", headers=headers)
    assert me.json()["data"]["subscription"]["status"] == "CANCELLED"
    assert me.json()["data"]["subscription"]["active"] is True
    expired = json.dumps(
        {
            "valid": True,
            "productId": "com.boomboom.premium.monthly",
            "applicationId": "com.boomboomapp.date",
            "status": "EXPIRED",
            "expiresAt": (datetime.now(UTC) - timedelta(days=1)).isoformat(),
            "transactionId": "life-txn",
        }
    )
    expire_hook = await env.http.post(
        "/api/v1/webhooks/google-play",
        headers={"X-Webhook-Secret": "hook-secret"},
        json=_rtdn(expired, "life-expire", notification_type=13, event_ms=now_ms + 5000),
    )
    assert expire_hook.status_code == 200
    entitlements = await env.http.get("/api/v1/entitlements", headers=headers)
    assert all(not item["active"] for item in entitlements.json()["data"]["items"])
    stale = await env.http.post(
        "/api/v1/webhooks/google-play",
        headers={"X-Webhook-Secret": "hook-secret"},
        json=_rtdn(cancelled, "life-stale", notification_type=3, event_ms=now_ms - 50_000),
    )
    assert stale.status_code == 200
    assert stale.json()["data"].get("stale") is True
    later = await env.http.get("/api/v1/subscriptions/me", headers=headers)
    assert later.json()["data"]["subscription"]["status"] == "EXPIRED"
    revoked = json.dumps(
        {
            "valid": True,
            "productId": "com.boomboom.premium.monthly",
            "applicationId": "com.boomboomapp.date",
            "status": "REVOKED",
            "transactionId": "life-txn",
        }
    )
    revoke_hook = await env.http.post(
        "/api/v1/webhooks/google-play",
        headers={"X-Webhook-Secret": "hook-secret"},
        json=_rtdn(revoked, "life-revoke", notification_type=12, event_ms=now_ms + 8000),
    )
    assert revoke_hook.status_code == 200
    get_settings.cache_clear()


async def test_webhook_transient_google_failure(env, monkeypatch) -> None:
    monkeypatch.setenv("SUBSCRIPTION_VERIFY_MODE", "mock")
    monkeypatch.setenv("GOOGLE_PLAY_WEBHOOK_SECRET", "hook-secret")
    from app.config import get_settings
    from app.core.errors import ProviderTransientError
    from app.services.billing_providers import MockStoreVerificationProvider

    get_settings.cache_clear()
    headers, _ = await _register(env, "tmp")
    token = _token(txn="tmp-txn")
    await env.http.post(
        "/api/v1/subscriptions/verify",
        headers=headers,
        json={
            "platform": "GOOGLE",
            "productId": "com.boomboom.premium.monthly",
            "purchaseToken": token,
        },
    )
    original = MockStoreVerificationProvider.verify

    async def fail(self, **kwargs):
        raise ProviderTransientError("Google Play Developer API timed out.")

    monkeypatch.setattr(MockStoreVerificationProvider, "verify", fail)
    failed = await env.http.post(
        "/api/v1/webhooks/google-play",
        headers={"X-Webhook-Secret": "hook-secret"},
        json=_rtdn(token, "tmp-fail"),
    )
    assert failed.status_code == 503
    monkeypatch.setattr(MockStoreVerificationProvider, "verify", original)
    retry = await env.http.post(
        "/api/v1/webhooks/google-play",
        headers={"X-Webhook-Secret": "hook-secret"},
        json=_rtdn(token, "tmp-fail"),
    )
    assert retry.status_code == 200
    assert retry.json()["data"].get("duplicate") is not True
    assert retry.json()["data"].get("accepted") is True
    get_settings.cache_clear()


async def test_razorpay_order_verify_and_webhook(env, monkeypatch) -> None:
    monkeypatch.setenv("SUBSCRIPTION_VERIFY_MODE", "mock")
    headers, user_id = await _register(env, "rzp")
    plans = await env.http.get("/api/v1/subscriptions/plans", headers=headers)
    assert plans.status_code == 200
    product_id = next(
        item["storeProductId"]
        for item in plans.json()["data"]
        if "monthly" in item["storeProductId"]
    )
    assert product_id == "boomboom_premium_monthly"
    order = await env.http.post(
        "/api/v1/subscriptions/razorpay/order",
        headers=headers,
        json={"productId": product_id},
    )
    assert order.status_code == 200
    payload = order.json()["data"]
    assert payload["mockCheckout"] is True
    assert payload["amount"] == 49900
    verified = await env.http.post(
        "/api/v1/subscriptions/razorpay/verify",
        headers=headers,
        json={
            "productId": product_id,
            "orderId": payload["orderId"],
            "paymentId": "pay_mock_checkout",
            "signature": "mock",
        },
    )
    assert verified.status_code == 200
    assert verified.json()["data"]["tier"] == "plus"
    hook = await env.http.post(
        "/api/v1/webhooks/razorpay",
        json={
            "id": "evt_rzp_1",
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_mock_hook",
                        "order_id": payload["orderId"],
                        "status": "captured",
                        "captured": True,
                        "notes": {
                            "userId": user_id,
                            "productId": product_id,
                            "billingPeriod": "P1M",
                            "amountPaise": "49900",
                        },
                    }
                }
            },
        },
    )
    assert hook.status_code == 200
    assert hook.json()["data"]["accepted"] is True
