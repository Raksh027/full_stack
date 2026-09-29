from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator


class SendMessageRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    content: str | None = Field(default=None, max_length=4000)
    body: str | None = Field(default=None, max_length=4000)
    client_message_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("clientMessageId", "clientId"),
        min_length=8,
        max_length=80,
    )
    message_type: str = Field(default="TEXT", alias="messageType")

    @model_validator(mode="after")
    def require_text_and_client(self) -> "SendMessageRequest":
        text = (self.content or self.body or "").strip()
        if not text:
            raise ValueError("Message body is required")
        self.content = text
        if not self.client_message_id:
            raise ValueError("clientMessageId is required")
        return self


class StartConversationRequest(SendMessageRequest):
    user_id: str = Field(
        validation_alias=AliasChoices("userId", "user_id"),
        min_length=8,
        max_length=80,
    )


class MessageCursorQuery(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    limit: int = Field(default=50, ge=1, le=100)
    cursor: str | None = None
