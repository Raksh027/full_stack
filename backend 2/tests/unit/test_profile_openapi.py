from fastapi import FastAPI

from app.api.v1.router import api_router


def test_openapi_contains_profile_paths() -> None:
    app = FastAPI()
    app.include_router(api_router)
    paths = app.openapi()["paths"]
    assert "/api/v1/profile" in paths
    assert "/api/v1/profiles/{user_id}" in paths
    assert "/api/v1/profile/preferences" in paths
    assert "/api/v1/profile/interests" in paths
    assert "/api/v1/profile/location" in paths
    assert "/api/v1/profile/completion" in paths
    assert "/api/v1/interests" in paths
    assert "/api/v1/media/upload-url" in paths
    assert "/api/v1/profile/media" in paths
    assert "/api/v1/profile/media/{media_id}" in paths
