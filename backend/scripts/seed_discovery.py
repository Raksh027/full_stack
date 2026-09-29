"""Development-only discovery seed users in Thailand.

Never run in production. Creates users only when APP_ENV=development.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, date, datetime
from uuid import uuid4

from geoalchemy2.elements import WKTElement
from sqlalchemy import select

from app.config import AppEnv, get_settings
from app.core.security import hash_password
from app.db.session import create_engine, create_session_factory
from app.models.orm import (
    Interest,
    Location,
    Preference,
    Profile,
    ProfileInterest,
    ProfileMedia,
    User,
    UserAuth,
    UserStatus,
)

# Realistic Thailand coordinates for local geospatial testing only.
SEEDS = [
    ("seed.bkk1@boomboom.dev", "Nok", 24, "Woman", 13.7563, 100.5018, "Bangkok", ["Travel"]),
    ("seed.bkk2@boomboom.dev", "Arm", 27, "Man", 13.7460, 100.5340, "Bangkok", ["Music"]),
    ("seed.bkk3@boomboom.dev", "Mint", 22, "Woman", 13.7300, 100.5200, "Bangkok", ["Art"]),
    ("seed.cnx1@boomboom.dev", "Ploy", 29, "Woman", 18.7883, 98.9853, "Chiang Mai", ["Hiking"]),
    ("seed.hkt1@boomboom.dev", "Bee", 31, "Man", 7.8804, 98.3923, "Phuket", ["Travel"]),
]


async def main() -> None:
    settings = get_settings()
    if settings.app_env != AppEnv.DEVELOPMENT:
        raise SystemExit("seed_discovery.py is development-only")
    engine = create_engine(settings)
    factory = create_session_factory(engine)
    async with factory() as session:
        catalog = {
            item.name: item.id
            for item in (await session.execute(select(Interest))).scalars()
        }
        for email, name, age, gender, lat, lon, city, interests in SEEDS:
            existing = await session.execute(select(UserAuth).where(UserAuth.email == email))
            if existing.scalar_one_or_none():
                continue
            user = User(status=UserStatus.ACTIVE.value, onboarding_completed=True)
            session.add(user)
            await session.flush()
            session.add(
                UserAuth(
                    user_id=user.id,
                    email=email,
                    password_hash=hash_password("SeedPass12!"),
                    email_verified_at=datetime.now(UTC),
                )
            )
            profile = Profile(
                user_id=user.id,
                display_name=name,
                bio=f"Dev seed profile in {city}",
                birth_date=date(date.today().year - age, 7, 1),
                gender=gender,
                orientation="Straight",
                looking_for="Dating",
            )
            session.add(profile)
            await session.flush()
            session.add(Preference(user_id=user.id))
            session.add(
                Location(
                    user_id=user.id,
                    geog=WKTElement(f"POINT({lon} {lat})", srid=4326),
                    city=city,
                    country="Thailand",
                )
            )
            session.add(
                ProfileMedia(
                    profile_id=profile.id,
                    url="https://example.com/seed.jpg",
                    storage_key=f"{user.id}/{uuid4()}.jpg",
                    is_primary=True,
                    moderation_status="APPROVED",
                )
            )
            for label in interests:
                interest_id = catalog.get(label)
                if interest_id:
                    session.add(ProfileInterest(profile_id=profile.id, interest_id=interest_id))
        await session.commit()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
