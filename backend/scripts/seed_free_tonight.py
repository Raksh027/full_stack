"""Refresh Free Tonight posts and add complete nearby cards.

Development only. Safe to re-run.
Does not hardcode app behavior for any real profile. Pass --email to also
create a live post as that user and seed nearby people around their stored GPS.
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import UTC, date, datetime, timedelta
from uuid import uuid4

from geoalchemy2.elements import WKTElement
from sqlalchemy import select

from app.config import AppEnv, get_settings
from app.core.country_iso import COUNTRY_ISO
from app.core.mobile_maps import flag_image_url
from app.core.security import hash_password
from app.core.tonight_rules import (
    DEFAULT_LOOKING_FOR,
    default_looking_for,
    normalize_tonight_activity,
)
from app.db.session import create_engine, create_session_factory
from app.models.orm import (
    Location,
    Preference,
    Profile,
    ProfileMedia,
    TonightPost,
    User,
    UserAuth,
    UserStatus,
    VerificationStatus,
)

PASSWORD = "SeedPass12!"
LIVE_HOURS = 14

FEATURED = {
    "dinner": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    "drinks": "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80",
    "partyBuddy": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
    "cityTour": "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80",
    "dating": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
}

NEARBY = [
    {
        "email": "tonight.near.maya@boomboom.dev",
        "name": "Maya",
        "age": 24,
        "activity": "dinner",
        "meet_time": "8:00 PM",
        "photo": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80",
        "tagline": "Looking to make good memories tonight ✨",
        "offset": (0.006, 0.008),
        "spot": "Bistro",
    },
    {
        "email": "tonight.near.elena@boomboom.dev",
        "name": "Elena",
        "age": 26,
        "activity": "drinks",
        "meet_time": "9:00 PM",
        "photo": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80",
        "tagline": "Cocktails and conversations tonight 🍸",
        "offset": (-0.008, 0.007),
        "spot": "Wine bar",
    },
    {
        "email": "tonight.near.sofia@boomboom.dev",
        "name": "Sofia",
        "age": 25,
        "activity": "partyBuddy",
        "meet_time": "10:00 PM",
        "photo": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
        "tagline": "Party mood on. Need a buddy 🎉",
        "offset": (0.01, -0.006),
        "spot": "Rooftop",
    },
    {
        "email": "tonight.near.priya@boomboom.dev",
        "name": "Priya",
        "age": 23,
        "activity": "cityTour",
        "meet_time": "7:00 PM",
        "photo": "https://images.unsplash.com/photo-1524504388940-b1c17226555e?auto=format&fit=crop&w=800&q=80",
        "tagline": "Down for a spontaneous city walk ✨",
        "offset": (-0.007, -0.009),
        "spot": "City lights",
    },
    {
        "email": "tonight.near.amara@boomboom.dev",
        "name": "Amara",
        "age": 27,
        "activity": "dating",
        "meet_time": "8:30 PM",
        "photo": "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80",
        "tagline": "Open to a genuine connection tonight ✨",
        "offset": (0.004, -0.01),
        "spot": "Dinner date",
    },
    {
        "email": "tonight.near.luna@boomboom.dev",
        "name": "Luna",
        "age": 22,
        "activity": "drinks",
        "meet_time": "9:30 PM",
        "photo": "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7d?auto=format&fit=crop&w=800&q=80",
        "tagline": "After-work drinks? Count me in.",
        "offset": (0.012, 0.004),
        "spot": "Lounge",
    },
    {
        "email": "tonight.near.nina@boomboom.dev",
        "name": "Nina",
        "age": 28,
        "activity": "dinner",
        "meet_time": "7:30 PM",
        "photo": "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=80",
        "tagline": "Last-minute table for two.",
        "offset": (-0.005, 0.011),
        "spot": "Kitchen",
    },
]


def birth_for(age: int) -> date:
    today = date.today()
    return date(today.year - age, 6, 15)


def country_visual(country: str | None, code: str | None) -> tuple[str, str]:
    iso = (code or "").strip().lower()
    if len(iso) != 2:
        iso = COUNTRY_ISO.get((country or "").strip().lower(), "")
    return iso, flag_image_url(iso)


def place_label(location: Location | None) -> str:
    if location is None:
        return "Downtown"
    for value in (location.locality, location.city, location.district, location.region, location.country):
        if value and value.strip():
            return value.strip()
    return "Downtown"


def venue_for(item: dict, location: Location | None) -> str:
    city = (location.city if location and location.city else None) or "Downtown"
    locality = (location.locality if location and location.locality else None) or city
    return f"{item['spot']}, {locality}"


async def user_by_email(session, email: str) -> User | None:
    auth = (
        await session.execute(select(UserAuth).where(UserAuth.email == email.lower()))
    ).scalar_one_or_none()
    if auth is None:
        return None
    return await session.get(User, auth.user_id)


async def refresh_existing(session, now: datetime) -> int:
    rows = (await session.execute(select(TonightPost))).scalars().all()
    for row in rows:
        row.activity = normalize_tonight_activity(row.activity)
        row.expires_at = now + timedelta(hours=LIVE_HOURS)
        if not (row.looking_for or "").strip():
            row.looking_for = default_looking_for(row.activity)
        if not (row.tagline or "").strip():
            row.tagline = DEFAULT_LOOKING_FOR[row.activity]
        if not (row.featured_photo or "").strip():
            row.featured_photo = FEATURED[row.activity]
        if not (row.meet_time or "").strip():
            row.meet_time = "8:00 PM"
        if not (row.venue or "").strip():
            row.venue = "Downtown"
    return len(rows)


async def upsert_post(
    session,
    user_id,
    *,
    activity: str,
    venue: str,
    tagline: str,
    looking_for: str,
    meet_time: str,
    featured_photo: str | None,
    now: datetime,
) -> TonightPost:
    existing = (
        await session.execute(
            select(TonightPost).where(TonightPost.user_id == user_id).order_by(TonightPost.created_at.desc())
        )
    ).scalars().first()
    if existing is None:
        existing = TonightPost(user_id=user_id)
        session.add(existing)
    existing.activity = normalize_tonight_activity(activity)
    existing.venue = venue
    existing.tagline = tagline
    existing.looking_for = looking_for
    existing.meet_time = meet_time
    existing.featured_photo = featured_photo
    existing.expires_at = now + timedelta(hours=LIVE_HOURS)
    return existing


async def ensure_nearby_user(
    session,
    item: dict,
    host_loc: Location,
    lon: float,
    lat: float,
    now: datetime,
) -> User:
    user = await user_by_email(session, item["email"])
    dlat, dlon = item["offset"]
    iso, flag = country_visual(host_loc.country, host_loc.country_code)
    city = host_loc.city or "Downtown"
    region = host_loc.region
    country = host_loc.country or "United States"

    if user is None:
        user = User(
            status=UserStatus.ACTIVE.value,
            onboarding_completed=True,
            onboarding_step="done",
            last_active_at=now,
        )
        session.add(user)
        await session.flush()
        session.add(
            UserAuth(
                user_id=user.id,
                email=item["email"],
                password_hash=hash_password(PASSWORD),
                provider="email",
                email_verified_at=now,
            )
        )
        profile = Profile(
            user_id=user.id,
            display_name=item["name"],
            bio=item["tagline"],
            birth_date=birth_for(item["age"]),
            gender="woman",
            orientation="straight",
            looking_for="casual",
            show_orientation=True,
            languages=["english"],
            work_category="entertainment",
            job_title="Guest",
            height_cm=165,
            lifestyle={
                "ethnicity": "mixed",
                "bodyType": "slim",
                "heightRange": "average",
                "eyeColor": "brown",
                "smoking": "non_smoker",
                "drinking": "social",
                "workout": "sometimes",
                "personality": "adventurous",
            },
            nationality=country,
            verification_status=VerificationStatus.VERIFIED.value,
        )
        session.add(profile)
        await session.flush()
        session.add(
            Preference(
                user_id=user.id,
                min_age=18,
                max_age=45,
                max_distance_km=80,
                gender_filter="Everyone",
                is_discoverable=True,
            )
        )
        session.add(
            ProfileMedia(
                profile_id=profile.id,
                url=item["photo"],
                thumbnail_url=item["photo"],
                storage_key=f"tonight-near/{user.id}/0-{uuid4().hex}.jpg",
                media_type="image",
                sort_order=0,
                is_primary=True,
                moderation_status="APPROVED",
            )
        )
    else:
        profile = (
            await session.execute(select(Profile).where(Profile.user_id == user.id))
        ).scalar_one_or_none()
        if profile is not None:
            profile.display_name = item["name"]
            profile.bio = item["tagline"]
            profile.gender = "woman"
            profile.orientation = "straight"
            profile.nationality = country

    location = (
        await session.execute(select(Location).where(Location.user_id == user.id))
    ).scalar_one_or_none()
    point = WKTElement(f"POINT({lon + dlon} {lat + dlat})", srid=4326)
    if location is None:
        session.add(
            Location(
                user_id=user.id,
                geog=point,
                city=city,
                locality=host_loc.locality,
                district=host_loc.district,
                region=region,
                country=country,
                country_code=iso or host_loc.country_code,
                country_flag=flag or host_loc.country_flag,
                location_updated_at=now,
            )
        )
    else:
        location.geog = point
        location.city = city
        location.locality = host_loc.locality
        location.district = host_loc.district
        location.region = region
        location.country = country
        location.country_code = iso or host_loc.country_code
        location.country_flag = flag or host_loc.country_flag
        location.location_updated_at = now

    user.last_active_at = now
    user.onboarding_completed = True
    return user


def geog_lon_lat(location: Location) -> tuple[float, float] | None:
    raw = location.geog
    if raw is None:
        return None
    data = getattr(raw, "data", None)
    if data is not None and hasattr(data, "x") and hasattr(data, "y"):
        return float(data.x), float(data.y)
    desc = str(raw)
    if "POINT" in desc.upper():
        inner = desc[desc.find("(") + 1 : desc.find(")")]
        parts = inner.replace(",", " ").split()
        if len(parts) >= 2:
            return float(parts[0]), float(parts[1])
    return None


async def coords_for(session, location: Location) -> tuple[float, float] | None:
    parsed = geog_lon_lat(location)
    if parsed:
        return parsed
    from sqlalchemy import text

    row = (
        await session.execute(
            text("SELECT ST_X(geog::geometry), ST_Y(geog::geometry) FROM locations WHERE id = :id"),
            {"id": location.id},
        )
    ).first()
    if row and row[0] is not None and row[1] is not None:
        return float(row[0]), float(row[1])
    return None


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--email",
        default="",
        help="Optional real account to create a tonight post as, and to seed nearby people around.",
    )
    args = parser.parse_args()

    settings = get_settings()
    if settings.app_env != AppEnv.DEVELOPMENT:
        raise SystemExit("seed_free_tonight.py is development-only")

    engine = create_engine(settings)
    factory = create_session_factory(engine)
    now = datetime.now(UTC)
    host_email = (args.email or "").strip().lower()

    async with factory() as session:
        refreshed = await refresh_existing(session, now)

        host_post = 0
        nearby_posts = 0
        if host_email:
            host = await user_by_email(session, host_email)
            if host is None:
                raise SystemExit(f"No user for {host_email}")
            host_loc = (
                await session.execute(select(Location).where(Location.user_id == host.id))
            ).scalar_one_or_none()
            host_profile = (
                await session.execute(select(Profile).where(Profile.user_id == host.id))
            ).scalar_one_or_none()
            photo_row = None
            if host_profile is not None:
                photo_row = (
                    await session.execute(
                        select(ProfileMedia)
                        .where(
                            ProfileMedia.profile_id == host_profile.id,
                            ProfileMedia.deleted_at.is_(None),
                        )
                        .order_by(ProfileMedia.is_primary.desc(), ProfileMedia.sort_order)
                    )
                ).scalars().first()
            place = place_label(host_loc)
            await upsert_post(
                session,
                host.id,
                activity="dating",
                venue=place,
                tagline="Free tonight — dinner, drinks, or a walk.",
                looking_for=default_looking_for("dating"),
                meet_time="8:00 PM",
                featured_photo=(photo_row.url if photo_row else FEATURED["dating"]),
                now=now,
            )
            host_post = 1

            coords = await coords_for(session, host_loc) if host_loc is not None else None
            if host_loc is not None and coords is not None:
                lon, lat = coords
                for item in NEARBY:
                    user = await ensure_nearby_user(session, item, host_loc, lon, lat, now)
                    await upsert_post(
                        session,
                        user.id,
                        activity=item["activity"],
                        venue=venue_for(item, host_loc),
                        tagline=item["tagline"],
                        looking_for=default_looking_for(item["activity"]),
                        meet_time=item["meet_time"],
                        featured_photo=FEATURED[item["activity"]],
                        now=now,
                    )
                    nearby_posts += 1

        await session.commit()
        print(f"Refreshed existing tonight posts: {refreshed}")
        print(f"Host post created/updated: {host_post}")
        print(f"Nearby complete posts: {nearby_posts}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
