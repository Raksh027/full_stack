from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from app.api.v1.responses import success
from app.dependencies.auth import get_current_user
from app.dependencies.subscriptions import get_subscription_service
from app.models.orm import User
from app.schemas.subscriptions import (
    PurchaseProof,
    RazorpayOrderBody,
    RazorpayVerifyBody,
    RestoreBody,
)
from app.services.subscriptions import SubscriptionService

router = APIRouter(tags=["Subscriptions"])


@router.get("/subscriptions/catalog")
async def catalog(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[SubscriptionService, Depends(get_subscription_service)],
    platform: str | None = None,
):
    return success(request, await service.catalog(user, platform))


@router.get("/subscriptions/me")
async def my_subscription(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[SubscriptionService, Depends(get_subscription_service)],
):
    return success(request, await service.me(user))


@router.get("/subscriptions/history")
async def history(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[SubscriptionService, Depends(get_subscription_service)],
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
):
    return success(request, await service.history(user, limit, offset))


@router.post("/subscriptions/verify")
async def verify(
    request: Request,
    body: PurchaseProof,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[SubscriptionService, Depends(get_subscription_service)],
):
    return success(request, await service.verify(user, body))


@router.post("/subscriptions/razorpay/order")
async def razorpay_order(
    request: Request,
    body: RazorpayOrderBody,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[SubscriptionService, Depends(get_subscription_service)],
):
    return success(request, await service.create_razorpay_order(user, body.product_id))


@router.post("/subscriptions/razorpay/verify")
async def razorpay_verify(
    request: Request,
    body: RazorpayVerifyBody,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[SubscriptionService, Depends(get_subscription_service)],
):
    return success(request, await service.verify_razorpay(user, body))


@router.post("/subscriptions/restore")
async def restore(
    request: Request,
    body: RestoreBody,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[SubscriptionService, Depends(get_subscription_service)],
):
    return success(request, await service.restore(user, body.purchases))


@router.get("/entitlements")
async def entitlements(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[SubscriptionService, Depends(get_subscription_service)],
):
    return success(request, await service.entitlements(user))
