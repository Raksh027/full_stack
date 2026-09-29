from typing import Annotated

from fastapi import Depends, Request

from app.config import Settings, get_settings
from app.core.cache import CacheBackend
from app.dependencies.admin import get_report_service
from app.dependencies.auth import get_auth_service, get_cache
from app.dependencies.discovery import get_discovery_service
from app.dependencies.interactions import get_chat_service, get_interaction_service
from app.dependencies.notifications import get_notification_service
from app.dependencies.profile import get_profile_service, request_base
from app.dependencies.subscriptions import get_subscription_service
from app.services.auth import AuthService
from app.services.chat import ChatService
from app.services.discovery import DiscoveryService
from app.services.interactions import InteractionService
from app.services.mobile import MobileService
from app.services.notifications import NotificationService
from app.services.profile import ProfileService
from app.services.reports import ReportService
from app.services.subscriptions import SubscriptionService


def get_mobile_service(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    cache: Annotated[CacheBackend, Depends(get_cache)],
    auth: Annotated[AuthService, Depends(get_auth_service)],
    profiles: Annotated[ProfileService, Depends(get_profile_service)],
    discovery: Annotated[DiscoveryService, Depends(get_discovery_service)],
    interactions: Annotated[InteractionService, Depends(get_interaction_service)],
    chat: Annotated[ChatService, Depends(get_chat_service)],
    notifications: Annotated[NotificationService, Depends(get_notification_service)],
    reports: Annotated[ReportService, Depends(get_report_service)],
    subscriptions: Annotated[SubscriptionService, Depends(get_subscription_service)],
) -> MobileService:
    return MobileService(
        session=auth._session,
        settings=settings,
        cache=cache,
        auth=auth,
        profiles=profiles,
        discovery=discovery,
        interactions=interactions,
        chat=chat,
        notifications=notifications,
        reports=reports,
        subscriptions=subscriptions,
        request_base=request_base(request),
    )
