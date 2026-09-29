from app.core.cache import CacheBackend
from app.core.errors import RateLimitError

# Named policies for this phase's infrastructure and later feature endpoints.
# Production and development use these values. Staging may override auth only.
RATE_LIMIT_POLICIES: dict[str, tuple[int, int]] = {
    "registration": (5, 3600),
    "login": (10, 900),
    "otp_generation": (5, 3600),
    "otp_verification": (10, 900),
    "forgot_password": (5, 3600),
    "profile_changes": (20, 3600),
    "discovery": (120, 60),
    "likes": (60, 60),
    "chat_requests": (20, 60),
    "messages": (40, 60),
    "reports": (10, 3600),
    "device_register": (40, 3600),
    "device_delete": (30, 3600),
    "notification_read": (60, 60),
    "notification_list": (60, 60),
    "notification_test": (5, 3600),
    "verification_start": (5, 3600),
    "verification_submit": (8, 3600),
    "verification_cancel": (10, 3600),
    "verification_retry": (3, 86400),
    "verification_status": (60, 60),
    "verification_review": (120, 3600),
    "admin_moderate": (60, 3600),
    "subscription_catalog": (60, 60),
    "subscription_me": (60, 60),
    "subscription_history": (30, 60),
    "subscription_verify": (20, 3600),
    "subscription_order": (20, 3600),
    "subscription_restore": (20, 3600),
    "entitlements": (60, 60),
    "events_list": (60, 60),
    "events_mutate": (20, 3600),
    "events_rsvp": (40, 60),
}

# Server-side only. Applied when Settings.app_env == staging. Not request-controlled.
STAGING_AUTH_RATE_LIMIT_POLICIES: dict[str, tuple[int, int]] = {
    "registration": (20, 600),
    "login": (30, 600),
}


def resolve_rate_limit_policy(name: str, *, is_staging: bool) -> tuple[int, int]:
    default = RATE_LIMIT_POLICIES[name]
    if is_staging and name in STAGING_AUTH_RATE_LIMIT_POLICIES:
        return STAGING_AUTH_RATE_LIMIT_POLICIES[name]
    return default


class RateLimiter:
    def __init__(self, cache: CacheBackend) -> None:
        self._cache = cache

    async def hit(self, key: str, limit: int, window_seconds: int) -> None:
        namespaced = f"rl:{key}"
        count = await self._cache.incr(namespaced)
        if count == 1:
            await self._cache.expire(namespaced, window_seconds)
        if count > limit:
            raise RateLimitError("Too many requests. Try again later.")
