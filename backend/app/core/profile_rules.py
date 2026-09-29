from datetime import date

GENDERS = frozenset(
    {
        "Man",
        "Woman",
        "Non-Binary",
        "Other",
        "man",
        "woman",
        "transgender",
        "nonbinary",
    }
)
ORIENTATIONS = frozenset(
    {
        "Straight",
        "Gay",
        "Lesbian",
        "Bisexual",
        "Queer",
        "straight",
        "gay",
        "lesbian",
        "bisexual",
        "pansexual",
        "queer",
        "asexual",
        "demisexual",
        "questioning",
    }
)
LOOKING_FOR = frozenset(
    {
        "Dating",
        "Friendship",
        "Casual Fun",
        "Long-term Relationship",
        "Networking",
        "serious_love",
        "marriage",
        "casual",
        "long_term",
        "short_term",
        "travel_partner",
        "new_friends",
        "mutual_support",
        "freelance",
    }
)
GENDER_FILTERS = frozenset({"Everyone", "Women", "Men", "Non-binary", "Non-Binary"})
VISIBILITY = frozenset({"PUBLIC", "HIDDEN", "MATCHES_ONLY"})
ONBOARDING_STEPS = (
    "gender",
    "orientation",
    "looking_for",
    "interests",
    "photos",
    "details",
    "completed",
)
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/webp": {".webp"},
}
INTEREST_CATALOG = (
    "Travel",
    "Music",
    "Fitness",
    "Cooking",
    "Photography",
    "Art",
    "Movies",
    "Gaming",
    "Reading",
    "Sports",
    "Yoga",
    "Coffee",
    "Dancing",
    "Nature",
    "Pets",
    "Food",
    "Fashion",
    "Tech",
    "Hiking",
    "Swimming",
)


def slugify(name: str) -> str:
    return name.strip().lower().replace(" ", "-")


def zodiac_from_birth_date(birth_date: date | None) -> str:
    if birth_date is None:
        return ""
    month, day = birth_date.month, birth_date.day
    if (month == 3 and day >= 21) or (month == 4 and day <= 19):
        return "Aries"
    if (month == 4 and day >= 20) or (month == 5 and day <= 20):
        return "Taurus"
    if (month == 5 and day >= 21) or (month == 6 and day <= 20):
        return "Gemini"
    if (month == 6 and day >= 21) or (month == 7 and day <= 22):
        return "Cancer"
    if (month == 7 and day >= 23) or (month == 8 and day <= 22):
        return "Leo"
    if (month == 8 and day >= 23) or (month == 9 and day <= 22):
        return "Virgo"
    if (month == 9 and day >= 23) or (month == 10 and day <= 22):
        return "Libra"
    if (month == 10 and day >= 23) or (month == 11 and day <= 21):
        return "Scorpio"
    if (month == 11 and day >= 22) or (month == 12 and day <= 21):
        return "Sagittarius"
    if (month == 12 and day >= 22) or (month == 1 and day <= 19):
        return "Capricorn"
    return "Aquarius"


def age_from_birth_date(birth_date: date, today: date | None = None) -> int:
    today = today or date.today()
    years = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        years -= 1
    return years


def birth_date_from_age(age: int, today: date | None = None) -> date:
    today = today or date.today()
    try:
        return today.replace(year=today.year - age)
    except ValueError:
        return today.replace(year=today.year - age, day=28)


def place_name(
    locality: str | None = None,
    city: str | None = None,
    district: str | None = None,
    region: str | None = None,
    country: str | None = None,
) -> str | None:
    for value in (locality, city, district, region, country):
        text = (value or "").strip()
        if text:
            return text
    return None


def format_location(city: str | None, country: str | None, region: str | None = None) -> str:
    parts = [part for part in (city, region, country) if part]
    if city and country:
        return f"{city}, {country}"
    return ", ".join(parts)


def parse_location_text(value: str) -> tuple[str | None, str | None]:
    text = value.strip()
    if not text:
        return None, None
    if "," in text:
        city, country = text.split(",", 1)
        return city.strip() or None, country.strip() or None
    return text, None
