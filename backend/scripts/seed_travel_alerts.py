"""Seed Travel Alert journeys that pass Create Journey visibility filters.

Development only. Safe to re-run. Does not target any real user profile.
Every generated trip is: companion=any, hide off, upcoming dates, real photos.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update

from app.config import AppEnv, get_settings
from app.core.country_iso import COUNTRY_ISO
from app.core.travel_rules import journey_status, usable_cover, usable_photo
from app.db.session import create_engine, create_session_factory
from app.models.orm import Profile, ProfileMedia, TravelJourney, User

INBOUND = [
    ("Paris", "France", "Delhi", "India", "vacation", "Just landed. Who knows the best cafes?"),
    ("London", "United Kingdom", "Delhi", "India", "business", "Work trip — free evenings."),
    ("Barcelona", "Spain", "Mumbai", "India", "vacation", "First week here. Street food crawl?"),
    ("New York", "United States", "Delhi", "India", "companion", "Looking for a local to explore."),
    ("Dubai", "United Arab Emirates", "Delhi", "India", "nightlife", "In from Dubai. Show me the rooftops."),
    ("Tokyo", "Japan", "Bengaluru", "India", "solo", "Photo walk through the city."),
    ("Seoul", "South Korea", "Delhi", "India", "vacation", "Arriving this week — food crawl?"),
    ("Berlin", "Germany", "Delhi", "India", "business", "Conference days, free after 7."),
    ("Singapore", "Singapore", "Goa", "India", "vacation", "Landing next week. Weekend plans?"),
    ("Istanbul", "Turkey", "Delhi", "India", "companion", "Need a travel buddy for markets."),
    ("Melbourne", "Australia", "Delhi", "India", "vacation", "Two weeks in town. Museums?"),
    ("Toronto", "Canada", "Gurugram", "India", "business", "Client meetings. Evenings open."),
    ("Bangkok", "Thailand", "Delhi", "India", "nightlife", "Just flew in. Night walk?"),
    ("Lisbon", "Portugal", "Jaipur", "India", "solo", "Slow travel. Coffee and quiet bars."),
    ("Amsterdam", "Netherlands", "Delhi", "India", "vacation", "In town for ten days."),
    ("Rome", "Italy", "Mumbai", "India", "vacation", "First time here. Old city walk?"),
    ("Sao Paulo", "Brazil", "Goa", "India", "nightlife", "Beach days then city nights."),
    ("Mexico City", "Mexico", "Delhi", "India", "companion", "Need a local for street food."),
    ("Stockholm", "Sweden", "Bengaluru", "India", "business", "Meetings by day, cafes after."),
    ("Zurich", "Switzerland", "Delhi", "India", "solo", "Quiet trip. Museums and walks."),
    ("Dublin", "Ireland", "Mumbai", "India", "vacation", "Long weekend in town."),
    ("Warsaw", "Poland", "Delhi", "India", "business", "Conference week. Evenings free."),
    ("Oslo", "Norway", "Goa", "India", "vacation", "Need beach recommendations."),
    ("Copenhagen", "Denmark", "Delhi", "India", "solo", "Design walk through the city."),
    ("Helsinki", "Finland", "Bengaluru", "India", "business", "Tech trip. Coffee after 6."),
    ("Athens", "Greece", "Delhi", "India", "vacation", "History nerd looking for company."),
    ("Vienna", "Austria", "Jaipur", "India", "companion", "Palaces then street food."),
    ("Brussels", "Belgium", "Delhi", "India", "business", "EU meetings. Free nights."),
    ("Prague", "Czechia", "Mumbai", "India", "vacation", "First week. Brewery crawl?"),
    ("Budapest", "Hungary", "Delhi", "India", "nightlife", "Thermal baths then rooftops."),
    ("Auckland", "New Zealand", "Goa", "India", "vacation", "Long stay. Weekend plans?"),
    ("Kuala Lumpur", "Malaysia", "Delhi", "India", "solo", "Food tour through the city."),
    ("Jakarta", "Indonesia", "Mumbai", "India", "companion", "Need a local for markets."),
    ("Manila", "Philippines", "Delhi", "India", "vacation", "Just landed. Night walk?"),
    ("Hanoi", "Vietnam", "Goa", "India", "vacation", "Street food first. Who's in?"),
    ("Cairo", "Egypt", "Delhi", "India", "companion", "Museums then old town."),
    ("Cape Town", "South Africa", "Bengaluru", "India", "vacation", "Two weeks. Hikes and cafes."),
    ("Buenos Aires", "Argentina", "Delhi", "India", "nightlife", "Late dinners. Show me around."),
    ("Santiago", "Chile", "Mumbai", "India", "business", "Client week. Evenings open."),
    ("Nairobi", "Kenya", "Delhi", "India", "vacation", "Just arrived. Coffee crawl?"),
]


def origin_flag(country: str) -> tuple[str, str]:
    code = COUNTRY_ISO.get(country.strip().lower(), "")
    flag = f"https://flagcdn.com/w80/{code}.png" if code else ""
    return code, flag


async def main() -> None:
    settings = get_settings()
    if settings.app_env != AppEnv.DEVELOPMENT:
        raise SystemExit("seed_travel_alerts.py is development-only")

    engine = create_engine(settings)
    factory = create_session_factory(engine)
    now = datetime.now(UTC)

    async with factory() as session:
        opened = await session.execute(
            update(TravelJourney).values(
                hide_from_country=False,
                hide_from=None,
                companion="any",
            )
        )
        normalized = opened.rowcount or 0

        rows = (await session.execute(select(TravelJourney))).scalars().all()
        bumped = 0
        for index, row in enumerate(rows):
            if journey_status(row.departure, row.return_date) == "landed":
                start = now + timedelta(days=3)
                row.departure = start.date().isoformat()
                row.return_date = (start + timedelta(days=8)).date().isoformat()
                row.status = "upcoming"
                bumped += 1
            frm_city, frm_country, _to_city, _to_country, _trip, _desc = INBOUND[
                index % len(INBOUND)
            ]
            from_code, from_flag = origin_flag(frm_country)
            row.from_city = frm_city
            row.from_country = frm_country
            row.from_country_code = from_code
            row.from_country_flag = from_flag
            if row.to_country:
                to_code, to_flag = origin_flag(row.to_country)
                row.to_country_code = to_code
                row.to_country_flag = to_flag

        existing_users = {
            user_id
            for (user_id,) in (
                await session.execute(select(TravelJourney.user_id).distinct())
            ).all()
        }
        profiles = (await session.execute(select(Profile))).scalars().all()
        used_countries = {row.from_country for row in rows if row.from_country}
        origin_index = len(rows)
        added = 0

        def next_origin() -> tuple[str, str, str, str, str, str]:
            nonlocal origin_index
            item = INBOUND[origin_index % len(INBOUND)]
            origin_index += 1
            return item

        for index, profile in enumerate(profiles):
            if profile.user_id in existing_users:
                continue
            user = await session.get(User, profile.user_id)
            if user is None:
                continue
            media = (
                await session.execute(
                    select(ProfileMedia)
                    .where(ProfileMedia.profile_id == profile.id)
                    .order_by(ProfileMedia.sort_order.asc())
                )
            ).scalars().first()
            frm_city, frm_country, to_city, to_country, trip, desc = next_origin()
            start = now + timedelta(days=2 + (index % 12))
            photo = usable_photo(media.url if media else None, profile.gender, index)
            from_code, from_flag = origin_flag(frm_country)
            to_code, to_flag = origin_flag(to_country)
            session.add(
                TravelJourney(
                    user_id=profile.user_id,
                    from_city=frm_city,
                    from_country=frm_country,
                    from_country_code=from_code,
                    from_country_flag=from_flag,
                    to_city=to_city,
                    to_country=to_country,
                    to_country_code=to_code,
                    to_country_flag=to_flag,
                    departure=start.date().isoformat(),
                    return_date=(start + timedelta(days=8)).date().isoformat(),
                    trip_type=trip,
                    travel_style="solo",
                    companion="any",
                    status="upcoming",
                    description=desc,
                    cover_image=usable_cover(photo, profile.gender, index),
                    hide_from_country=False,
                    hide_from=None,
                )
            )
            used_countries.add(frm_country)
            existing_users.add(profile.user_id)
            added += 1

        owners = [profile for profile in profiles if profile.user_id in existing_users]
        extra = 0
        for offset, inbound in enumerate(INBOUND):
            frm_city, frm_country, to_city, to_country, trip, desc = inbound
            if frm_country in used_countries or not owners:
                continue
            profile = owners[offset % len(owners)]
            media = (
                await session.execute(
                    select(ProfileMedia)
                    .where(ProfileMedia.profile_id == profile.id)
                    .order_by(ProfileMedia.sort_order.asc())
                )
            ).scalars().first()
            start = now + timedelta(days=4 + (offset % 10))
            from_code, from_flag = origin_flag(frm_country)
            to_code, to_flag = origin_flag(to_country)
            session.add(
                TravelJourney(
                    user_id=profile.user_id,
                    from_city=frm_city,
                    from_country=frm_country,
                    from_country_code=from_code,
                    from_country_flag=from_flag,
                    to_city=to_city,
                    to_country=to_country,
                    to_country_code=to_code,
                    to_country_flag=to_flag,
                    departure=start.date().isoformat(),
                    return_date=(start + timedelta(days=8)).date().isoformat(),
                    trip_type=trip,
                    travel_style="solo",
                    companion="any",
                    status="upcoming",
                    description=desc,
                    cover_image=usable_cover(
                        media.url if media else None, profile.gender, offset + 50
                    ),
                    hide_from_country=False,
                    hide_from=None,
                )
            )
            used_countries.add(frm_country)
            extra += 1

        await session.commit()
        print(
            f"Normalized {normalized} journeys, bumped {bumped} landed dates, "
            f"added {added} new arrivals, extra origins {extra}."
        )

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
