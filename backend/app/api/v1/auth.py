from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials

from app.api.v1.responses import success
from app.dependencies.auth import CurrentAuth, bearer, get_auth_service, get_current_auth
from app.dependencies.mobile import get_mobile_service
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    ResendOtpRequest,
    ResetPasswordRequest,
    VerifyOtpRequest,
)
from app.services.auth import AuthService
from app.services.mobile import MobileService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register")
async def register(
    request: Request,
    body: RegisterRequest,
    auth: Annotated[AuthService, Depends(get_auth_service)],
):
    data = await auth.register(str(body.email), body.password)
    return success(request, data, 201)


@router.post("/login")
async def login(
    request: Request,
    body: LoginRequest,
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.login_with_password(str(body.email), body.password))


@router.post("/refresh")
async def refresh(
    request: Request,
    body: RefreshRequest,
    auth: Annotated[AuthService, Depends(get_auth_service)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    tokens = await auth.refresh(body.refresh_token)
    return success(request, await mobile.auth_response(tokens))


@router.post("/logout")
async def logout(
    request: Request,
    body: LogoutRequest,
    auth: Annotated[AuthService, Depends(get_auth_service)],
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
):
    access = creds.credentials if creds else None
    await auth.logout(body.refresh_token, access)
    return success(request, {"loggedOut": True})


@router.post("/verify-otp")
async def verify_otp(
    request: Request,
    body: VerifyOtpRequest,
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.verify_login_otp(str(body.email), body.otp))


@router.post("/forgot-password")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    auth: Annotated[AuthService, Depends(get_auth_service)],
):
    data = await auth.forgot_password(str(body.email))
    return success(request, data)


@router.post("/resend-otp")
async def resend_otp(
    request: Request,
    body: ResendOtpRequest,
    auth: Annotated[AuthService, Depends(get_auth_service)],
):
    data = await auth.resend_otp(str(body.email), body.purpose)
    return success(request, data)


@router.get("/dev/otp")
async def dev_otp(
    request: Request,
    auth: Annotated[AuthService, Depends(get_auth_service)],
    email: str,
    purpose: str = "signup",
):
    data = await auth.peek_dev_otp(email, purpose)
    return success(request, data)


@router.post("/reset-password")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    auth: Annotated[AuthService, Depends(get_auth_service)],
):
    await auth.reset_password(str(body.email), body.otp, body.password)
    return success(request, {"reset": True})


@router.get("/me")
async def me(
    request: Request,
    current: Annotated[CurrentAuth, Depends(get_current_auth)],
    mobile: Annotated[MobileService, Depends(get_mobile_service)],
):
    return success(request, await mobile.session_user(current.user.id))
