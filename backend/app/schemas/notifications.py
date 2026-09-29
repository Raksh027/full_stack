from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class DeviceRegisterRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    token: str = Field(
        min_length=8,
        max_length=512,
        validation_alias=AliasChoices("token", "pushToken"),
    )
    platform: str = Field(default="android", max_length=32)
    device_id: str | None = Field(default=None, alias="deviceId", max_length=128)
    app_version: str | None = Field(default=None, alias="appVersion", max_length=32)


class PreferenceUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    matches: bool | None = None
    likes: bool | None = None
    favorites: bool | None = None
    messages: bool | None = None
    message_preview: bool | None = Field(default=None, alias="messagePreview")
    general: bool | None = None
    all_enabled: bool | None = Field(default=None, alias="all")
    profile_views: bool | None = Field(default=None, alias="profileViews")
    cross_path: bool | None = Field(default=None, alias="crossPath")
    traveller_alerts: bool | None = Field(default=None, alias="travellerAlerts")
    free_tonight: bool | None = Field(default=None, alias="freeTonight")
    email_enabled: bool | None = Field(default=None, alias="email")
