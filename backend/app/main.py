import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.public import router as public_router
from app.api.v1.health import router as health_router
from app.api.v1.router import api_router
from app.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.dependencies.auth import init_runtime, shutdown_runtime
from app.middleware.request_id import RequestIdMiddleware, SecurityHeadersMiddleware
from app.websocket.chat import run_event_fanout
from app.websocket.gateway import router as realtime_router
from app.workers.notifications import run_notification_worker

OPENAPI_TAGS = [
    {"name": "Authentication", "description": "Registration, login, OTP, tokens."},
    {"name": "Health", "description": "Liveness and readiness."},
    {"name": "Users", "description": "Reserved."},
    {
        "name": "Profiles",
        "description": "Own profile, public profile, preferences, interests, location.",
    },
    {"name": "Discovery", "description": "Nearby feed, filters, impressions."},
    {"name": "Matching", "description": "Likes, favorites, and mutual matches."},
    {"name": "Chat", "description": "Conversations, messages, and WebSocket chat."},
    {
        "name": "Notifications",
        "description": "Device tokens, inbox, preferences, and FCM dispatch.",
    },
    {"name": "Media", "description": "Signed upload URLs and profile media metadata."},
    {"name": "Verification", "description": "Reserved."},
    {"name": "Events", "description": "Social events, RSVP, and host management."},
    {"name": "Travel", "description": "Reserved."},
    {"name": "Tonight", "description": "Reserved."},
    {
        "name": "Subscriptions",
        "description": "Catalog, purchase verification, entitlements, store webhooks.",
    },
    {"name": "Safety", "description": "Minimal block list used by discovery exclusion."},
    {"name": "Admin", "description": "Internal moderation, reports, and audit."},
]


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings)
    init_runtime(app, settings)
    fanout = asyncio.create_task(run_event_fanout(app), name="chat-fanout")
    worker = asyncio.create_task(run_notification_worker(app), name="notification-worker")
    app.state.fanout_task = fanout
    app.state.notification_worker = worker
    yield
    worker.cancel()
    fanout.cancel()
    await shutdown_runtime(app)


def create_app() -> FastAPI:
    settings = get_settings()
    # Disable interactive API docs in production to reduce attack surface.
    # Staging and development keep /docs and /redoc available.
    docs_url = None if settings.is_production else "/docs"
    redoc_url = None if settings.is_production else "/redoc"
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        openapi_tags=OPENAPI_TAGS,
        lifespan=lifespan,
        docs_url=docs_url,
        redoc_url=redoc_url,
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_origin_regex=(
            r"https?://(localhost|127\.0\.0\.1)(:\d+)?" if not settings.is_production else None
        ),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-Id"],
    )
    app.add_middleware(RequestIdMiddleware)
    register_exception_handlers(app)
    app.include_router(health_router)
    app.include_router(public_router)
    app.include_router(api_router)
    app.include_router(realtime_router)
    return app


app = create_app()
