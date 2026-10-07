"""Re-check discovery for the already created E2E pair. No new registrations."""

import json
import urllib.parse
import urllib.request

BASE = "http://127.0.0.1:8080/api/v1"
EMAIL_A = "e2e.a.1791388247@example.com"
EMAIL_B = "e2e.b.1791388247@example.com"


def call(method, path, body=None, token=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Accept", "application/json")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def login(email):
    call("POST", "/auth/otp/request", {"email": email})
    query = urllib.parse.urlencode({"email": email, "purpose": "login"})
    peeked = call("GET", f"/auth/dev/otp?{query}")
    code = peeked["data"]["otp"]
    verified = call("POST", "/auth/otp/verify", {"email": email, "code": code})
    data = verified["data"]
    token = (data.get("tokens") or {}).get("accessToken") or data.get("accessToken")
    return token, data["user"]["id"]


token_a, id_a = login(EMAIL_A)
token_b, id_b = login(EMAIL_B)
feed = call("GET", "/discovery/feed?limit=20", token=token_a)
ids = {item.get("id") for item in feed["data"]["items"]}
print(f"feed_count={len(feed['data']['items'])} ada_sees_ben={id_b in ids}")
feed_b = call("GET", "/discovery/feed?limit=20", token=token_b)
ids_b = {item.get("id") for item in feed_b["data"]["items"]}
print(f"feed_count={len(feed_b['data']['items'])} ben_sees_ada={id_a in ids_b}")
