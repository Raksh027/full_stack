from typing import Any

from pydantic import AliasChoices, BaseModel, ConfigDict, EmailStr, Field


class Envelope(BaseModel):
    success: bool
    data: Any | None = None
    error: dict[str, str] | None = None
    request_id: str


class ErrorBody(BaseModel):
    code: str
    message: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    device_id: str | None = None


class RefreshRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    refresh_token: str = Field(validation_alias=AliasChoices("refreshToken", "refresh_token"))


class LogoutRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    refresh_token: str | None = Field(
        default=None, validation_alias=AliasChoices("refreshToken", "refresh_token")
    )


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=4, max_length=8, validation_alias=AliasChoices("otp", "code"))


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    password: str = Field(min_length=8, max_length=128)


class RegisterResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_id: str = Field(serialization_alias="userId")
    verification_required: bool = Field(serialization_alias="verificationRequired")
    email: str
    otp_sent: bool = Field(default=True, serialization_alias="otpSent")


class ResendOtpRequest(BaseModel):
    email: EmailStr
    purpose: str = "signup"


class DevOtpQuery(BaseModel):
    email: EmailStr
    purpose: str = "signup"


class TokenPair(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    access_token: str = Field(serialization_alias="accessToken")
    refresh_token: str = Field(serialization_alias="refreshToken")
    access_expires_at: str = Field(serialization_alias="accessExpiresAt")
    refresh_expires_at: str = Field(serialization_alias="refreshExpiresAt")
    token_type: str = "bearer"
    user_id: str = Field(serialization_alias="userId")


class PublicUser(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    email: str
    email_verified: bool = Field(serialization_alias="emailVerified")
    onboarding_completed: bool = Field(serialization_alias="onboardingCompleted")
    last_active_at: str | None = Field(serialization_alias="lastActiveAt")
    created_at: str = Field(serialization_alias="createdAt")
    display_name: str | None = Field(serialization_alias="displayName")
    verification_status: str = Field(serialization_alias="verificationStatus")
    visibility: str
    role: str = "USER"
