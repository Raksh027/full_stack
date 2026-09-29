from pydantic import BaseModel, ConfigDict, Field


class TargetUserRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_id: str = Field(alias="userId")


class CursorQuery(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    limit: int = Field(default=20, ge=1, le=50)
    cursor: str | None = None
