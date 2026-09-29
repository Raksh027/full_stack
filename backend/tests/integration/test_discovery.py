import uuid

import pytest
from sqlalchemy import select, text

from app.models.orm import Profile, ProfileMedia
from tests.isolation import IsolatedApp

pytestmark = pytest.mark.integration

BKK = {"latitude": 13.7563, "longitude": 100.5018, "city": "Bangkok", "country": "Thailand"}
BKK_NEAR = {"latitude": 13.7600, "longitude": 100.5050, "city": "Bangkok", "country": "Thailand"}
PHUKET = {"latitude": 7.8804, "longitude": 98.3923, "city": "Phuket", "country": "Thailand"}


@pytest.fixture
async def client(isolated_app: IsolatedApp):
    yield isolated_app.http, isolated_app.otp, isolated_app.factory


async def _register(client):
    http, provider, factory = client
    email = f"disc.{uuid.uuid4().hex[:10]}@boomboom.app"
    password = "password12"
    register = await http.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert register.status_code == 201
    code = provider.codes["signup:" + email]
    verified = await http.post("/api/v1/auth/verify-otp", json={"email": email, "otp": code})
    token = verified.json()["data"]["accessToken"]
    user_id = verified.json()["data"]["userId"]
    return http, {"Authorization": f"Bearer {token}"}, user_id, factory


async def _add_photo(factory, user_id: str) -> None:
    async with factory() as session:
        result = await session.execute(select(Profile).where(Profile.user_id == uuid.UUID(user_id)))
        profile = result.scalar_one()
        session.add(
            ProfileMedia(
                profile_id=profile.id,
                url="https://example.com/seed.jpg",
                storage_key=f"{user_id}/{uuid.uuid4()}.jpg",
                media_type="image",
                sort_order=0,
                is_primary=True,
                moderation_status="APPROVED",
            )
        )
        await session.commit()


async def _ready(
    client,
    *,
    name: str,
    age: int,
    gender: str,
    location: dict,
    looking_for: str = "Dating",
    interests: list[str] | None = None,
    visibility: str | None = None,
):
    http, headers, user_id, factory = await _register(client)
    payload = {
        "displayName": name,
        "bio": f"Hi, I am {name}",
        "age": age,
        "gender": gender,
        "orientation": "Straight",
        "lookingFor": looking_for,
    }
    if visibility:
        payload["visibility"] = visibility
    patched = await http.patch("/api/v1/profile", headers=headers, json=payload)
    assert patched.status_code == 200
    await http.put(
        "/api/v1/profile/interests",
        headers=headers,
        json={"names": interests or ["Travel", "Music", "Art"]},
    )
    loc = await http.patch("/api/v1/profile/location", headers=headers, json=location)
    assert loc.status_code == 200
    await _add_photo(factory, user_id)
    return http, headers, user_id


async def _collect_feed(http, headers, query: str) -> list[dict]:
    items: list[dict] = []
    cursor = None
    for _ in range(10):
        suffix = f"{query}&cursor={cursor}" if cursor else query
        feed = await http.get(f"/api/v1/discovery?{suffix}", headers=headers)
        assert feed.status_code == 200
        body = feed.json()["data"]
        items.extend(body["items"])
        if not body.get("hasMore") or not body.get("nextCursor"):
            break
        cursor = body["nextCursor"]
    return items


async def test_discovery_requires_auth(client) -> None:
    http, _, _ = client
    response = await http.get("/api/v1/discovery")
    assert response.status_code == 401


async def test_discovery_excludes_self_and_returns_nearby(client) -> None:
    http, headers, viewer = await _ready(
        client, name="Viewer", age=24, gender="Woman", location=BKK
    )
    _, _, other = await _ready(client, name="Near", age=26, gender="Man", location=BKK_NEAR)
    items = await _collect_feed(http, headers, "maxDistanceKm=20&limit=50")
    ids = [item["id"] for item in items]
    assert viewer not in ids
    assert other in ids
    card = next(item for item in items if item["id"] == other)
    assert card["name"] == "Near"
    assert card["age"] == 26
    assert "birthDate" not in card
    assert "latitude" not in card
    assert "email" not in card
    assert card["distanceKm"] >= 0
    assert card["location"]


async def test_discovery_distance_and_age_and_gender_filters(client) -> None:
    http, headers, _ = await _ready(client, name="Viewer", age=24, gender="Woman", location=BKK)
    await _ready(client, name="Far", age=25, gender="Man", location=PHUKET)
    await _ready(client, name="Older", age=45, gender="Man", location=BKK_NEAR)
    await _ready(client, name="WomanNear", age=25, gender="Woman", location=BKK_NEAR)
    far = await http.get("/api/v1/discovery?maxDistanceKm=30", headers=headers)
    names = {item["name"] for item in far.json()["data"]["items"]}
    assert "Far" not in names
    aged = await http.get("/api/v1/discovery?minAge=18&maxAge=30&maxDistanceKm=30", headers=headers)
    names = {item["name"] for item in aged.json()["data"]["items"]}
    assert "Older" not in names
    gendered = await http.get("/api/v1/discovery?gender=Men&maxDistanceKm=30", headers=headers)
    for item in gendered.json()["data"]["items"]:
        assert item["gender"] == "Man"


async def test_discovery_blocks_hidden_and_impressions(client) -> None:
    http, headers, _ = await _ready(client, name="Viewer", age=24, gender="Woman", location=BKK)
    _, _, hidden_id = await _ready(
        client,
        name="Ghost",
        age=25,
        gender="Man",
        location=BKK_NEAR,
        visibility="HIDDEN",
    )
    _, blocked_headers, blocked_id = await _ready(
        client, name="Blocked", age=25, gender="Man", location=BKK_NEAR
    )
    await http.post("/api/v1/safety/blocks", headers=headers, json={"userId": blocked_id})
    _, _, seen_id = await _ready(client, name="Seen", age=25, gender="Man", location=BKK_NEAR)
    await http.post(
        "/api/v1/discovery/impressions",
        headers=headers,
        json={"userIds": [seen_id]},
    )
    feed = await http.get("/api/v1/discovery?maxDistanceKm=30", headers=headers)
    ids = {item["id"] for item in feed.json()["data"]["items"]}
    assert hidden_id not in ids
    assert blocked_id not in ids
    assert seen_id not in ids
    blocked_view = await http.get("/api/v1/discovery?maxDistanceKm=30", headers=blocked_headers)
    assert blocked_view.status_code == 200


async def test_discovery_pagination_and_invalid_cursor(client) -> None:
    http, headers, _ = await _ready(client, name="Viewer", age=24, gender="Woman", location=BKK)
    for index in range(3):
        await _ready(
            client,
            name=f"Page{index}",
            age=24 + index,
            gender="Man",
            location=BKK_NEAR,
        )
    first = await http.get("/api/v1/discovery?maxDistanceKm=30&limit=2", headers=headers)
    assert first.status_code == 200
    data = first.json()["data"]
    assert len(data["items"]) == 2
    assert data["hasMore"] is True
    cursor = data["nextCursor"]
    second = await http.get(
        f"/api/v1/discovery?maxDistanceKm=30&limit=2&cursor={cursor}",
        headers=headers,
    )
    assert second.status_code == 200
    first_ids = {item["id"] for item in data["items"]}
    second_ids = {item["id"] for item in second.json()["data"]["items"]}
    assert first_ids.isdisjoint(second_ids)
    bad = await http.get("/api/v1/discovery?cursor=not-a-cursor", headers=headers)
    assert bad.status_code in {400, 403}


async def test_discovery_empty_without_location(client) -> None:
    http, headers, _user_id, _factory = await _register(client)
    feed = await http.get("/api/v1/discovery", headers=headers)
    assert feed.status_code == 200
    assert feed.json()["data"]["items"] == []
    assert feed.json()["data"]["hasMore"] is False


async def test_discovery_excludes_inactive_and_respects_mutual_prefs(client) -> None:
    http, headers, _ = await _ready(client, name="Viewer", age=24, gender="Woman", location=BKK)
    _, _, banned_id = await _ready(client, name="Banned", age=25, gender="Man", location=BKK_NEAR)
    factory = client[2]
    async with factory() as session:
        await session.execute(
            text("UPDATE users SET status = 'BANNED' WHERE id = CAST(:id AS uuid)"),
            {"id": banned_id},
        )
        await session.commit()
    _, _, picky_id = await _ready(client, name="Picky", age=25, gender="Man", location=BKK_NEAR)
    async with factory() as session:
        await session.execute(
            text("UPDATE preferences SET gender_filter = 'Men' WHERE user_id = CAST(:id AS uuid)"),
            {"id": picky_id},
        )
        await session.commit()
    feed = await http.get("/api/v1/discovery?maxDistanceKm=30", headers=headers)
    ids = {item["id"] for item in feed.json()["data"]["items"]}
    assert banned_id not in ids
    assert picky_id not in ids


async def test_discovery_interest_filter_and_foreign_cursor(client) -> None:
    http, headers, _ = await _ready(
        client, name="Viewer", age=24, gender="Woman", location=BKK, interests=["Travel"]
    )
    await _ready(
        client,
        name="Traveler",
        age=25,
        gender="Man",
        location=BKK_NEAR,
        interests=["Travel"],
    )
    await _ready(
        client,
        name="Gamer",
        age=25,
        gender="Man",
        location=BKK_NEAR,
        interests=["Gaming"],
    )
    items = await _collect_feed(http, headers, "maxDistanceKm=30&interests=Travel&limit=50")
    names = {item["name"] for item in items}
    assert "Traveler" in names
    assert "Gamer" not in names
    first = await http.get("/api/v1/discovery?maxDistanceKm=30&limit=1", headers=headers)
    cursor = first.json()["data"]["nextCursor"]
    _, other_headers, _ = await _ready(client, name="Other", age=24, gender="Woman", location=BKK)
    stolen = await http.get(
        f"/api/v1/discovery?cursor={cursor}",
        headers=other_headers,
    )
    assert stolen.status_code in {400, 403}


async def test_public_profile_from_discovery(client) -> None:
    http, headers, _ = await _ready(client, name="Viewer", age=24, gender="Woman", location=BKK)
    _, _, other = await _ready(client, name="Card", age=27, gender="Man", location=BKK_NEAR)
    public = await http.get(f"/api/v1/profiles/{other}", headers=headers)
    assert public.status_code == 200
    assert public.json()["data"]["name"] == "Card"
    assert "birthDate" not in public.json()["data"]
    assert "latitude" not in public.json()["data"]
