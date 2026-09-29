from pydantic import BaseModel, ConfigDict, Field


class JourneyCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_city: str = Field(default="", alias="fromCity")
    from_country: str = Field(default="", alias="fromCountry")
    from_country_code: str = Field(default="", alias="fromCountryCode")
    from_country_flag: str = Field(default="", alias="fromCountryFlag")
    from_state: str = Field(default="", alias="fromState")
    to_city: str = Field(default="", alias="toCity")
    to_country: str = Field(default="", alias="toCountry")
    to_country_code: str = Field(default="", alias="toCountryCode")
    to_country_flag: str = Field(default="", alias="toCountryFlag")
    to_state: str = Field(default="", alias="toState")
    departure: str = ""
    return_date: str = Field(default="", alias="returnDate")
    trip_type: str = Field(default="vacation", alias="tripType")
    travel_style: str = Field(default="solo", alias="travelStyle")
    companion: str = "any"
    description: str = ""
    cover_image: str | None = Field(default=None, alias="coverImage")
    hide_from_country: bool = Field(default=False, alias="hideFromCountry")
    hide_from: str | None = Field(default=None, alias="hideFrom")


class JourneyUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_city: str | None = Field(default=None, alias="fromCity")
    from_country: str | None = Field(default=None, alias="fromCountry")
    from_country_code: str | None = Field(default=None, alias="fromCountryCode")
    from_country_flag: str | None = Field(default=None, alias="fromCountryFlag")
    from_state: str | None = Field(default=None, alias="fromState")
    to_city: str | None = Field(default=None, alias="toCity")
    to_country: str | None = Field(default=None, alias="toCountry")
    to_country_code: str | None = Field(default=None, alias="toCountryCode")
    to_country_flag: str | None = Field(default=None, alias="toCountryFlag")
    to_state: str | None = Field(default=None, alias="toState")
    departure: str | None = None
    return_date: str | None = Field(default=None, alias="returnDate")
    trip_type: str | None = Field(default=None, alias="tripType")
    travel_style: str | None = Field(default=None, alias="travelStyle")
    companion: str | None = None
    description: str | None = None
    cover_image: str | None = Field(default=None, alias="coverImage")
    hide_from_country: bool | None = Field(default=None, alias="hideFromCountry")
    hide_from: str | None = Field(default=None, alias="hideFrom")
