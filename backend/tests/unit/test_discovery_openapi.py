from fastapi import FastAPI

from app.api.v1.router import api_router


def test_openapi_contains_discovery_paths() -> None:
    app = FastAPI()
    app.include_router(api_router)
    paths = app.openapi()["paths"]
    assert "/api/v1/discovery" in paths
    assert "/api/v1/discovery/impressions" in paths
    assert "/api/v1/safety/blocks" in paths
    assert "/api/v1/safety/blocks/{user_id}" in paths
