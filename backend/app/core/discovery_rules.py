from datetime import date

# Flutter filter labels → stored profile gender.
GENDER_FILTER_TO_PROFILE = {
    "Women": "Woman",
    "Men": "Man",
    "Non-binary": "Non-Binary",
    "Non-Binary": "Non-Binary",
    "woman": "woman",
    "man": "man",
    "nonbinary": "nonbinary",
    "transgender": "transgender",
}

# Ranking weights. Documented in docs/DISCOVERY.md. Not ML.
WEIGHT_INTEREST = 0.30
WEIGHT_DISTANCE = 0.25
WEIGHT_COMPLETENESS = 0.20
WEIGHT_ACTIVITY = 0.15
WEIGHT_VERIFIED = 0.10


def birth_date_bounds(min_age: int, max_age: int, today: date | None = None) -> tuple[date, date]:
    """Candidates with birth_date in (oldest_allowed, youngest_allowed].

    youngest_allowed = today - min_age years  (must be at least min_age)
    oldest_allowed = today - (max_age + 1) years  (must be at most max_age)
    """
    today = today or date.today()
    youngest = _shift_years(today, min_age)
    oldest = _shift_years(today, max_age + 1)
    return oldest, youngest


def _shift_years(value: date, years: int) -> date:
    try:
        return value.replace(year=value.year - years)
    except ValueError:
        return value.replace(year=value.year - years, day=28)


def profile_genders_for_filter(label: str) -> list[str] | None:
    if not label or label == "Everyone":
        return None
    mapped = GENDER_FILTER_TO_PROFILE.get(label)
    if mapped == "Woman":
        return ["Woman", "woman"]
    if mapped == "Man":
        return ["Man", "man"]
    if mapped == "Non-Binary":
        return ["Non-Binary", "Non-binary", "nonbinary"]
    if mapped:
        return [mapped, mapped.lower()]
    return None


def _canon_gender(value: str | None) -> str | None:
    raw = (value or "").strip().lower().replace("-", "").replace(" ", "")
    if raw in {"man", "men"}:
        return "man"
    if raw in {"woman", "women"}:
        return "woman"
    if raw in {"nonbinary", "nonbinaryperson"}:
        return "nonbinary"
    if raw in {"transgender", "trans", "other"}:
        return "transgender"
    return raw or None


def _canon_orientation(value: str | None) -> str | None:
    raw = (value or "").strip().lower()
    return raw or None


def audience_from_profile(
    gender: str | None, orientation: str | None
) -> dict[str, list[str] | str | None]:
    """Who a viewer should see from onboarding gender + sexual orientation.

    Straight + man → women. Straight + woman → men.
    Any other orientation → people who selected that same orientation.
    """
    gender_key = _canon_gender(gender)
    orientation_key = _canon_orientation(orientation)
    if not orientation_key:
        return {"gender_filter": None, "interested_in": None, "orientations": None}
    if orientation_key == "straight":
        if gender_key == "man":
            return {"gender_filter": "Women", "interested_in": ["woman"], "orientations": None}
        if gender_key == "woman":
            return {"gender_filter": "Men", "interested_in": ["man"], "orientations": None}
        return {
            "gender_filter": "Everyone",
            "interested_in": ["man", "woman"],
            "orientations": None,
        }
    return {
        "gender_filter": "Everyone",
        "interested_in": None,
        "orientations": [orientation_key],
    }
