from pydantic import BaseModel, ConfigDict, Field


class AdminReviewBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    action: str
    reason_code: str | None = Field(default=None, alias="reasonCode")
    notes: str | None = None


class AdminSuspendBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    hours: int | None = Field(default=None, ge=0, le=24 * 90)
    reason: str | None = None


class AdminBanBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    reason: str | None = None


class AdminReportResolveBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    resolution_code: str | None = Field(default=None, alias="resolutionCode")
    notes: str | None = None
    action: str | None = None


class AdminReportAssignBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    reviewer_id: str | None = Field(default=None, alias="reviewerId")


class AdminMediaRemoveBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    media_id: str = Field(alias="mediaId")
    reason: str | None = None


class AdminEventActionBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    reason: str | None = None
