from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.api.v1.responses import success
from app.dependencies.auth import get_current_user
from app.dependencies.events import get_event_service
from app.models.orm import User
from app.schemas.events import EventCoverAttachRequest, EventCreateRequest, EventUpdateRequest
from app.schemas.profile import UploadUrlRequest
from app.services.events import SocialEventService

router = APIRouter(tags=["Events"])


@router.get("/events")
async def list_events(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[SocialEventService, Depends(get_event_service)],
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = None,
):
    return success(request, await service.list_events(user, limit, cursor))


@router.get("/events/{event_id}")
async def get_event(
    request: Request,
    event_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[SocialEventService, Depends(get_event_service)],
):
    return success(request, await service.get_event(user, event_id))


@router.post("/events")
async def create_event(
    request: Request,
    body: EventCreateRequest,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[SocialEventService, Depends(get_event_service)],
):
    return success(request, await service.create_event(user, body), 201)


@router.patch("/events/{event_id}")
async def update_event(
    request: Request,
    event_id: UUID,
    body: EventUpdateRequest,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[SocialEventService, Depends(get_event_service)],
):
    return success(request, await service.update_event(user, event_id, body))


@router.delete("/events/{event_id}")
async def cancel_event(
    request: Request,
    event_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[SocialEventService, Depends(get_event_service)],
):
    return success(request, await service.cancel_event(user, event_id))


@router.post("/events/{event_id}/rsvp")
async def rsvp_event(
    request: Request,
    event_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[SocialEventService, Depends(get_event_service)],
):
    return success(request, await service.rsvp(user, event_id))


@router.delete("/events/{event_id}/rsvp")
async def cancel_rsvp(
    request: Request,
    event_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[SocialEventService, Depends(get_event_service)],
):
    return success(request, await service.cancel_rsvp(user, event_id))


@router.post("/events/{event_id}/cover/upload-url")
async def create_event_cover_upload_url(
    request: Request,
    event_id: UUID,
    body: UploadUrlRequest,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[SocialEventService, Depends(get_event_service)],
):
    return success(request, await service.create_cover_upload_url(user, event_id, body))


@router.post("/events/{event_id}/cover")
async def set_event_cover(
    request: Request,
    event_id: UUID,
    body: EventCoverAttachRequest,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[SocialEventService, Depends(get_event_service)],
):
    return success(request, await service.set_cover(user, event_id, body.storage_key))


@router.delete("/events/{event_id}/cover")
async def remove_event_cover(
    request: Request,
    event_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[SocialEventService, Depends(get_event_service)],
):
    return success(request, await service.remove_cover(user, event_id))
