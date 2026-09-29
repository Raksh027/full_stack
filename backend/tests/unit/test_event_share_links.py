from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.public import router as public_router, valid_public_event_id
from app.api.v1.router import api_router


def _app() -> FastAPI:
    app = FastAPI()
    app.include_router(public_router)
    app.include_router(api_router)
    return app


def test_valid_public_event_id_rejects_traversal() -> None:
    assert valid_public_event_id("evt-9") == "evt-9"
    assert valid_public_event_id("..") is None
    assert valid_public_event_id("events") is None
    assert valid_public_event_id("") is None


def test_share_landing_does_not_use_the_events_api() -> None:
    response = TestClient(_app()).get("/events/evt-9")
    assert response.status_code == 200
    assert "boomboom://events/evt-9" in response.text
    assert "https://boomboom.app/events/evt-9" in response.text
    assert "/api/v1/events" not in response.text


def test_share_landing_rejects_bad_ids() -> None:
    assert TestClient(_app()).get("/events/events").status_code == 404


def test_well_known_link_files_are_json() -> None:
    client = TestClient(_app())
    android = client.get("/.well-known/assetlinks.json")
    apple = client.get("/.well-known/apple-app-site-association")
    assert android.status_code == 200
    assert android.headers["content-type"].startswith("application/json")
    assert android.json() == []
    assert apple.status_code == 200
    assert apple.headers["content-type"].startswith("application/json")
    body = apple.json()
    assert body["applinks"]["details"][0]["paths"] == ["/events/*"]


def test_public_share_path_is_not_under_api_v1() -> None:
    response = TestClient(_app()).get("/events/evt-9")
    assert response.status_code == 200
    assert not response.url.path.startswith("/api/")
