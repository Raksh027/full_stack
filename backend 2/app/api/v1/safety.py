from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request

from app.api.v1.responses import success
from app.dependencies.auth import get_current_user
from app.dependencies.discovery import get_discovery_service
from app.models.orm import User
from app.schemas.discovery import BlockRequest
from app.services.discovery import DiscoveryService

router = APIRouter(prefix="/safety", tags=["Safety"])


@router.get("/blocks")
async def list_blocks(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[DiscoveryService, Depends(get_discovery_service)],
):
    return success(request, await service.list_blocks(user.id))


@router.post("/blocks")
async def create_block(
    request: Request,
    body: BlockRequest,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[DiscoveryService, Depends(get_discovery_service)],
):
    return success(request, await service.block(user.id, body.user_id), 201)


@router.delete("/blocks/{user_id}")
async def delete_block(
    request: Request,
    user_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[DiscoveryService, Depends(get_discovery_service)],
):
    return success(request, await service.unblock(user.id, str(user_id)))
