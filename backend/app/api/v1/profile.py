from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request

from app.api.v1.responses import success
from app.dependencies.auth import get_current_user
from app.dependencies.profile import get_profile_service
from app.models.orm import User
from app.schemas.profile import (
    InterestsPut,
    LocationPatch,
    MediaCreate,
    MediaPatch,
    PreferencePut,
    ProfilePatch,
)
from app.services.profile import ProfileService

router = APIRouter(tags=["Profiles"])


@router.get("/profile")
async def get_profile(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ProfileService, Depends(get_profile_service)],
):
    return success(request, await service.get_own(user.id))


@router.patch("/profile")
async def patch_profile(
    request: Request,
    body: ProfilePatch,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ProfileService, Depends(get_profile_service)],
):
    return success(request, await service.patch_own(user.id, body))


@router.get("/profile/preferences")
async def get_preferences(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ProfileService, Depends(get_profile_service)],
):
    return success(request, await service.get_preferences(user.id))


@router.put("/profile/preferences")
async def put_preferences(
    request: Request,
    body: PreferencePut,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ProfileService, Depends(get_profile_service)],
):
    return success(request, await service.put_preferences(user.id, body))


@router.put("/profile/interests")
async def put_interests(
    request: Request,
    body: InterestsPut,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ProfileService, Depends(get_profile_service)],
):
    return success(request, await service.put_interests(user.id, body))


@router.patch("/profile/location")
async def patch_location(
    request: Request,
    body: LocationPatch,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ProfileService, Depends(get_profile_service)],
):
    return success(request, await service.patch_location(user.id, body))


@router.get("/profile/completion")
async def get_completion(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ProfileService, Depends(get_profile_service)],
):
    return success(request, await service.completion(user.id))


@router.post("/profile/media")
async def add_media(
    request: Request,
    body: MediaCreate,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ProfileService, Depends(get_profile_service)],
):
    return success(request, await service.add_media(user.id, body), 201)


@router.patch("/profile/media/{media_id}")
async def patch_media(
    request: Request,
    media_id: UUID,
    body: MediaPatch,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ProfileService, Depends(get_profile_service)],
):
    return success(request, await service.patch_media(user.id, media_id, body))


@router.delete("/profile/media/{media_id}")
async def delete_media(
    request: Request,
    media_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ProfileService, Depends(get_profile_service)],
):
    return success(request, await service.delete_media(user.id, media_id))


@router.get("/profiles/{user_id}")
async def get_public_profile(
    request: Request,
    user_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ProfileService, Depends(get_profile_service)],
):
    return success(request, await service.get_public(user.id, user_id))
