from pydantic import BaseModel, ConfigDict, Field


class VerificationStartRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    verification_type: str | None = Field(default=None, alias="verificationType")


class VerificationUploadRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    content_type: str = Field(alias="contentType")
    filename: str
    byte_size: int = Field(alias="byteSize", ge=1)


class VerificationSubmitRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    storage_key: str | None = Field(default=None, alias="storageKey")
    storage_keys: list[str] | None = Field(default=None, alias="storageKeys")
    media_type: str = Field(default="selfie", alias="mediaType")


class VerificationReviewRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    request_id: str = Field(alias="requestId")
    action: str
    reason_code: str | None = Field(default=None, alias="reasonCode")
    notes: str | None = None
