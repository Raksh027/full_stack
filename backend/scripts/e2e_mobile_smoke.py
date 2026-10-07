"""Live smoke against the running API. Prints statuses only, never tokens."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = "http://127.0.0.1:8080/api/v1"
STAMP = str(int(time.time()))
EMAIL_A = f"e2e.a.{STAMP}@example.com"
EMAIL_B = f"e2e.b.{STAMP}@example.com"


def call(method: str, path: str, body: dict | None = None, token: str | None = None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Accept", "application/json")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"raw": raw[:180]}
        return exc.code, payload


def ok(status: int) -> bool:
    return 200 <= status < 300


def show(name: str, status: int, payload: dict) -> None:
    err = ""
    if not ok(status):
        error = payload.get("error") if isinstance(payload, dict) else None
        if isinstance(error, dict):
            err = f" {error.get('code')}: {error.get('message')}"
        else:
            err = f" {payload}"
    print(f"{name}: {status}{err}")


def otp_login(email: str) -> tuple[str, dict]:
    status, payload = call("POST", "/auth/otp/request", {"email": email})
    show(f"otp.request {email}", status, payload)
    query = urllib.parse.urlencode({"email": email, "purpose": "signup"})
    status, payload = call("GET", f"/auth/dev/otp?{query}")
    code = (payload.get("data") or {}).get("otp") if ok(status) else None
    if not code:
        query = urllib.parse.urlencode({"email": email, "purpose": "login"})
        status, payload = call("GET", f"/auth/dev/otp?{query}")
        code = (payload.get("data") or {}).get("otp") if ok(status) else None
    show("otp.peek", status, {} if code else payload)
    status, payload = call("POST", "/auth/otp/verify", {"email": email, "code": code or "0000"})
    show("otp.verify", status, payload if not ok(status) else {})
    data = payload.get("data") or {}
    token = ((data.get("tokens") or {}).get("accessToken")) or data.get("accessToken")
    return token or "", data


JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"


def upload_photo(token: str, name: str) -> None:
    status, payload = call(
        "POST",
        "/profiles/me/photos/upload-url",
        {"contentType": "image/jpeg", "fileSize": len(JPEG)},
        token,
    )
    show(f"photo.ticket {name}", status, payload if not ok(status) else {})
    data = payload.get("data") or {}
    upload_url = data.get("uploadUrl")
    photo_id = data.get("photoId")
    if not upload_url or not photo_id:
        return
    if upload_url.startswith("/"):
        upload_url = "http://127.0.0.1:8080" + upload_url
    req = urllib.request.Request(upload_url, data=JPEG, method="PUT")
    req.add_header("Content-Type", "image/jpeg")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            show(f"photo.put {name}", resp.status, {})
    except urllib.error.HTTPError as exc:
        show(f"photo.put {name}", exc.code, {"error": {"message": exc.read().decode()[:160]}})
        return
    status, payload = call("POST", f"/profiles/me/photos/{photo_id}/confirm", None, token)
    show(f"photo.confirm {name}", status, payload if not ok(status) else {})


def setup(token: str, name: str, gender: str) -> None:
    status, payload = call(
        "PATCH",
        "/profiles/me",
        {
            "name": name,
            "bio": "E2E profile",
            "birthDate": "1996-04-12",
            "gender": gender,
            "sexualOrientation": "straight",
            "relationshipGoal": "serious_love",
            "showOrientation": True,
        },
        token,
    )
    show(f"profile.patch {name}", status, payload)
    status, payload = call(
        "PUT",
        "/profiles/me/location",
        {
            "latitude": 19.076,
            "longitude": 72.8777,
            "city": "Mumbai",
            "country": "India",
            "countryCode": "IN",
        },
        token,
    )
    show(f"location {name}", status, payload)
    status, payload = call("POST", "/profiles/me/onboarding/complete", None, token)
    show(f"onboarding {name}", status, payload if not ok(status) else {})


def main() -> None:
    token_a, session_a = otp_login(EMAIL_A)
    token_b, session_b = otp_login(EMAIL_B)
    if not token_a or not token_b:
        print("ABORT missing tokens")
        return
    user_a = (session_a.get("user") or {}).get("id")
    user_b = (session_b.get("user") or {}).get("id")
    print(f"users created: {bool(user_a)} {bool(user_b)}")
    setup(token_a, "E2E Ada", "woman")
    setup(token_b, "E2E Ben", "man")
    upload_photo(token_a, "Ada")
    upload_photo(token_b, "Ben")

    status, payload = call("GET", "/auth/me", None, token_a)
    me = payload.get("data") or {}
    show("auth.me", status, payload if not ok(status) else {})
    print(f"session fields: onboarded={me.get('isOnboarded')} premium={me.get('isPremium')}")

    status, payload = call("GET", "/discovery/feed?limit=20", None, token_a)
    items = ((payload.get("data") or {}).get("items")) or []
    ids = {item.get("id") for item in items}
    show("discovery.feed", status, payload if not ok(status) else {})
    print(f"feed count={len(items)} sees_b={user_b in ids}")

    status, payload = call(
        "POST",
        "/discovery/swipes",
        {"targetUserId": user_b, "action": "like"},
        token_a,
    )
    show("swipe.a.like", status, payload if not ok(status) else {})
    status, payload = call(
        "POST",
        "/discovery/swipes",
        {"targetUserId": user_a, "action": "like"},
        token_b,
    )
    match = (payload.get("data") or {}).get("match") if ok(status) else None
    show("swipe.b.like", status, payload if not ok(status) else {})
    print(f"match_created={bool(match)}")
    conversation_id = (match or {}).get("conversationId")

    status, payload = call("GET", "/matches?limit=10", None, token_a)
    matches = ((payload.get("data") or {}).get("items")) or []
    show("matches.list", status, payload if not ok(status) else {})
    print(f"match_rows={len(matches)}")
    if not conversation_id and matches:
        conversation_id = matches[0].get("conversationId")

    if conversation_id:
        status, payload = call(
            "POST",
            f"/conversations/{conversation_id}/messages",
            {"clientId": f"e2e-{STAMP}-abcd", "body": "hello from e2e"},
            token_a,
        )
        show("message.send", status, payload if not ok(status) else {})
        status, payload = call(
            "GET",
            f"/conversations/{conversation_id}/messages?limit=10",
            None,
            token_b,
        )
        messages = ((payload.get("data") or {}).get("items")) or []
        show("message.list", status, payload if not ok(status) else {})
        print(f"message_count={len(messages)}")
        status, payload = call(
            "POST",
            f"/conversations/{conversation_id}/read",
            {},
            token_b,
        )
        show("message.read", status, payload if not ok(status) else {})

    status, payload = call("POST", "/safety/blocks", {"userId": user_b}, token_a)
    show("block", status, payload if not ok(status) else {})
    status, payload = call("DELETE", f"/safety/blocks/{user_b}", None, token_a)
    show("unblock", status, payload if not ok(status) else {})
    status, payload = call(
        "POST",
        "/safety/reports",
        {"userId": user_b, "reason": "spam", "details": "e2e"},
        token_a,
    )
    show("report", status, payload if not ok(status) else {})

    status, payload = call("GET", "/subscriptions/me", None, token_a)
    show("subscription.me", status, payload if not ok(status) else {})
    status, payload = call("GET", "/notifications/unread-count", None, token_b)
    show("notifications.unread", status, payload if not ok(status) else {})
    status, payload = call(
        "POST",
        "/notifications/devices",
        {"pushToken": f"e2e-token-{STAMP}-xxxx", "platform": "android", "appVersion": "1.0"},
        token_a,
    )
    show("device.register", status, payload if not ok(status) else {})

    refresh = ((session_a.get("tokens") or {}).get("refreshToken")) or session_a.get("refreshToken")
    status, payload = call("POST", "/auth/refresh", {"refreshToken": refresh})
    show("auth.refresh", status, payload if not ok(status) else {})
    new_refresh = ((payload.get("data") or {}).get("tokens") or {}).get("refreshToken")
    status, payload = call("POST", "/auth/logout", {"refreshToken": new_refresh or refresh}, token_a)
    show("auth.logout", status, payload if not ok(status) else {})

    status, payload = call("GET", "/profiles/me", None, "not-a-token")
    show("auth.bad-token", status, payload if not ok(status) else {})
    status, payload = call("GET", f"/profiles/{user_a}", None, token_b)
    show("profile.other", status, payload if not ok(status) else {})
    status, payload = call("DELETE", f"/matches/{user_a}", None, token_b)
    show("unmatch.wrong-id", status, payload)


if __name__ == "__main__":
    main()
