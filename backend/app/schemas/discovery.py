from pydantic import BaseModel, ConfigDict, Field, field_validator


class DiscoveryQuery(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    min_age: int | None = Field(default=None, alias="minAge", ge=18, le=99)
    max_age: int | None = Field(default=None, alias="maxAge", ge=18, le=99)
    gender: str | None = None
    looking_for: str | None = Field(default=None, alias="lookingFor")
    max_distance_km: float | None = Field(default=None, alias="maxDistanceKm", ge=1, le=500)
    interests: str | None = None
    verified_only: bool | None = Field(default=None, alias="verifiedOnly")
    city: str | None = None
    nationality: str | None = None
    limit: int = Field(default=20, ge=1, le=50)
    cursor: str | None = None

    @field_validator("gender")
    @classmethod
    def gender_ok(cls, value: str | None) -> str | None:
        if value is None:
            return None
        allowed = {"Everyone", "Women", "Men", "Non-binary", "Non-Binary"}
        if value not in allowed:
            raise ValueError("Invalid gender filter")
        return value


class ImpressionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_ids: list[str] = Field(alias="userIds", min_length=1, max_length=20)


class BlockRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_id: str = Field(alias="userId")
