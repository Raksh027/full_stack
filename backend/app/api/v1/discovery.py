from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from app.api.v1.responses import success
from app.dependencies.auth import get_current_user
from app.dependencies.discovery import get_discovery_service
from app.models.orm import User
from app.schemas.discovery import DiscoveryQuery, ImpressionRequest
from app.services.discovery import DiscoveryService

router = APIRouter(tags=["Discovery"])


@router.get("/discovery")
async def get_discovery(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[DiscoveryService, Depends(get_discovery_service)],
    min_age: Annotated[int | None, Query(alias="minAge", ge=18, le=99)] = None,
    max_age: Annotated[int | None, Query(alias="maxAge", ge=18, le=99)] = None,
    gender: str | None = None,
    looking_for: Annotated[str | None, Query(alias="lookingFor")] = None,
    max_distance_km: Annotated[float | None, Query(alias="maxDistanceKm", ge=1, le=500)] = None,
    interests: str | None = None,
    verified_only: Annotated[bool | None, Query(alias="verifiedOnly")] = None,
    city: str | None = None,
    limit: int = 20,
    cursor: str | None = None,
):
    query = DiscoveryQuery(
        minAge=min_age,
        maxAge=max_age,
        gender=gender,
        lookingFor=looking_for,
        maxDistanceKm=max_distance_km,
        interests=interests,
        verifiedOnly=verified_only,
        city=city,
        limit=limit,
        cursor=cursor,
    )
    return success(request, await service.feed(user, query))


@router.post("/discovery/impressions")
async def post_impressions(
    request: Request,
    body: ImpressionRequest,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[DiscoveryService, Depends(get_discovery_service)],
):
    return success(request, await service.record_impressions(user.id, body.user_ids))
