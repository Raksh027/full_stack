from app.config.settings import Settings
from app.services.razorpay import RazorpayGateway


def _settings(**kwargs) -> Settings:
    return Settings(jwt_secret="replace-with-a-long-random-local-dev-secret", **kwargs)


def test_mock_checkout_signature_accepts_pay_mock() -> None:
    gateway = RazorpayGateway(_settings())
    assert gateway.configured is False
    assert gateway.verify_checkout_signature("order_1", "pay_mock_abc", "mock") is True
    assert gateway.verify_checkout_signature("order_1", "pay_live", "mock") is False


def test_live_checkout_signature() -> None:
    gateway = RazorpayGateway(
        _settings(razorpay_key_id="rzp_test_key", razorpay_key_secret="supersecret")
    )
    order_id = "order_abc"
    payment_id = "pay_abc"
    signature = gateway.checkout_signature(order_id, payment_id)
    assert gateway.verify_checkout_signature(order_id, payment_id, signature) is True
    assert gateway.verify_checkout_signature(order_id, payment_id, "nope") is False


def test_webhook_signature() -> None:
    gateway = RazorpayGateway(_settings(razorpay_webhook_secret="whsec"))
    body = b'{"event":"payment.captured"}'
    import hashlib
    import hmac

    expected = hmac.new(b"whsec", body, hashlib.sha256).hexdigest()
    assert gateway.verify_webhook_signature(body, expected) is True
    assert gateway.verify_webhook_signature(body, "nope") is False
