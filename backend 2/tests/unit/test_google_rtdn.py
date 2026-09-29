import base64
import json
from datetime import UTC, datetime

import pytest

from app.services.google_rtdn import RtdnPermanentError, parse_pubsub_envelope


def _envelope(payload: dict, *, message_id="msg-1", subscription="projects/p/subscriptions/play"):
    return {
        "message": {
            "data": base64.b64encode(json.dumps(payload).encode()).decode(),
            "messageId": message_id,
            "publishTime": datetime.now(UTC).isoformat(),
        },
        "subscription": subscription,
    }


def _sub_payload(**extra):
    body = {
        "packageName": "com.boomboomapp.date",
        "eventTimeMillis": "1710000000000",
        "subscriptionNotification": {
            "notificationType": 2,
            "purchaseToken": "token-1",
            "subscriptionId": "com.boomboom.premium.monthly",
        },
    }
    body.update(extra)
    return body


def test_valid_envelope() -> None:
    parsed = parse_pubsub_envelope(
        _envelope(_sub_payload()),
        expected_package="com.boomboomapp.date",
        expected_subscription="projects/p/subscriptions/play",
    )
    assert parsed.message_id == "msg-1"
    assert parsed.event_type == "SUBSCRIPTION_RENEWED"
    assert parsed.purchase_token == "token-1"
    assert parsed.product_id == "com.boomboom.premium.monthly"


def test_malformed_envelope() -> None:
    with pytest.raises(RtdnPermanentError):
        parse_pubsub_envelope({}, expected_package="com.boomboomapp.date")
    with pytest.raises(RtdnPermanentError):
        parse_pubsub_envelope({"message": {}}, expected_package="com.boomboomapp.date")


def test_invalid_base64() -> None:
    body = {"message": {"messageId": "x", "data": "%%%not-base64%%%"}}
    with pytest.raises(RtdnPermanentError):
        parse_pubsub_envelope(body, expected_package="com.boomboomapp.date")


def test_wrong_package() -> None:
    with pytest.raises(RtdnPermanentError):
        parse_pubsub_envelope(_envelope(_sub_payload()), expected_package="com.other.app")


def test_wrong_subscription() -> None:
    with pytest.raises(RtdnPermanentError):
        parse_pubsub_envelope(
            _envelope(_sub_payload()),
            expected_package="com.boomboomapp.date",
            expected_subscription="projects/p/subscriptions/other",
        )


def test_unknown_notification_type_still_has_token() -> None:
    payload = _sub_payload()
    payload["subscriptionNotification"]["notificationType"] = 99
    parsed = parse_pubsub_envelope(_envelope(payload), expected_package="com.boomboomapp.date")
    assert parsed.event_type == "UNKNOWN_99"
    assert parsed.purchase_token == "token-1"


def test_test_notification() -> None:
    parsed = parse_pubsub_envelope(
        _envelope({"packageName": "com.boomboomapp.date", "testNotification": {}}),
        expected_package="com.boomboomapp.date",
    )
    assert parsed.test_notification is True
    assert parsed.event_type == "TEST_NOTIFICATION"
