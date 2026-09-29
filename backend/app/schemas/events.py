from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.event_rules import finite_coordinate, require_coordinate_pair


class EventCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=4000)
    location: str = Field(min_length=1, max_length=200)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    starts_at: datetime = Field(alias="startsAt")
    ends_at: datetime = Field(alias="endsAt")
    capacity: int | None = Field(default=None, gt=0)
    price: float = Field(default=0, ge=0)

    @field_validator("title", "location")
    @classmethod
    def strip_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field is required.")
        return cleaned

    @field_validator("description")
    @classmethod
    def strip_optional(cls, value: str) -> str:
        return value.strip()

    @field_validator("latitude", "longitude")
    @classmethod
    def finite_create_coords(cls, value: float | None) -> float | None:
        return finite_coordinate(value)

    @model_validator(mode="after")
    def ends_after_starts(self) -> "EventCreateRequest":
        if self.ends_at < self.starts_at:
            raise ValueError("endsAt must be greater than or equal to startsAt.")
        require_coordinate_pair(self.latitude, self.longitude)
        return self


class EventUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=4000)
    location: str | None = Field(default=None, min_length=1, max_length=200)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    starts_at: datetime | None = Field(default=None, alias="startsAt")
    ends_at: datetime | None = Field(default=None, alias="endsAt")
    capacity: int | None = Field(default=None, gt=0)
    price: float | None = Field(default=None, ge=0)

    @field_validator("title", "location")
    @classmethod
    def strip_required(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field is required.")
        return cleaned

    @field_validator("description")
    @classmethod
    def strip_optional(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()

    @field_validator("latitude", "longitude")
    @classmethod
    def finite_update_coords(cls, value: float | None) -> float | None:
        return finite_coordinate(value)

    @model_validator(mode="after")
    def coordinate_pair(self) -> "EventUpdateRequest":
        data = self.model_dump(exclude_unset=True)
        if "latitude" in data or "longitude" in data:
            require_coordinate_pair(self.latitude, self.longitude)
        return self


class EventResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    title: str
    description: str
    location: str
    latitude: float | None = None
    longitude: float | None = None
    starts_at: datetime = Field(alias="startsAt")
    ends_at: datetime = Field(alias="endsAt")
    cover_image_url: str | None = Field(default=None, alias="coverImageUrl")
    cover_storage_key: str | None = Field(default=None, alias="coverStorageKey")
    capacity: int | None = None
    attendee_count: int = Field(alias="attendeeCount")
    my_rsvp: str | None = Field(default=None, alias="myRsvp")
    is_host: bool = Field(alias="isHost")
    host_id: UUID = Field(alias="hostId")
    host_name: str = Field(alias="hostName")
    price: float
    status: str


class EventCoverAttachRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    storage_key: str = Field(alias="storageKey", min_length=1, max_length=512)

    @field_validator("storage_key")
    @classmethod
    def strip_key(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("storageKey is required.")
        return cleaned
