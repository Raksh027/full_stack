from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class PurchaseProof(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    platform: str
    product_id: str = Field(alias="productId")
    purchase_token: str = Field(validation_alias=AliasChoices("purchaseToken", "receipt"))
    application_id: str | None = Field(default=None, alias="applicationId")


class RazorpayOrderBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    product_id: str = Field(alias="productId")


class RazorpayVerifyBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    product_id: str = Field(alias="productId")
    order_id: str = Field(alias="orderId")
    payment_id: str = Field(alias="paymentId")
    signature: str


class RestoreBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    purchases: list[PurchaseProof] = Field(default_factory=list)
