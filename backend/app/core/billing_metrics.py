from __future__ import annotations

import threading
from collections import Counter

_lock = threading.Lock()
_counts: Counter[str] = Counter()

SAFE_NAMES = frozenset(
    {
        "google_rtdn_processed",
        "google_rtdn_failed",
        "apple_notification_processed",
        "apple_notification_failed",
        "purchase_verification_success",
        "purchase_verification_failure",
        "entitlement_grant",
        "entitlement_revoke",
        "duplicate_event",
        "provider_timeout",
        "webhook_stale",
        "razorpay_webhook_processed",
        "razorpay_webhook_failed",
        "webhook_processed",
        "webhook_failed",
    }
)


def increment(name: str, amount: int = 1) -> None:
    key = name if name in SAFE_NAMES else "unknown"
    with _lock:
        _counts[key] += amount


def snapshot() -> dict[str, int]:
    with _lock:
        return dict(_counts)


def reset_for_tests() -> None:
    with _lock:
        _counts.clear()
