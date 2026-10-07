from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.api.v1.responses import success
from app.dependencies.auth import get_current_user
from app.dependencies.mobile import get_mobile_service
from app.models.orm import User
from app.schemas.travel import JourneyCreate, JourneyUpdate
from app.services.mobile import MobileService

router = APIRouter(tags=["Mobile"])


class EmailBody(BaseModel):
    email: EmailStr


class OtpVerifyBody(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=8)


class PasswordBody(BaseModel):
    email: EmailStr
    password: str


class GoogleBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id_token: str = Field(alias="idToken")
    access_token: str | None = Field(default=None, alias="accessToken")
    birth_date: str | None = Field(default=None, alias="birthDate")
    gender: str | None = None


class AppleName(BaseModel):
    givenName: str | None = None
    familyName: str | None = None


class AppleBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    identity_token: str = Field(alias="identityToken")
    nonce: str | None = None
    full_name: AppleName | None = Field(default=None, alias="fullName")


class FacebookBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    access_token: str = Field(alias="accessToken")
    birth_date: str | None = Field(default=None, alias="birthDate")
    gender: str | None = None


class DeleteAccountBody(BaseModel):
    reason: str = Field(min_length=1, max_length=40)
    details: str | None = Field(default=None, max_length=500)


class RefreshBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    refresh_token: str | None = Field(default=None, alias="refreshToken")
    refresh_token_snake: str | None = Field(default=None, alias="refresh_token")

    def token(self) -> str | None:
        return self.refresh_token or self.refresh_token_snake


class SwipeBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    target_user_id: str = Field(alias="targetUserId")
    action: str


class LikeRespondBody(BaseModel):
    action: str


class PhotoOrderBody(BaseModel):
    photo_ids: list[str] = Field(alias="photoIds")
    model_config = ConfigDict(populate_by_name=True)


class LocationBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    latitude: float
    longitude: float
    city: str | None = None
    locality: str | None = None
    district: str | None = None
    region: str | None = None
    country: str | None = None
    country_code: str | None = Field(default=None, alias="countryCode")
    country_flag: str | None = Field(default=None, alias="countryFlag")


class PhotoUploadBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    content_type: str = Field(alias="contentType")
    file_size: int = Field(alias="fileSize")


class SendMessageBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    client_id: str | None = Field(default=None, alias="clientId")
    client_message_id: str | None = Field(default=None, alias="clientMessageId")
    body: str | None = None
    content: str | None = None

    def text(self) -> str:
        return (self.body or self.content or "").strip()

    def client(self) -> str:
        return self.client_id or self.client_message_id or ""


class ReadBody(BaseModel):
    last_read_message_id: str | None = Field(default=None, alias="lastReadMessageId")
    model_config = ConfigDict(populate_by_name=True)


class ReportBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    user_id: str = Field(alias="userId")
    reason: str
    details: str | None = None


class DeviceBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    push_token: str = Field(alias="pushToken")
    platform: str
    app_version: str | None = Field(default=None, alias="appVersion")
    locale: str | None = None


class PurchaseBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    platform: str
    receipt: str | None = None
    purchase_token: str | None = Field(default=None, alias="purchaseToken")
    product_id: str = Field(alias="productId")


class RazorpayOrderBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    product_id: str = Field(alias="productId")


class RazorpayCheckoutBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    product_id: str = Field(alias="productId")
    order_id: str = Field(alias="orderId")
    payment_id: str = Field(alias="paymentId")
    signature: str


@router.post("/auth/otp/request")
async def request_otp(
    request: Request,
    body: EmailBody,
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.request_login_otp(str(body.email)))


@router.post("/auth/otp/verify")
async def verify_otp(
    request: Request,
    body: OtpVerifyBody,
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.verify_login_otp(str(body.email), body.code))


@router.post("/auth/google")
async def google_auth(
    request: Request,
    body: GoogleBody,
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(
        request,
        await mobile.sign_in_with_google(
            body.id_token,
            body.access_token,
            birth_date=body.birth_date,
            gender=body.gender,
        ),
    )


@router.post("/auth/apple")
async def apple_auth(
    request: Request,
    body: AppleBody,
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    name = body.full_name.model_dump() if body.full_name else None
    return success(request, await mobile.sign_in_with_apple(body.identity_token, name))


@router.post("/auth/facebook")
async def facebook_auth(
    request: Request,
    body: FacebookBody,
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(
        request,
        await mobile.sign_in_with_facebook(
            body.access_token,
            birth_date=body.birth_date,
            gender=body.gender,
        ),
    )


@router.post("/auth/password/forgot")
async def forgot_password(
    request: Request,
    body: EmailBody,
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.auth.forgot_password(str(body.email)))


@router.post("/auth/email/verify")
async def verify_email(
    request: Request,
    body: OtpVerifyBody,
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    data = await mobile.verify_login_otp(str(body.email), body.code)
    return success(request, data["user"])


@router.post("/auth/email/verify/resend")
async def resend_verify(
    request: Request,
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
    body: EmailBody | None = None,
):
    if body is None:
        return success(request, {"otpSent": True})
    return success(request, await mobile.auth.resend_otp(str(body.email), "signup"))


@router.delete("/users/me")
async def delete_me(
    request: Request,
    body: DeleteAccountBody,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.delete_account(user, body.reason, body.details))


@router.get("/users/me/email-change")
async def email_change_status(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.email_change_status(user))


@router.post("/users/me/email-change/request")
async def request_email_change(
    request: Request,
    body: EmailBody,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.request_email_change(user, str(body.email)))


@router.post("/users/me/email-change/verify")
async def verify_email_change(
    request: Request,
    body: OtpVerifyBody,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.verify_email_change(user, str(body.email), body.code))


@router.get("/profiles/me")
async def get_me_profile(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.my_profile(user.id))


@router.patch("/profiles/me")
async def patch_me_profile(
    request: Request,
    body: dict[str, Any],
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.patch_profile(user.id, body))


@router.post("/profiles/me/onboarding/complete")
async def complete_onboarding(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.complete_onboarding(user.id))


@router.post("/profiles/me/photos/upload-url")
async def photo_upload_url(
    request: Request,
    body: PhotoUploadBody,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(
        request,
        await mobile.request_photo_upload(user.id, body.content_type, body.file_size),
    )


@router.post("/profiles/me/photos/{photo_id}/confirm")
async def confirm_photo(
    request: Request,
    photo_id: str,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.confirm_photo(user.id, photo_id))


@router.delete("/profiles/me/photos/{photo_id}")
async def delete_photo(
    request: Request,
    photo_id: str,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    await mobile.delete_photo(user.id, photo_id)
    return success(request, {"deleted": True})


@router.put("/profiles/me/photos/order")
async def reorder_photos(
    request: Request,
    body: PhotoOrderBody,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    await mobile.reorder_photos(user.id, body.photo_ids)
    return success(request, {"ordered": True})


@router.put("/profiles/me/location")
async def update_location(
    request: Request,
    body: LocationBody,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.update_location(user.id, body))


@router.post("/profiles/{user_id}/views")
async def record_view(
    request: Request,
    user_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    await mobile.record_view(user, str(user_id))
    return success(request, {"recorded": True})


@router.get("/discovery/feed")
async def discovery_feed(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=50),
    segment: str | None = Query(default=None),
):
    allowed = {None, "everyone", "new", "active", "verified"}
    if segment not in allowed:
        segment = None
    return success(request, await mobile.discovery_feed(user, cursor, limit, segment))


@router.get("/discovery/map")
async def discovery_map(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    radius_km: float = Query(default=10, ge=1, le=100, alias="radiusKm"),
    cursor: str | None = None,
    limit: int = Query(default=30, ge=1, le=50),
    kind: str | None = Query(default=None),
    online_only: bool = Query(default=False, alias="onlineOnly"),
):
    return success(
        request,
        await mobile.discovery_map(
            user,
            latitude=latitude,
            longitude=longitude,
            radius_km=radius_km,
            cursor=cursor,
            limit=limit,
            kind=kind,
            online_only=online_only,
        ),
    )


@router.post("/discovery/swipes")
async def swipe(
    request: Request,
    body: SwipeBody,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.swipe(user, body.target_user_id, body.action))


@router.delete("/discovery/swipes/last")
async def rewind(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.rewind_last_swipe(user))


@router.get("/likes/received")
async def likes_received(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=50),
):
    return success(request, await mobile.list_likes_received(user, limit, cursor))


@router.get("/likes/sent")
async def likes_sent(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=50),
):
    return success(request, await mobile.list_likes_sent(user, limit, cursor))


@router.get("/likes/viewed")
async def likes_viewed(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=50),
):
    return success(request, await mobile.list_views(user, limit, cursor))


@router.post("/likes/received/{like_id}/respond")
async def respond_like(
    request: Request,
    like_id: str,
    body: LikeRespondBody,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.respond_to_like(user, like_id, body.action))


@router.delete("/likes/sent/{user_id}")
async def remove_sent_like(
    request: Request,
    user_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.interactions.unlike(user, str(user_id)))


@router.get("/users/me/discovery-preferences")
async def get_discovery_prefs(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.get_discovery_preferences(user.id))


@router.patch("/users/me/discovery-preferences")
async def patch_discovery_prefs(
    request: Request,
    body: dict[str, Any],
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.update_discovery_preferences(user.id, body))


@router.get("/users/me/notification-settings")
async def get_notification_settings(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.get_notification_settings(user))


@router.patch("/users/me/notification-settings")
async def patch_notification_settings(
    request: Request,
    body: dict[str, Any],
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.update_notification_settings(user, body))


@router.post("/devices")
async def register_device(
    request: Request,
    body: DeviceBody,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    await mobile.register_device(user, body.model_dump(by_alias=True))
    return success(request, {"registered": True})


@router.delete("/devices/{push_token}")
async def unregister_device(
    request: Request,
    push_token: str,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    await mobile.unregister_device(user, push_token)
    return success(request, {"removed": True})


@router.post("/safety/reports")
async def safety_report(
    request: Request,
    body: ReportBody,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    await mobile.report_user(user, body.user_id, body.reason, body.details)
    return success(request, {"reported": True}, 201)


@router.get("/subscriptions/me")
async def subscription_me(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.my_subscription(user))


@router.post("/subscriptions/verify")
async def subscription_verify(
    request: Request,
    body: PurchaseBody,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.verify_purchase(user, body.model_dump(by_alias=True)))


@router.post("/subscriptions/razorpay/order")
async def subscription_razorpay_order(
    request: Request,
    body: RazorpayOrderBody,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.create_razorpay_order(user, body.product_id))


@router.post("/subscriptions/razorpay/verify")
async def subscription_razorpay_verify(
    request: Request,
    body: RazorpayCheckoutBody,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(
        request,
        await mobile.verify_razorpay_purchase(user, body.model_dump(by_alias=True)),
    )


@router.get("/subscriptions/plans")
async def subscription_plans(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.subscription_plans(user))


@router.get("/travel/countries")
async def travel_countries(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    q: str | None = None,
):
    return success(
        request,
        await mobile.travel_countries(user.id, cursor=cursor, limit=limit, q=q),
    )


@router.get("/travel/arrivals")
async def travel_arrivals(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
    cursor: str | None = None,
    limit: int = Query(default=12, ge=1, le=50),
    from_country: Annotated[str | None, Query(alias="fromCountry")] = None,
    trip_type: Annotated[str | None, Query(alias="tripType")] = None,
    from_date: Annotated[str | None, Query(alias="fromDate")] = None,
    to_date: Annotated[str | None, Query(alias="toDate")] = None,
    travel_style: Annotated[str | None, Query(alias="travelStyle")] = None,
    companion: Annotated[str | None, Query()] = None,
):
    return success(
        request,
        await mobile.travel_arrivals(
            user.id,
            cursor=cursor,
            limit=limit,
            from_country=from_country,
            trip_type=trip_type,
            from_date=from_date,
            to_date=to_date,
            travel_style=travel_style,
            companion=companion,
        ),
    )


@router.get("/travel/arrivals/{arrival_id}")
async def travel_arrival(
    request: Request,
    arrival_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.travel_arrival(user.id, arrival_id))


@router.get("/travel/journeys")
async def my_journeys(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=50),
):
    return success(request, await mobile.list_journeys(user.id, cursor=cursor, limit=limit))


@router.get("/travel/journeys/{journey_id}")
async def get_journey(
    request: Request,
    journey_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.get_journey(user.id, journey_id))


@router.patch("/travel/journeys/{journey_id}")
async def update_journey(
    request: Request,
    journey_id: UUID,
    body: JourneyUpdate,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(
        request,
        await mobile.update_journey(
            user.id, journey_id, body.model_dump(by_alias=True, exclude_unset=True)
        ),
    )


@router.delete("/travel/journeys/{journey_id}")
async def delete_journey(
    request: Request,
    journey_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    await mobile.delete_journey(user.id, journey_id)
    return success(request, {"deleted": True})


@router.post("/travel/journeys")
async def create_journey(
    request: Request,
    body: JourneyCreate,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(
        request,
        await mobile.create_journey(user.id, body.model_dump(by_alias=True)),
        201,
    )


@router.get("/tonight/me")
async def my_tonight(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, {"item": await mobile.my_tonight(user)})


@router.get("/tonight")
async def list_tonight(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
    activity: str | None = None,
    min_km: Annotated[float | None, Query(alias="minKm", ge=0, le=500)] = None,
    max_km: Annotated[float | None, Query(alias="maxKm", ge=0, le=500)] = None,
    cursor: str | None = None,
    limit: int = Query(default=12, ge=1, le=50),
):
    return success(
        request,
        await mobile.list_tonight(
            user,
            activity,
            min_km=min_km,
            max_km=max_km,
            cursor=cursor,
            limit=limit,
        ),
    )


@router.post("/tonight")
async def create_tonight(
    request: Request,
    body: dict[str, Any],
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.create_tonight(user, body), 201)


@router.patch("/tonight")
async def update_tonight(
    request: Request,
    body: dict[str, Any],
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.update_tonight(user, body))


@router.delete("/tonight")
async def delete_tonight(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.delete_tonight(user))
