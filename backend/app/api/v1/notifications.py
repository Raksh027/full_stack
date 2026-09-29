from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.api.v1.responses import success
from app.dependencies.auth import get_current_user
from app.dependencies.notifications import get_notification_service
from app.models.orm import User
from app.schemas.notifications import DeviceRegisterRequest, PreferenceUpdateRequest
from app.services.notifications import NotificationService

router = APIRouter(tags=["Notifications"])


@router.get("/notifications/unread-count")
async def unread_count(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[NotificationService, Depends(get_notification_service)],
):
    return success(request, await service.unread_count(user))


@router.get("/notifications/preferences")
async def get_preferences(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[NotificationService, Depends(get_notification_service)],
):
    return success(request, await service.get_preferences(user))


@router.put("/notifications/preferences")
async def update_preferences(
    request: Request,
    body: PreferenceUpdateRequest,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[NotificationService, Depends(get_notification_service)],
):
    return success(
        request, await service.update_preferences(user, body.model_dump(exclude_unset=True))
    )


@router.get("/notifications/devices")
async def list_devices(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[NotificationService, Depends(get_notification_service)],
):
    return success(request, await service.list_devices(user))


@router.post("/notifications/devices")
async def register_device(
    request: Request,
    body: DeviceRegisterRequest,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[NotificationService, Depends(get_notification_service)],
):
    return success(
        request,
        await service.register_device(
            user,
            token=body.token,
            platform=body.platform,
            device_id=body.device_id,
            app_version=body.app_version,
        ),
        201,
    )


@router.delete("/notifications/devices/{device_id}")
async def delete_device(
    request: Request,
    device_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[NotificationService, Depends(get_notification_service)],
):
    return success(request, await service.delete_device(user, device_id))


@router.post("/notifications/test")
async def test_notification(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[NotificationService, Depends(get_notification_service)],
):
    return success(request, await service.persist_test(user), 201)


@router.get("/notifications")
async def list_notifications(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[NotificationService, Depends(get_notification_service)],
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = None,
):
    return success(request, await service.list_notifications(user, limit, cursor))


@router.post("/notifications/read-all")
async def read_all(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[NotificationService, Depends(get_notification_service)],
):
    return success(request, await service.mark_all_read(user))


@router.post("/notifications/{notification_id}/read")
async def read_one(
    request: Request,
    notification_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[NotificationService, Depends(get_notification_service)],
):
    return success(request, await service.mark_read(user, notification_id))
