from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from app.core.errors import AppError

GOOGLE_NOTIFICATION_TYPES = {
    1: "SUBSCRIPTION_RECOVERED",
    2: "SUBSCRIPTION_RENEWED",
    3: "SUBSCRIPTION_CANCELED",
    4: "SUBSCRIPTION_PURCHASED",
    5: "SUBSCRIPTION_ON_HOLD",
    6: "SUBSCRIPTION_IN_GRACE_PERIOD",
    7: "SUBSCRIPTION_RESTARTED",
    8: "SUBSCRIPTION_PRICE_CHANGE_CONFIRMED",
    9: "SUBSCRIPTION_DEFERRED",
    10: "SUBSCRIPTION_PAUSED",
    11: "SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED",
    12: "SUBSCRIPTION_REVOKED",
    13: "SUBSCRIPTION_EXPIRED",
    20: "SUBSCRIPTION_PENDING_PURCHASE_CANCELED",
}


class RtdnPermanentError(AppError):
    def __init__(self, message: str, code: str = "WEBHOOK_INVALID") -> None:
        super().__init__(code, message, 400)


@dataclass(frozen=True)
class GoogleRtdn:
    message_id: str
    publish_time: datetime | None
    subscription_name: str | None
    package_name: str
    event_type: str
    product_id: str
    purchase_token: str
    observed_at: datetime | None
    test_notification: bool
    notification_type: int | None


def parse_pubsub_envelope(
    body: dict[str, Any],
    *,
    expected_package: str,
    expected_subscription: str = "",
) -> GoogleRtdn:
    if not isinstance(body, dict):
        raise RtdnPermanentError("Pub/Sub envelope must be an object.")
    message = body.get("message")
    if not isinstance(message, dict):
        raise RtdnPermanentError("Pub/Sub message is missing.")
    message_id = str(message.get("messageId") or message.get("message_id") or "").strip()
    if not message_id:
        raise RtdnPermanentError("Pub/Sub messageId is required.")
    raw_data = message.get("data")
    if not raw_data or not isinstance(raw_data, str):
        raise RtdnPermanentError("Pub/Sub message data is required.")
    subscription_name = body.get("subscription")
    if expected_subscription and subscription_name != expected_subscription:
        raise RtdnPermanentError("Pub/Sub subscription identity does not match.")
    try:
        decoded = base64.b64decode(raw_data, validate=True)
        payload = json.loads(decoded)
    except (ValueError, json.JSONDecodeError) as exc:
        raise RtdnPermanentError("RTDN payload is not valid Base64 JSON.") from exc
    if not isinstance(payload, dict):
        raise RtdnPermanentError("RTDN payload must be an object.")
    package = str(payload.get("packageName") or "")
    if package != expected_package:
        raise RtdnPermanentError("RTDN package does not match this application.")
    publish_time = _parse_time(message.get("publishTime") or message.get("publish_time"))
    event_millis = payload.get("eventTimeMillis")
    observed = _millis(event_millis) or publish_time
    test_notification = "testNotification" in payload
    sub = payload.get("subscriptionNotification") or {}
    voided = payload.get("voidedPurchaseNotification") or {}
    one_time = payload.get("oneTimeProductNotification") or {}
    notification_type = None
    product_id = ""
    purchase_token = ""
    event_type = "UNKNOWN"
    if test_notification and not sub and not voided:
        event_type = "TEST_NOTIFICATION"
    elif isinstance(sub, dict) and sub:
        try:
            notification_type = int(sub.get("notificationType"))
        except (TypeError, ValueError) as exc:
            raise RtdnPermanentError("RTDN notification type is invalid.") from exc
        event_type = GOOGLE_NOTIFICATION_TYPES.get(notification_type, "UNKNOWN")
        product_id = str(sub.get("subscriptionId") or "")
        purchase_token = str(sub.get("purchaseToken") or "")
        if event_type == "UNKNOWN":
            # Still identify the purchase so Developer API can be the source of truth.
            event_type = f"UNKNOWN_{notification_type}"
    elif isinstance(voided, dict) and voided:
        event_type = "VOIDED_PURCHASE"
        purchase_token = str(voided.get("purchaseToken") or "")
    elif isinstance(one_time, dict) and one_time:
        event_type = "ONE_TIME_PRODUCT"
        product_id = str(one_time.get("sku") or "")
        purchase_token = str(one_time.get("purchaseToken") or "")
    if not test_notification and not purchase_token:
        raise RtdnPermanentError("RTDN is missing a purchase token.")
    return GoogleRtdn(
        message_id=message_id,
        publish_time=publish_time,
        subscription_name=str(subscription_name) if subscription_name else None,
        package_name=package,
        event_type=event_type,
        product_id=product_id,
        purchase_token=purchase_token,
        observed_at=observed,
        test_notification=test_notification and not purchase_token,
        notification_type=notification_type,
    )


def _parse_time(value: Any) -> datetime | None:
    if not value:
        return None
    text = str(value).replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed


def _millis(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    try:
        return datetime.fromtimestamp(int(value) / 1000, tz=UTC)
    except (TypeError, ValueError, OSError):
        return None
