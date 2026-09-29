from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.api.v1.responses import success
from app.dependencies.auth import get_current_user
from app.dependencies.interactions import get_interaction_service
from app.models.orm import User
from app.schemas.interactions import TargetUserRequest
from app.services.interactions import InteractionService

router = APIRouter(tags=["Matching"])


@router.post("/favorites")
async def create_favorite(
    request: Request,
    body: TargetUserRequest,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[InteractionService, Depends(get_interaction_service)],
):
    return success(request, await service.favorite(user, body.user_id), 201)


@router.delete("/favorites/{user_id}")
async def delete_favorite(
    request: Request,
    user_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[InteractionService, Depends(get_interaction_service)],
):
    return success(request, await service.unfavorite(user, str(user_id)))


@router.get("/favorites")
async def list_favorites(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[InteractionService, Depends(get_interaction_service)],
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = None,
):
    return success(request, await service.list_favorites(user, limit, cursor))
