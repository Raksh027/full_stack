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
from app.websocket import chat as chat_ws

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(mobile.router)
api_router.include_router(auth.router)
api_router.include_router(profile.router)
api_router.include_router(interests.router)
api_router.include_router(media.router)
api_router.include_router(discovery.router)
api_router.include_router(safety.router)
api_router.include_router(likes.router)
api_router.include_router(favorites.router)
api_router.include_router(matches.router)
api_router.include_router(conversations.router)
api_router.include_router(notifications.router)
api_router.include_router(verification.router)
api_router.include_router(reports.router)
api_router.include_router(events.router)
api_router.include_router(subscriptions.router)
api_router.include_router(webhooks.router)
api_router.include_router(admin.router)
api_router.include_router(chat_ws.router)
