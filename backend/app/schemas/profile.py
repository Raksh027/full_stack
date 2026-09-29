from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator


class ProfilePatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    display_name: str | None = Field(default=None, alias="displayName", max_length=80)
    name: str | None = Field(default=None, max_length=80)
    bio: str | None = Field(default=None, max_length=500)
    age: int | None = None
    birth_date: str | None = Field(default=None, alias="birthDate")
    gender: str | None = None
    orientation: str | None = None
    looking_for: str | None = Field(default=None, alias="lookingFor")
    visibility: str | None = None
    location: str | None = None
    onboarding_step: str | None = Field(default=None, alias="onboardingStep")

    @field_validator("age")
    @classmethod
    def omit_placeholder_age(cls, value: int | None) -> int | None:
        if value is None or value < 1:
            return None
        return value

    @field_validator("display_name", "name", "bio", "location")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = value.strip()
        return text or None


class PreferencePut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    min_age: int = Field(alias="minAge", ge=18, le=99)
    max_age: int = Field(alias="maxAge", ge=18, le=99)
    max_distance_km: float = Field(alias="maxDistanceKm", ge=1, le=500)
    gender: str = "Everyone"
    orientation: str | None = None
    looking_for: str | None = Field(default=None, alias="lookingFor")
    verified_only: bool = Field(default=False, alias="verifiedOnly")

    @model_validator(mode="after")
    def ages_ordered(self) -> "PreferencePut":
        if self.min_age > self.max_age:
            raise ValueError("minAge must be less than or equal to maxAge")
        return self


class InterestsPut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    interest_ids: list[str] | None = Field(default=None, alias="interestIds")
    names: list[str] | None = None
    interests: list[str] | None = None


class LocationPatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    city: str | None = Field(default=None, max_length=120)
    locality: str | None = Field(default=None, max_length=120)
    district: str | None = Field(default=None, max_length=120)
    region: str | None = Field(default=None, max_length=120)
    country: str | None = Field(default=None, max_length=120)
    country_code: str | None = Field(default=None, alias="countryCode", max_length=8)
    country_flag: str | None = Field(default=None, alias="countryFlag", max_length=512)
    location: str | None = None

    @model_validator(mode="after")
    def coords_together(self) -> "LocationPatch":
        if (self.latitude is None) ^ (self.longitude is None):
            raise ValueError("latitude and longitude must be provided together")
        return self


class UploadUrlRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    content_type: str = Field(alias="contentType")
    filename: str = "photo.jpg"
    byte_size: int = Field(default=1, ge=1, validation_alias=AliasChoices("byteSize", "fileSize"))


class MediaCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    storage_key: str = Field(alias="storageKey")
    media_type: str = Field(default="image", alias="mediaType")
    sort_order: int = Field(default=0, alias="sortOrder", ge=0, le=20)
    is_primary: bool = Field(default=False, alias="isPrimary")


class MediaPatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    sort_order: int | None = Field(default=None, alias="sortOrder", ge=0, le=20)
    is_primary: bool | None = Field(default=None, alias="isPrimary")
