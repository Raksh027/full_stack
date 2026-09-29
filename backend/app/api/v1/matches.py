from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.api.v1.responses import success
from app.dependencies.auth import get_current_user
from app.dependencies.interactions import get_interaction_service
from app.models.orm import User
from app.services.interactions import InteractionService

router = APIRouter(prefix="/matches", tags=["Matching"])


@router.get("")
async def list_matches(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[InteractionService, Depends(get_interaction_service)],
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = None,
):
    return success(request, await service.list_matches(user, limit, cursor))


@router.get("/{match_id}")
async def get_match(
    request: Request,
    match_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[InteractionService, Depends(get_interaction_service)],
):
    return success(request, await service.get_match(user, match_id))


@router.delete("/{match_id}")
async def delete_match(
    request: Request,
    match_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[InteractionService, Depends(get_interaction_service)],
):
    return success(request, await service.unmatch(user, match_id))
