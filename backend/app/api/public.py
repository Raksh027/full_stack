"""Public Event share URLs and Digital Asset Links.

These routes are intentionally outside /api/v1. They must not replace
GET /api/v1/events/{event_id}, which remains the authenticated event detail API.
"""

from __future__ import annotations

import html
import json
import re

from fastapi import APIRouter, Response
from fastapi.responses import HTMLResponse

from app.config import get_settings

router = APIRouter(include_in_schema=False)

_EVENT_ID = re.compile(r"^[A-Za-z0-9_-]{1,80}$")


def valid_public_event_id(event_id: str) -> str | None:
    value = event_id.strip()
    if not value or ".." in value or "/" in value or " " in value:
        return None
    if value.lower() == "events":
        return None
    if not _EVENT_ID.fullmatch(value):
        return None
    return value


@router.get("/.well-known/assetlinks.json")
async def android_asset_links() -> Response:
    settings = get_settings()
    fingerprints = [
        item.strip()
        for item in settings.android_sha256_cert_fingerprints.split(",")
        if item.strip()
    ]
    payload: list[dict] = []
    if fingerprints:
        payload.append(
            {
                "relation": ["delegate_permission/common.handle_all_urls"],
                "target": {
                    "namespace": "android_app",
                    "package_name": settings.google_play_package_name,
                    "sha256_cert_fingerprints": fingerprints,
                },
            }
        )
    return Response(content=json.dumps(payload), media_type="application/json")


@router.get("/.well-known/apple-app-site-association")
async def apple_app_site_association() -> Response:
    settings = get_settings()
    team = settings.apple_team_id.strip()
    bundle = settings.apple_bundle_id.strip()
    app_id = f"{team}.{bundle}" if team else bundle
    payload = {
        "applinks": {
            "apps": [],
            "details": [
                {
                    "appID": app_id,
                    "paths": ["/events/*"],
                }
            ]
            if bundle
            else [],
        }
    }
    return Response(content=json.dumps(payload), media_type="application/json")


@router.get("/events/{event_id}")
async def event_share_landing(event_id: str) -> HTMLResponse:
    valid = valid_public_event_id(event_id)
    if valid is None:
        return HTMLResponse("<p>Event not found.</p>", status_code=404)
    settings = get_settings()
    origin = settings.public_app_origin.rstrip("/")
    https_url = html.escape(f"{origin}/events/{valid}")
    app_url = html.escape(f"boomboom://events/{valid}")
    body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>BoomBoom Event</title>
  <meta http-equiv="refresh" content="0;url={app_url}"/>
</head>
<body>
  <p>Opening this event in BoomBoom…</p>
  <p><a href="{app_url}">Open in app</a></p>
  <p><a href="{https_url}">{https_url}</a></p>
</body>
</html>
"""
    return HTMLResponse(body)
