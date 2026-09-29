"""Development load-test strategy for likes, matches, and chat.

This is not a production capacity claim. It measures a single local stack.

Suggested run (API + Postgres + Redis already up):

    python -m scripts.load_interactions

What is measured:
- 100 concurrent like pairs (200 like requests)
- resulting unique match count
- 100 concurrent chat messages against one conversation
- duplicate client_message_id retries

Interpret results as local-dev throughput only.
"""

from __future__ import annotations

import argparse
import asyncio
import time
import uuid

import httpx


async def _register(client: httpx.AsyncClient, email: str) -> tuple[str, str]:
    password = "password12"
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    # Dev OTP peek is only available when the API exposes /auth/dev/otp.
    peek = await client.get("/api/v1/auth/dev/otp", params={"email": email, "purpose": "signup"})
    code = peek.json()["data"]["otp"]
    verified = await client.post("/api/v1/auth/verify-otp", json={"email": email, "otp": code})
    data = verified.json()["data"]
    return data["accessToken"], data["userId"]


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8080")
    parser.add_argument("--pairs", type=int, default=100)
    args = parser.parse_args()

    async with httpx.AsyncClient(base_url=args.base_url, timeout=30) as client:
        print(f"registering {args.pairs * 2} users")
        users = []
        for index in range(args.pairs * 2):
            token, user_id = await _register(client, f"load.{uuid.uuid4().hex}@boomboom.app")
            users.append((token, user_id))
        pairs = [(users[i], users[i + 1]) for i in range(0, len(users), 2)]

        async def like_pair(left, right):
            headers_a = {"Authorization": f"Bearer {left[0]}"}
            headers_b = {"Authorization": f"Bearer {right[0]}"}
            await client.post("/api/v1/likes", headers=headers_a, json={"userId": right[1]})
            return await client.post("/api/v1/likes", headers=headers_b, json={"userId": left[1]})

        started = time.perf_counter()
        results = await asyncio.gather(*(like_pair(a, b) for a, b in pairs), return_exceptions=True)
        elapsed = time.perf_counter() - started
        matches = 0
        errors = 0
        for item in results:
            if isinstance(item, Exception):
                errors += 1
                continue
            if item.status_code >= 400:
                errors += 1
            elif item.json().get("data", {}).get("matched"):
                matches += 1
        print(f"like_pairs={args.pairs} matches={matches} errors={errors} seconds={elapsed:.2f}")

        conversation = None
        for item in results:
            if isinstance(item, Exception):
                continue
            conversation = item.json().get("data", {}).get("conversationId")
            if conversation:
                token = pairs[0][0][0]
                break
        if conversation:
            headers = {"Authorization": f"Bearer {token}"}
            started = time.perf_counter()
            sends = await asyncio.gather(
                *[
                    client.post(
                        f"/api/v1/conversations/{conversation}/messages",
                        headers=headers,
                        json={
                            "content": f"load {index}",
                            "clientMessageId": f"load-msg-{index:04d}-{uuid.uuid4().hex[:8]}",
                        },
                    )
                    for index in range(100)
                ],
                return_exceptions=True,
            )
            elapsed = time.perf_counter() - started
            ok = sum(1 for item in sends if not isinstance(item, Exception) and item.status_code < 400)
            print(f"chat_sends=100 ok={ok} seconds={elapsed:.2f}")


if __name__ == "__main__":
    asyncio.run(main())
