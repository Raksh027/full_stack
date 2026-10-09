from fastapi import APIRouter

from app.api.v1 import (
    admin,
    auth,
    conversations,
    discovery,
    events,
    favorites,
    interests,
    likes,
    matches,
    media,
    mobile,
    notifications,
    profile,
    reports,
    safety,
    subscriptions,
    verification,
    webhooks,
)
from app.config import Settings, get_settings
from app.websocket import chat as chat_ws


def create_api_router(settings: Settings) -> APIRouter:
    """Build the versioned API router for the given Settings.

    The development-only OTP peek route (GET /auth/dev/otp) is included only
    when ``settings.is_production`` is False.  Always call this function with
    the runtime Settings instance so the correct set of routes is registered.
    In production no dev route is visible in the OpenAPI schema or the route
    table.
    """
    r = APIRouter(prefix="/api/v1")
    r.include_router(mobile.router)
    r.include_router(auth.router)
    r.include_router(profile.router)
    r.include_router(interests.router)
    r.include_router(media.router)
    r.include_router(discovery.router)
    r.include_router(safety.router)
    r.include_router(likes.router)
    r.include_router(favorites.router)
    r.include_router(matches.router)
    r.include_router(conversations.router)
    r.include_router(notifications.router)
    r.include_router(verification.router)
    r.include_router(reports.router)
    r.include_router(events.router)
    r.include_router(subscriptions.router)
    r.include_router(webhooks.router)
    r.include_router(admin.router)
    r.include_router(chat_ws.router)
    if not settings.is_production:
        # Register the dev-only OTP peek route only outside production.
        r.include_router(auth.dev_router)
    return r


# Module-level instance retained for backward compatibility with tests and
# scripts that import api_router directly.  Built from the cached runtime
# settings so the dev OTP route is present when APP_ENV != production.
# The running application always uses create_api_router(settings) via main.py.
api_router: APIRouter = create_api_router(get_settings())
