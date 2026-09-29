from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.api.v1.responses import success
from app.dependencies.auth import get_current_user
from app.dependencies.profile import get_profile_service
from app.models.orm import User
from app.services.profile import ProfileService

router = APIRouter(tags=["Profiles"])


@router.get("/interests")
async def list_interests(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ProfileService, Depends(get_profile_service)],
):
    return success(request, await service.list_interests())
