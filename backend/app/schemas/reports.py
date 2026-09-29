from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class ReportCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    reported_user_id: str = Field(validation_alias=AliasChoices("reportedUserId", "userId"))
    reason: str | None = None
    reason_code: str | None = Field(default=None, alias="reasonCode")
    details: str | None = None
    description: str | None = None
    related_content_type: str | None = Field(default=None, alias="relatedContentType")
    related_content_id: str | None = Field(default=None, alias="relatedContentId")
    conversation_id: str | None = Field(default=None, alias="conversationId")
    message_id: str | None = Field(default=None, alias="messageId")
