# Full-stack workspace overview

This document describes everything in the three folders of this workspace:

| Folder | What it actually is |
|--------|---------------------|
| `backend` | The real BoomBoom API. Complete FastAPI app, database migrations, Docker, tests, and seed scripts. |
| `backend 2` | An incomplete copy of the same backend. Most application code is missing. It cannot start. |
| `boomboom` | Empty folder. No files. |

There is no Flutter app, admin UI, or `docs/` pack inside this workspace. `backend/docker-compose.yml` expects an admin app at `../apps/admin`, and that folder is not here.

Package name: `boomboom-backend` version `0.1.0`. Python `>= 3.12`.

The short `backend/README.md` is out of date. It says discovery, chat, matching, and payments are not built yet. Those features are implemented in `backend`.

---

## 1. What the product is

BoomBoom is a dating / social mobile API. The backend is a modular monolith:

```
HTTP / WebSocket route  →  service  →  repository  →  PostgreSQL (PostGIS) / Redis
```

Local URLs after `docker compose up --build` from `backend`:

| URL | Purpose |
|-----|---------|
| `http://localhost:8080` | API |
| `http://localhost:8080/docs` | Swagger |
| `http://localhost:8080/redoc` | ReDoc |
| `http://localhost:8080/openapi.json` | OpenAPI JSON |
| `http://localhost:8080/health` | Liveness |
| `http://localhost:8080/ready` | Readiness (database + Redis) |
| `http://localhost:3000` | Admin UI, only if `apps/admin` exists next to `backend` |

Mobile clients call `/api/v1`. Suggested bases from the existing handoff notes:

- Desktop / iOS simulator: `http://localhost:8080/api/v1`
- Android emulator: `http://10.0.2.2:8080/api/v1`
- Physical device: `http://<LAN-IP>:8080/api/v1`

JSON envelope:

```json
{ "success": true, "data": {}, "request_id": "..." }
```

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." }, "request_id": "..." }
```

Auth is a JWT in `Authorization: Bearer <accessToken>`. There is no public API key for the app. Identity comes from the token subject. Clients cannot send a user id to act as someone else.

---

## 2. Stack

| Piece | Choice |
|-------|--------|
| API | FastAPI + Uvicorn |
| Validation | Pydantic v2, pydantic-settings |
| Database | PostgreSQL 16 + PostGIS (`postgis/postgis:16-3.4`) |
| ORM | SQLAlchemy 2 async + asyncpg + GeoAlchemy2 |
| Migrations | Alembic, 19 revisions (`0001` through `0019`) |
| Cache / sessions / OTP / rate limits | Redis 7 |
| Passwords | Argon2 |
| Tokens | PyJWT, HS256 |
| Push | Firebase Admin (falls back to a no-op sender if credentials are empty) |
| HTTP client | httpx |
| Crypto | cryptography (Apple JWS, billing) |
| Lint / tests | Ruff, pytest, pytest-asyncio |
| Containers | Dockerfile (`python:3.12-slim`) + Docker Compose |

---

## 3. `backend` folder layout

```
backend/
  app/                         FastAPI application
    main.py                    App factory, CORS, lifespan, routers
    api/public.py              Event share HTML + Digital Asset Links
    api/v1/                    HTTP routes (see section 5)
    config/settings.py         Environment settings
    core/                      Rules, JWT, OTP, Redis, rate limits, RBAC
    db/                        SQLAlchemy engine and session
    dependencies/              FastAPI Depends wiring
    middleware/request_id.py   Request id + security headers
    models/orm.py              All database models
    repositories/              SQL access
    schemas/                   Pydantic request and response models
    services/                  Business logic
    websocket/                 Chat socket + realtime gateway
    workers/notifications.py   Background notification worker
  alembic/versions/            0001_initial.py … 0019_razorpay_products.py
  tests/unit/                  Unit tests
  tests/integration/           Tests that need Postgres and Redis
  scripts/                     Dev seeds and config checks
  docker/                      Test DB init + Firebase credentials placeholder
  storage/uploads/             Local media (user photos; do not share)
  Dockerfile
  docker-compose.yml           Local: Postgres, Redis, API, worker, admin
  docker-compose.staging.yml   Staging: same stack, ports not published
  pyproject.toml
  alembic.ini
  .env.example                 Key names and local placeholders
  .env.staging.example
  README.md                    Short, outdated start guide
  BACKEND_HANDOFF.md           Older handoff (keys + route list). Missing some newer mobile routes.
  .venv/                       Local Python install. Do not share.
```

`backend/.env` exists on this machine and holds real local secrets. Do not copy it into a zip or commit it.

---

## 4. Runtime behavior

`app/main.py` starts two background tasks with the API process:

1. Chat event fan-out (`app/websocket/chat.py`) so messages and presence reach open sockets.
2. Notification worker (`app/workers/notifications.py`) so inbox rows can be pushed through Firebase Cloud Messaging.

Docker Compose also runs a separate `worker` container with `python -m app.workers.notifications`.

On startup the API container retries `alembic upgrade head` up to 30 times, then serves Uvicorn on port 8080.

CORS allows the origins in `CORS_ORIGINS`. In non-production it also allows `localhost` and `127.0.0.1` on any port. Allowed methods: GET, POST, PUT, PATCH, DELETE, OPTIONS. Allowed headers: `Authorization`, `Content-Type`, `X-Request-Id`.

OpenAPI tag names in `main.py` still mark Users, Verification, Travel, and Tonight as “Reserved”. The routes for verification, travel, and tonight exist. The tag text is leftover.

---

## 5. HTTP and WebSocket routes

Base path for authenticated product APIs: `/api/v1`.

Auth column: `public` = no token. `Bearer` = access JWT. `refresh` = refresh token in the body. `staff` = JWT user whose database role is `REVIEWER` or `ADMIN`. `webhook` = store secret or signed payload.

### Health (no `/api/v1` prefix)

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | public |
| GET | `/ready` | public |

### Public links (no `/api/v1` prefix)

| Method | Path | Auth | What it does |
|--------|------|------|----------------|
| GET | `/.well-known/assetlinks.json` | public | Android Digital Asset Links |
| GET | `/.well-known/apple-app-site-association` | public | Apple Universal Links |
| GET | `/events/{event_id}` | public | HTML landing page for a shared event |

The JSON event for the app is `GET /api/v1/events/{event_id}`.

### Authentication — `app/api/v1/auth.py`

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/auth/register` | public |
| POST | `/api/v1/auth/login` | public |
| POST | `/api/v1/auth/refresh` | refresh |
| POST | `/api/v1/auth/logout` | optional Bearer + refresh |
| POST | `/api/v1/auth/verify-otp` | public |
| POST | `/api/v1/auth/forgot-password` | public |
| POST | `/api/v1/auth/reset-password` | public |
| POST | `/api/v1/auth/resend-otp` | public |
| GET | `/api/v1/auth/me` | Bearer |
| GET | `/api/v1/auth/dev/otp` | public, development only |

Register takes email and password (minimum 8 characters) and does not return tokens until OTP is verified. Refresh rotates the refresh token. Reuse of a revoked refresh token invalidates the whole session family. Forgot-password always returns success so callers cannot tell whether an email exists.

### Mobile contract — `app/api/v1/mobile.py`

This file is the Flutter-shaped API. It sits beside the older routes above. Both are mounted.

**Auth and account**

| Method | Path |
|--------|------|
| POST | `/api/v1/auth/otp/request` |
| POST | `/api/v1/auth/otp/verify` |
| POST | `/api/v1/auth/google` |
| POST | `/api/v1/auth/apple` |
| POST | `/api/v1/auth/facebook` |
| POST | `/api/v1/auth/password/forgot` |
| POST | `/api/v1/auth/email/verify` |
| POST | `/api/v1/auth/email/verify/resend` |
| DELETE | `/api/v1/users/me` |
| GET | `/api/v1/users/me/email-change` |
| POST | `/api/v1/users/me/email-change/request` |
| POST | `/api/v1/users/me/email-change/verify` |

Social login checks Google, Apple, and Facebook tokens (`app/core/social_auth.py`). Account delete is in `app/core/account_delete.py`. Email changes have a cooldown stored as `user_auth.email_changed_at` (migration `0018`).

**Own profile and photos**

| Method | Path |
|--------|------|
| GET | `/api/v1/profiles/me` |
| PATCH | `/api/v1/profiles/me` |
| POST | `/api/v1/profiles/me/onboarding/complete` |
| POST | `/api/v1/profiles/me/photos/upload-url` |
| POST | `/api/v1/profiles/me/photos/{photo_id}/confirm` |
| DELETE | `/api/v1/profiles/me/photos/{photo_id}` |
| PUT | `/api/v1/profiles/me/photos/order` |
| PUT | `/api/v1/profiles/me/location` |
| POST | `/api/v1/profiles/{user_id}/views` |

**Discovery, swipes, likes**

| Method | Path |
|--------|------|
| GET | `/api/v1/discovery/feed` |
| GET | `/api/v1/discovery/map` |
| POST | `/api/v1/discovery/swipes` |
| DELETE | `/api/v1/discovery/swipes/last` |
| GET | `/api/v1/likes/received` |
| GET | `/api/v1/likes/sent` |
| GET | `/api/v1/likes/viewed` |
| POST | `/api/v1/likes/received/{like_id}/respond` |
| DELETE | `/api/v1/likes/sent/{user_id}` |
| GET | `/api/v1/users/me/discovery-preferences` |
| PATCH | `/api/v1/users/me/discovery-preferences` |

**Devices, safety, billing (mobile names)**

| Method | Path |
|--------|------|
| GET | `/api/v1/users/me/notification-settings` |
| PATCH | `/api/v1/users/me/notification-settings` |
| POST | `/api/v1/devices` |
| DELETE | `/api/v1/devices/{push_token}` |
| POST | `/api/v1/safety/reports` |
| GET | `/api/v1/subscriptions/me` |
| POST | `/api/v1/subscriptions/verify` |
| POST | `/api/v1/subscriptions/razorpay/order` |
| POST | `/api/v1/subscriptions/razorpay/verify` |
| GET | `/api/v1/subscriptions/plans` |

**Travel**

| Method | Path |
|--------|------|
| GET | `/api/v1/travel/countries` |
| GET | `/api/v1/travel/arrivals` |
| GET | `/api/v1/travel/arrivals/{arrival_id}` |
| GET | `/api/v1/travel/journeys` |
| GET | `/api/v1/travel/journeys/{journey_id}` |
| POST | `/api/v1/travel/journeys` |
| PATCH | `/api/v1/travel/journeys/{journey_id}` |
| DELETE | `/api/v1/travel/journeys/{journey_id}` |

A journey stores from/to city, country, ISO code, flag, state, dates, trip type, travel style, companion, status, description, cover image, and hide-from options. Rules live in `app/core/travel_rules.py`.

**Free Tonight**

| Method | Path |
|--------|------|
| GET | `/api/v1/tonight/me` |
| GET | `/api/v1/tonight` |
| POST | `/api/v1/tonight` |
| PATCH | `/api/v1/tonight` |
| DELETE | `/api/v1/tonight` |

A tonight post is a short-lived “I’m free” card: activity, venue, tagline, who they want to meet, time, photo, and expiry. Rules live in `app/core/tonight_rules.py`.

### Profiles (older shape) — `profile.py`, `interests.py`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/profile` | Bearer |
| PATCH | `/api/v1/profile` | Bearer |
| GET | `/api/v1/profiles/{user_id}` | Bearer |
| GET | `/api/v1/profile/preferences` | Bearer |
| PUT | `/api/v1/profile/preferences` | Bearer |
| GET | `/api/v1/interests` | Bearer |
| PUT | `/api/v1/profile/interests` | Bearer |
| PATCH | `/api/v1/profile/location` | Bearer |
| GET | `/api/v1/profile/completion` | Bearer |
| POST | `/api/v1/profile/media` | Bearer |
| PATCH | `/api/v1/profile/media/{media_id}` | Bearer |
| DELETE | `/api/v1/profile/media/{media_id}` | Bearer |

### Media

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/media/upload-url` | Bearer |
| PUT | `/api/v1/media/local/{storage_key}` | signed query token |
| GET | `/api/v1/media/files/{storage_key}` | public object URL |

Upload flow: request a URL, `PUT` the bytes, then attach the storage key to the profile. JPEG, PNG, and WebP. Default max 8 MB and 6 photos (`MEDIA_MAX_BYTES`, `MEDIA_MAX_ITEMS`). Files land in `storage/uploads` unless storage settings point elsewhere.

### Discovery and blocks

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/discovery` | Bearer |
| POST | `/api/v1/discovery/impressions` | Bearer |
| GET | `/api/v1/safety/blocks` | Bearer |
| POST | `/api/v1/safety/blocks` | Bearer |
| DELETE | `/api/v1/safety/blocks/{user_id}` | Bearer |

Discovery query filters include age, gender, looking-for, distance, interests, verified-only, city, limit, and cursor. Distance uses a PostGIS geography point on `locations.geog`.

### Likes, favorites, matches

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/likes` | Bearer |
| DELETE | `/api/v1/likes/{user_id}` | Bearer |
| GET | `/api/v1/likes` | Bearer |
| GET | `/api/v1/likes/incoming` | Bearer |
| POST | `/api/v1/favorites` | Bearer |
| DELETE | `/api/v1/favorites/{user_id}` | Bearer |
| GET | `/api/v1/favorites` | Bearer |
| GET | `/api/v1/matches` | Bearer |
| GET | `/api/v1/matches/{match_id}` | Bearer |
| DELETE | `/api/v1/matches/{match_id}` | Bearer |

A like can create a mutual match and a conversation. The like response includes `liked`, `matched`, `matchId`, and `conversationId`.

### Chat

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/conversations` | Bearer |
| POST | `/api/v1/conversations` | Bearer |
| GET | `/api/v1/conversations/{id}/messages` | Bearer |
| POST | `/api/v1/conversations/{id}/messages` | Bearer |
| POST | `/api/v1/conversations/{id}/read` | Bearer |
| GET | `/api/v1/chat/unread-count` | Bearer |
| WS | `/api/v1/ws/chat/{conversation_id}` | Bearer (query or header) |
| WS | `/ws` | Bearer realtime gateway |

Message body: `{ content, clientMessageId, messageType: "TEXT" }`.

The `/ws` gateway (`app/websocket/gateway.py`) fans out aliases such as `message.new`, `message.read`, `typing`, `presence`, `match.new`, `like.received`, `profile.view`, `travel.update`, `event.update`, `verification.update`, `subscription.update`, and `safety.alert`.

### Notifications

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/notifications/devices` | Bearer |
| GET | `/api/v1/notifications/devices` | Bearer |
| DELETE | `/api/v1/notifications/devices/{device_id}` | Bearer |
| GET | `/api/v1/notifications` | Bearer |
| GET | `/api/v1/notifications/unread-count` | Bearer |
| POST | `/api/v1/notifications/{id}/read` | Bearer |
| POST | `/api/v1/notifications/read-all` | Bearer |
| GET | `/api/v1/notifications/preferences` | Bearer |
| PUT | `/api/v1/notifications/preferences` | Bearer |
| POST | `/api/v1/notifications/test` | Bearer |

Device registration stores an FCM token. The raw token is not returned. Empty Firebase credentials mean inbox rows are still saved and no push is sent.

Notification types: like, offer, match, new message, favorite, profile activity, profile view, verification submitted/approved/rejected/result, subscription, event update, travel update, safety alert.

### Verification (selfie / profile)

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/verification/status` | Bearer |
| POST | `/api/v1/verification/start` | Bearer |
| POST | `/api/v1/verification/upload-url` | Bearer |
| POST | `/api/v1/verification/submit` | Bearer |
| POST | `/api/v1/verification/cancel` | Bearer |
| POST | `/api/v1/verification/retry` | Bearer |
| GET | `/api/v1/verification/media/{media_id}` | Bearer owner |
| POST | `/api/v1/verification/review` | reviewer or admin |

Provider code: `app/services/verification.py` and `verification_provider.py`. Retention rules: `app/core/verification_retention.py`.

### Reports

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/reports` | Bearer |

Body includes the reported user, a reason code, optional details, and an optional message id.

Reason codes: harassment, spam, scam, impersonation, inappropriate content, minor safety concern, fraud, abusive behavior, other. Severity: low, medium, high, critical. Status: open, in review, resolved, dismissed.

### Events

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/events` | Bearer |
| GET | `/api/v1/events/{event_id}` | Bearer |
| POST | `/api/v1/events` | Bearer |
| PATCH | `/api/v1/events/{event_id}` | Bearer host |
| DELETE | `/api/v1/events/{event_id}` | Bearer host |
| POST | `/api/v1/events/{event_id}/rsvp` | Bearer |
| DELETE | `/api/v1/events/{event_id}/rsvp` | Bearer |
| POST | `/api/v1/events/{event_id}/cover/upload-url` | Bearer |
| POST | `/api/v1/events/{event_id}/cover` | Bearer |
| DELETE | `/api/v1/events/{event_id}/cover` | Bearer |

An event has title, description, location text, optional lat/lng, start and end, cover image, optional capacity, price, and status (`PUBLISHED`, `CANCELLED`, `HIDDEN`). RSVP status is `GOING` or `CANCELLED`.

### Subscriptions

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/subscriptions/catalog` | Bearer |
| GET | `/api/v1/subscriptions/me` | Bearer |
| GET | `/api/v1/subscriptions/history` | Bearer |
| POST | `/api/v1/subscriptions/verify` | Bearer |
| POST | `/api/v1/subscriptions/razorpay/order` | Bearer |
| POST | `/api/v1/subscriptions/razorpay/verify` | Bearer |
| POST | `/api/v1/subscriptions/restore` | Bearer |
| GET | `/api/v1/entitlements` | Bearer |
| POST | `/api/v1/webhooks/google-play` | webhook |
| POST | `/api/v1/webhooks/apple` | webhook |
| POST | `/api/v1/webhooks/razorpay` | webhook |

The app’s own “is premium” flag is not trusted. The server verifies the store receipt.

Entitlement codes: `PREMIUM`, `UNLIMITED_LIKES`, `SEE_LIKES`, `ADVANCED_FILTERS`, `BOOSTS`. Missing entitlement returns `SUBSCRIPTION_REQUIRED` (HTTP 403).

Billing platforms in code: Google Play and Apple, plus Razorpay Checkout for India (catalog migration `0019`). `SUBSCRIPTION_VERIFY_MODE=mock` is local only. Staging and production refuse mock.

Google Play real-time developer notifications: `app/services/google_rtdn.py`. Apple signed payloads: `app/services/apple_jws.py` and `app/core/apple_trust.py`. Razorpay: `app/services/razorpay.py`.

### Admin (staff JWT)

| Method | Path | Who |
|--------|------|-----|
| GET | `/api/v1/admin/dashboard` | staff |
| GET | `/api/v1/admin/users` | staff |
| GET | `/api/v1/admin/users/{user_id}` | staff |
| POST | `/api/v1/admin/users/{user_id}/suspend` | staff |
| POST | `/api/v1/admin/users/{user_id}/ban` | staff |
| POST | `/api/v1/admin/users/{user_id}/restore` | staff |
| POST | `/api/v1/admin/users/{user_id}/media/remove` | staff |
| GET | `/api/v1/admin/verification/queue` | staff |
| GET | `/api/v1/admin/verification/{request_id}` | staff |
| GET | `/api/v1/admin/verification/{request_id}/media/{media_id}` | staff |
| POST | `/api/v1/admin/verification/{request_id}/review` | staff |
| GET | `/api/v1/admin/reports` | staff |
| GET | `/api/v1/admin/reports/{report_id}` | staff |
| POST | `/api/v1/admin/reports/{report_id}/assign` | staff |
| POST | `/api/v1/admin/reports/{report_id}/resolve` | staff |
| POST | `/api/v1/admin/reports/{report_id}/dismiss` | staff |
| GET | `/api/v1/admin/audit-logs` | staff |
| GET | `/api/v1/admin/subscriptions` | staff |
| GET | `/api/v1/admin/users/{user_id}/subscription` | staff |
| GET | `/api/v1/admin/events` | staff |
| GET | `/api/v1/admin/events/{event_id}` | staff |
| POST | `/api/v1/admin/events/{event_id}/hide` | staff |
| POST | `/api/v1/admin/events/{event_id}/restore` | staff |
| POST | `/api/v1/admin/events/{event_id}/cover/remove` | staff |

Roles (`app/core/rbac.py`):

| Role | Access |
|------|--------|
| `USER` | Normal app only |
| `REVIEWER` | Dashboard, user read, verification, report read, event read |
| `ADMIN` | Reviewer access plus user moderation, report writes, audit logs, event moderation |

Moderation actions recorded in the model: warn, suspend, ban, restore, dismiss report, remove profile media, reject verification.

---

## 6. Database tables

All models are in `app/models/orm.py`. Geography uses SRID 4326.

| Table | Purpose |
|-------|---------|
| `users` | Account status, onboarding step, role, last active, suspension, soft delete |
| `user_auth` | Email, password hash, provider (`email` or social), verified time, email-change time |
| `profiles` | Name, bio, birth date, gender, orientation, looking-for, languages, work, school, height, lifestyle, nationality, visibility, verification status |
| `profile_media` | Photos, storage key, sort order, primary flag, moderation status |
| `interests` / `profile_interests` | Interest catalog and the user’s selections |
| `preferences` | Age range, distance, gender filter, verified-only, discoverable, online-only, extra JSON filters |
| `locations` | PostGIS point plus city, locality, district, region, country, ISO code, flag |
| `device_tokens` | Push tokens per device |
| `notifications` | In-app inbox |
| `notification_preferences` | Per-user push settings |
| `sessions` | Refresh-token sessions and family id for reuse detection |
| `audit_logs` | Staff and security audit trail |
| `user_blocks` | Block list used to hide people from discovery |
| `discovery_impressions` | Cards already shown |
| `discovery_swipes` | Swipe actions (pass / like and similar) |
| `profile_views` | Who viewed whom |
| `likes` | Outgoing likes |
| `favorites` | Saved profiles |
| `matches` | Mutual matches |
| `conversations` / `conversation_members` / `messages` | Chat |
| `verification_requests` / `verification_media` / `verification_reviews` | Selfie verification workflow |
| `user_reports` | Safety reports |
| `subscription_products` | Store product catalog |
| `subscriptions` | A user’s store subscription |
| `subscription_events` | Purchase and renewal history |
| `entitlements` | What the user is allowed to do |
| `billing_webhook_events` | Idempotent store webhook log |
| `events` / `event_rsvps` | Social events |
| `travel_journeys` | Travel alerts and trips |
| `tonight_posts` | Free Tonight cards |

User status values: `ACTIVE`, `INACTIVE`, `SUSPENDED`, `BANNED`, `PENDING_DELETION`, `DELETED`.

Profile visibility: `PUBLIC`, `HIDDEN`, `MATCHES_ONLY`.

### Migrations

| Revision | What it adds |
|----------|----------------|
| `0001_initial` | First schema with PostGIS |
| `0002_session_family` | Refresh-token family id |
| `0003_profile_module` | Profile, location, media, preferences, interests |
| `0004_discovery` | Blocks, impressions, filter indexes |
| `0005_interactions_chat` | Likes, favorites, matches, conversations, messages |
| `0006_notifications` | Inbox, preferences, device tokens |
| `0007_verification` | Verification requests, media, reviews |
| `0008_moderation` | Reports, suspension window, audit actor/target, verification lock |
| `0009_subscriptions` | Catalog, subscriptions, entitlements, webhook idempotency |
| `0010_subscription_e2e` | Webhook processing state and event ordering |
| `0011_events` | Social events and RSVPs |
| `0012_mobile_contract` | Richer profiles, swipes, travel, tonight |
| `0013_travel_hide_from` | Hide-from gender on journeys |
| `0014_travel_country_flags` | Country codes and flag URLs |
| `0015_travel_states` | From/to state |
| `0016_location_country_flag` | Location ISO code and flag |
| `0017_location_place_levels` | Locality and district |
| `0018_email_changed_at` | 30-day email-change cooldown |
| `0019_razorpay_products` | Razorpay INR catalog |

`docker/init-test-db.sql` creates a second database `boomboom_test` and grants it to the `boomboom` user. Integration tests use `DATABASE_URL` or `TEST_DATABASE_URL`.

---

## 7. Application layers (file by file)

### `app/core`

| File | Job |
|------|-----|
| `security.py` | Password hashing, JWT create/verify |
| `otp.py` | One-time codes |
| `social_auth.py` | Google, Apple, Facebook token checks |
| `social_profile.py` | Map social profile fields onto the local profile |
| `account_delete.py` | Delete-account flow |
| `rate_limit.py` | Named Redis limits |
| `cache.py` | Redis helper |
| `rbac.py` | Staff permissions |
| `errors.py` / `exceptions.py` | App errors and FastAPI handlers |
| `logging.py` | Structured logging |
| `paging.py` | Cursors |
| `eligibility.py` | Who can appear in discovery |
| `discovery_rules.py` | Feed filter rules |
| `profile_rules.py` | Profile field rules |
| `event_rules.py` | Event create/update rules |
| `travel_rules.py` | Journey visibility |
| `tonight_rules.py` | Tonight activity and expiry |
| `report_rules.py` | Report validation |
| `verification_rules.py` | Verification state machine |
| `verification_retention.py` | How long verification media is kept |
| `moderation.py` | Moderation helpers |
| `entitlements.py` | Premium feature checks |
| `billing_metrics.py` | Billing counters |
| `google_play_config.py` | Play package and credentials |
| `apple_trust.py` | Apple certificate trust |
| `country_iso.py` | Country name to ISO code |
| `mobile_maps.py` | Flag image URLs and mobile field maps |
| `push.py` | Push provider selection |
| `realtime.py` | WebSocket connection hub and presence |
| `jobs.py` | Background job helpers |

### `app/services`

| File | Job |
|------|-----|
| `auth.py` | Register, login, OTP, refresh, logout |
| `profile.py` | Profile edits, media, location |
| `discovery.py` | Nearby feed |
| `interactions.py` | Likes, favorites, matches |
| `chat.py` | Conversations and messages |
| `cards.py` | Profile cards shown in feeds |
| `presenters.py` | Response shaping |
| `mobile.py` | Flutter contract (feed, map, travel, tonight, social login) |
| `events.py` | Events and RSVP |
| `notifications.py` | Inbox and device tokens |
| `verification.py` / `verification_provider.py` | Selfie verification |
| `reports.py` | User reports |
| `admin.py` | Staff dashboard and moderation |
| `moderation_hooks.py` | Side effects after a moderation action |
| `subscriptions.py` | Catalog, verify, restore, entitlements |
| `billing_providers.py` | Store verifiers |
| `google_rtdn.py` | Google Play RTDN |
| `apple_jws.py` | Apple signed transaction parsing |
| `razorpay.py` | Razorpay orders and webhook checks |
| `storage.py` | Local signed upload URLs |
| `interfaces.py` | Service protocols |

### `app/repositories`

`users.py`, `profiles.py`, `discovery.py`, `interactions.py`, `chat.py`, `events.py`, `notifications.py`, `verification.py`, `moderation.py`, `subscriptions.py`.

### `app/schemas`

`auth.py`, `profile.py`, `discovery.py`, `interactions.py`, `chat.py`, `events.py`, `notifications.py`, `verification.py`, `reports.py`, `subscriptions.py`, `travel.py`, `admin.py`.

### `app/dependencies`

FastAPI `Depends` factories: `auth.py`, `profile.py`, `discovery.py`, `interactions.py`, `events.py`, `notifications.py`, `verification.py`, `subscriptions.py`, `mobile.py`, `admin.py`.

---

## 8. Rate limits

Redis counters. Values are `(max requests, window seconds)` from `app/core/rate_limit.py`.

| Policy | Limit |
|--------|--------|
| registration | 5 / hour |
| login | 10 / 15 min |
| otp_generation | 5 / hour |
| otp_verification | 10 / 15 min |
| forgot_password | 5 / hour |
| profile_changes | 20 / hour |
| discovery | 120 / minute |
| likes | 60 / minute |
| chat_requests | 20 / minute |
| messages | 40 / minute |
| reports | 10 / hour |
| device_register | 40 / hour |
| device_delete | 30 / hour |
| notification_read / notification_list | 60 / minute |
| notification_test | 5 / hour |
| verification_start | 5 / hour |
| verification_submit | 8 / hour |
| verification_cancel | 10 / hour |
| verification_retry | 3 / day |
| verification_status | 60 / minute |
| verification_review | 120 / hour |
| admin_moderate | 60 / hour |
| subscription catalog / me | 60 / minute |
| subscription history | 30 / minute |
| subscription verify / order / restore | 20 / hour |
| entitlements | 60 / minute |
| events_list | 60 / minute |
| events_mutate | 20 / hour |
| events_rsvp | 40 / minute |

Staging can loosen registration and login (the handoff notes 20/600 and 30/600).

---

## 9. Environment variables

Names only. Fill them in `.env` from `.env.example`. Do not commit real values.

| Group | Variables |
|-------|-----------|
| App | `APP_ENV`, `APP_NAME`, `APP_HOST`, `APP_PORT`, `LOG_LEVEL`, `CORS_ORIGINS` |
| Database | `DATABASE_URL`, `DATABASE_POOL_SIZE`, `DATABASE_MAX_OVERFLOW` |
| Redis | `REDIS_URL` |
| JWT | `JWT_SECRET` (minimum 32 characters), `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES` (default 15), `REFRESH_TOKEN_EXPIRE_DAYS` (default 30) |
| OTP | `OTP_EXPIRE_SECONDS` (300), `OTP_RESEND_SECONDS` (60), `OTP_MAX_ATTEMPTS` (5), `OTP_LENGTH` (4) |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` |
| Firebase | `FIREBASE_PROJECT_ID`, `FIREBASE_CREDENTIALS_JSON`, `FIREBASE_CREDENTIALS_FILE` |
| Google Play | `SUBSCRIPTION_VERIFY_MODE`, `GOOGLE_PLAY_PACKAGE_NAME`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `GOOGLE_PLAY_SERVICE_ACCOUNT`, `GOOGLE_PLAY_CREDENTIALS`, `GOOGLE_PLAY_WEBHOOK_SECRET`, `GOOGLE_PUBSUB_PROJECT`, `GOOGLE_PUBSUB_TOPIC`, `GOOGLE_PUBSUB_SUBSCRIPTION` |
| Apple IAP | `APPLE_BUNDLE_ID`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_KEY_ID`, `APPLE_IAP_PRIVATE_KEY`, `APPLE_IAP_WEBHOOK_SECRET`, `APPLE_IAP_EXPECTED_ENVIRONMENT` |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| Social login | `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` |
| Links | `PUBLIC_APP_ORIGIN`, `APPLE_TEAM_ID`, `ANDROID_SHA256_CERT_FINGERPRINTS` |
| Media | `MEDIA_STORAGE_PATH`, `MEDIA_PUBLIC_BASE_URL`, `MEDIA_MAX_BYTES`, `MEDIA_MAX_ITEMS`, `MEDIA_UPLOAD_EXPIRE_SECONDS` |

Local Docker defaults in compose (development only): database user `boomboom`, password `boomboom_dev_only`, database `boomboom`. Staging and production refuse that password. Production also refuses a JWT secret that still contains `replace-with`.

Default package names in the example env: Google Play `com.boomboomapp.date`, Apple bundle `com.boomboom`.

---

## 10. How to run `backend`

From `backend`:

```bash
docker compose up --build
```

Host development:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
docker compose up postgres redis
alembic upgrade head
uvicorn app.main:app --reload --port 8080
```

Tests:

```bash
pytest
```

Integration tests are marked and need Postgres after migrations.

Staging compose (`docker-compose.staging.yml`) uses database `boomboom_staging`, does not publish Postgres or Redis to the host, forces `SUBSCRIPTION_VERIFY_MODE=live`, and reads secrets from `.env.staging`.

---

## 11. Scripts (development)

| Script | What it does |
|--------|----------------|
| `scripts/check_alembic.py` | Checks migration state |
| `scripts/verify_google_play_config.py` | Checks Play billing config |
| `scripts/load_interactions.py` | Loads interaction data |
| `scripts/seed_discovery.py` | Thailand discovery users. Development only |
| `scripts/seed_delhi.py` | Delhi NCR dummy users for discovery, filters, travel, and tonight. Password `SeedPass12!`. Safe to re-run |
| `scripts/seed_frontend_catalog.py` | Catalog people plus travel, tonight, likes, views, and chats. Same password |
| `scripts/seed_free_tonight.py` | Refreshes Free Tonight posts |
| `scripts/seed_travel_alerts.py` | Travel journeys that pass create-journey filters |

These seeds must not be run in production. `seed_delhi.py` and the catalog/tonight/travel scripts refuse anything other than development.

---

## 12. Tests in `backend`

**Integration** (`tests/integration/`): auth, profile, discovery, interactions and chat, notifications, verification, subscriptions, events, event-update notifications, admin, admin events, database constraints.

**Unit** (`tests/unit/`): health, OpenAPI, OTP, security, authz, auth rate limits, profile rules and OpenAPI, discovery rules and OpenAPI, interactions, logging, database URL, mobile contract, account delete, social auth, travel rules, events schemas and share links, notification worker, push provider, verification provider, billing providers, Razorpay, Google Play config, Google RTDN, Apple JWS, rate policies.

Shared fixtures: `tests/conftest.py`, `tests/isolation.py`, `tests/unit/jws_test_support.py`, `tests/test_social_profile.py`.

---

## 13. `backend 2` — incomplete copy

`backend 2` has the same top-level names (`Dockerfile`, compose files, `pyproject.toml`, `README.md`, `BACKEND_HANDOFF.md`, `.env.example`) and a `.venv`, but almost all of the application is gone.

What is still there:

- `app/main.py` and `app/api/v1/router.py` (they import modules that are not in the folder)
- Route stubs only: `health.py`, `interests.py`, `reports.py`, `responses.py`, `safety.py`
- `app/repositories/chat.py`
- `app/services/moderation_hooks.py`
- Empty package `__init__.py` files for config, core, db, models, workers
- Alembic `env.py` only. The `alembic/versions` folder is missing, so there are no migrations
- Tests that import the missing app (they cannot run)
- Scripts: `check_alembic.py`, `load_interactions.py`, `seed_discovery.py`, `verify_google_play_config.py`
- Docker helper files and `storage/uploads/.gitkeep`

`app/main.py` imports `app.api.public`, `app.config`, `app.core.exceptions`, `app.dependencies.auth`, `app.websocket.chat`, and `app.workers.notifications`. Those files are not in `backend 2`.

`app/api/v1/router.py` imports `admin`, `auth`, `conversations`, `discovery`, `events`, `favorites`, `likes`, `matches`, `media`, `notifications`, `profile`, `subscriptions`, `verification`, `webhooks`, and the chat WebSocket. Those files are not in `backend 2`.

Starting this copy fails on import. Use `backend`, not `backend 2`.

A few files that exist in both folders are not identical (`app/main.py`, `app/api/v1/router.py`, `app/api/v1/safety.py`, `app/repositories/chat.py`, compose, env examples, and several tests). `backend` is the newer tree: it adds the mobile router, the `/ws` realtime gateway, Razorpay, social login, travel, tonight, and migrations `0001`–`0019`.

---

## 14. `boomboom`

The folder `boomboom` was created on 30 Sep 2026 and contains no files and no subfolders.

The handoff note inside `backend/BACKEND_HANDOFF.md` talks about a larger repo at `C:\Users\Dolly Nagrani\OneDrive\Desktop\boomboom` with Flutter (`lib/`), `apps/admin`, `android/`, `ios/`, and a `docs/` pack. That tree is not inside this `full_stack` workspace.

---

## 15. What is not in this workspace

- Flutter app
- Android and iOS projects
- Next.js admin UI (`apps/admin`), even though compose tries to build it
- The markdown docs listed in `BACKEND_HANDOFF.md` (`API.md`, `AUTHENTICATION.md`, `DATABASE.md`, and the rest)
- A git remote story for a public frontend

`backend/BACKEND_HANDOFF.md` is still useful for environment-variable names and the older route list. It does not list the mobile contract routes (social login, travel, tonight, Razorpay, email change, swipes, map feed). Those are in section 5 of this file.
