# BoomBoom backend handoff

This file is the single document for sharing the backend: **what to zip**, **API keys / environment variables**, **every HTTP/WebSocket route**, stack, and how to run it.

Live OpenAPI is also available after start:

- Swagger: `http://localhost:8080/docs`
- ReDoc: `http://localhost:8080/redoc`
- OpenAPI JSON: `http://localhost:8080/openapi.json`

---

## 1. Which folder to zip

**Zip this folder only:**

```
boomboom/backend/
```

Full path on this machine:

```
C:\Users\Dolly Nagrani\OneDrive\Desktop\boomboom\backend
```

That folder is the complete FastAPI backend: app code, Alembic migrations, Docker, tests, and env *templates*. Do **not** zip the whole `boomboom` repo (Flutter, iOS, Android, admin UI).

### Also attach this documentation pack (optional but recommended)

The backend folder has `README.md`. The detailed API docs live in the repo `docs/` folder. If you want the receiver to have API docs without the Flutter app, zip `backend/` **and** copy these files into a `docs/` folder next to it, or attach them separately:

| File | What it covers |
|------|----------------|
| `docs/BACKEND_HANDOFF.md` | This file (keys + full route list) |
| `docs/API.md` | Endpoint catalog |
| `docs/BACKEND_ARCHITECTURE.md` | Layers and runtime |
| `docs/AUTHENTICATION.md` | Register / OTP / JWT |
| `docs/SECURITY.md` | Secrets, tokens, rate limits |
| `docs/DATABASE.md` | PostgreSQL + PostGIS tables |
| `docs/DISCOVERY.md` | Feed and filters |
| `docs/INTERACTIONS.md` | Likes, favorites, matches |
| `docs/CHAT.md` / `docs/WEBSOCKET.md` | Messaging |
| `docs/NOTIFICATIONS.md` / `docs/FCM_SETUP.md` | Inbox + Firebase |
| `docs/VERIFICATION.md` / `docs/VERIFICATION_PROVIDER.md` | Selfie verification |
| `docs/SUBSCRIPTIONS.md` / `docs/BILLING.md` / `docs/ENTITLEMENTS.md` | IAP |
| `docs/GOOGLE_PLAY_BILLING.md` / `docs/GOOGLE_RTDN.md` | Play billing |
| `docs/APPLE_IAP.md` / `docs/APPLE_NOTIFICATIONS.md` | Apple billing |
| `docs/ADMIN.md` / `docs/RBAC.md` / `docs/MODERATION.md` / `docs/REPORTING.md` | Staff APIs |
| `docs/RENDER_STAGING.md` | Staging deploy |

### Do **not** put these in the zip

| Item | Why |
|------|-----|
| `backend/.env` | Real secrets (JWT, DB password, Firebase, Play, Apple keys) |
| `backend/.venv/` / `venv/` | Local Python install, huge and machine-specific |
| `__pycache__/`, `.pytest_cache/` | Generated |
| `storage/uploads/` files | User photos |
| `docker/firebase-credentials.json` or any `*-service-account.json` | Private keys |
| `backend/.env.staging` if someone created one with real values | Secrets |

Safe to include: `.env.example`, `.env.staging.example`, `docker/firebase-credentials.placeholder`.

### How to zip (Windows PowerShell)

From the repo root, excluding secrets and caches:

```powershell
cd "C:\Users\Dolly Nagrani\OneDrive\Desktop\boomboom"

Compress-Archive -Path backend -DestinationPath BoomBoom-backend.zip -Force
```

Then **remove `.env` from the zip** if it was included (Explorer → open zip → delete `.env`), **or** copy a clean folder first:

```powershell
$src = "C:\Users\Dolly Nagrani\OneDrive\Desktop\boomboom\backend"
$dst = "$env:TEMP\boomboom-backend-share"
Remove-Item $dst -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item $src $dst -Recurse
Remove-Item "$dst\.env" -Force -ErrorAction SilentlyContinue
Remove-Item "$dst\.venv" -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem $dst -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force
Compress-Archive -Path $dst -DestinationPath "$HOME\Desktop\BoomBoom-backend.zip" -Force
```

Give the other person:

1. `BoomBoom-backend.zip` (the `backend` folder)
2. This file (`docs/BACKEND_HANDOFF.md`) if it is not already inside the zip
3. **API keys in a separate secure channel** (not inside the zip) — see section 3

Receiver setup: copy `.env.example` → `.env`, fill secrets, then `docker compose up --build`.

---

## 2. What is in `backend/`

```
backend/
  app/                    FastAPI application
    api/v1/               HTTP routes
    api/public.py         Event share + Digital Asset Links
    config/settings.py    Environment / API keys
    core/                 JWT, OTP, Redis, rate limits, RBAC
    db/                   SQLAlchemy session
    dependencies/         FastAPI Depends
    middleware/           Request ID, security headers
    models/orm.py         Database models
    repositories/         SQL
    schemas/              Pydantic request/response
    services/             Business logic
    websocket/chat.py     Chat WebSocket
    workers/              Notification worker
  alembic/                Database migrations
  tests/                  Unit + integration tests
  docker/                 Postgres init, Firebase placeholder
  scripts/                Alembic helpers
  storage/uploads/        Local media (do not share user files)
  Dockerfile
  docker-compose.yml      API + Postgres + Redis + worker (+ admin UI)
  docker-compose.staging.yml
  pyproject.toml          Python 3.12+, dependencies
  alembic.ini
  .env.example            Key names and local placeholders
  .env.staging.example
  README.md
```

**Stack:** FastAPI + Uvicorn, PostgreSQL 16 + PostGIS, Redis 7, Alembic, Argon2, JWT (HS256).

**Layout:** `app/api` → `app/services` → `app/repositories` → PostgreSQL / Redis.

Local URLs after `docker compose up --build`:

| URL | Purpose |
|-----|---------|
| `http://localhost:8080` | API |
| `http://localhost:8080/docs` | Swagger |
| `http://localhost:8080/health` | Liveness |
| `http://localhost:8080/ready` | Readiness (DB + Redis) |
| `http://localhost:3000` | Admin UI (compose `admin` service; code is `apps/admin`, **not** inside this zip) |

Flutter clients use:

- Desktop / iOS simulator: `http://localhost:8080/api/v1`
- Android emulator: `http://10.0.2.2:8080/api/v1`
- Physical device: `http://<LAN-IP>:8080/api/v1`

---

## 3. Backend API keys and environment variables

There is **no single public “API key”** for the Flutter app. The mobile client authenticates with **JWT** (`Authorization: Bearer <accessToken>`).

All secrets live in **environment variables** (`.env` locally). Never commit real values. Never put Firebase Admin, Google Play, or Apple keys in Flutter.

Copy `backend/.env.example` to `backend/.env` and fill these.

### App

| Variable | Required | Purpose |
|----------|----------|---------|
| `APP_ENV` | yes | `development` / `staging` / `production` |
| `APP_NAME` | no | OpenAPI title (default `BoomBoom API`) |
| `APP_HOST` | no | Bind host (`0.0.0.0`) |
| `APP_PORT` | no | HTTP port (`8080`) |
| `LOG_LEVEL` | no | `INFO` etc. |
| `CORS_ORIGINS` | yes for browsers | Comma-separated origins. Empty = no browser CORS |

### Database (PostgreSQL + PostGIS)

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | Async SQLAlchemy URL, e.g. `postgresql+asyncpg://USER:PASSWORD@HOST:5432/DB` |
| `DATABASE_POOL_SIZE` | no | Default `10` |
| `DATABASE_MAX_OVERFLOW` | no | Default `20` |

Local Docker default user/password is `boomboom` / `boomboom_dev_only`. Staging and production **refuse** that password.

### Redis

| Variable | Required | Purpose |
|----------|----------|---------|
| `REDIS_URL` | yes | Sessions, OTP, rate limits, token denylist. Default `redis://localhost:6379/0` |

### JWT (auth tokens)

| Variable | Required | Purpose |
|----------|----------|---------|
| `JWT_SECRET` | **yes** | Signing key. **Minimum 32 characters.** Unique per environment. |
| `JWT_ALGORITHM` | no | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no | Default `15` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | no | Default `30` |

Production refuses a secret that still contains `replace-with`.

### OTP

| Variable | Default | Purpose |
|----------|---------|---------|
| `OTP_EXPIRE_SECONDS` | `300` | Code lifetime |
| `OTP_RESEND_SECONDS` | `60` | Resend cooldown |
| `OTP_MAX_ATTEMPTS` | `5` | Max guesses |
| `OTP_LENGTH` | `4` | Digit length (matches Flutter OTP UI) |

Development uses a mock OTP provider (logged / `GET /api/v1/auth/dev/otp`). There is no Twilio/SendGrid key wired yet.

### Firebase Admin (push notifications) — **backend only**

| Variable | Required | Purpose |
|----------|----------|---------|
| `FIREBASE_PROJECT_ID` | for live FCM | GCP / Firebase project id |
| `FIREBASE_CREDENTIALS_JSON` | for live FCM | **Filesystem path** to Admin SDK JSON (not the JSON pasted in `.env`) |
| `FIREBASE_CREDENTIALS_FILE` | Docker | Host path mounted into the container at `/run/secrets/firebase-admin.json` |

Empty credentials → `NoopPushProvider` (inbox still works; no FCM send).

Windows Compose path example (forward slashes):

```
FIREBASE_CREDENTIALS_FILE=C:/Users/YOU/firebase-secrets/boomboom-firebase-admin.json
```

### Google Play billing

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUBSCRIPTION_VERIFY_MODE` | yes | `mock` (local only) or `live`. Staging/production refuse `mock`. |
| `GOOGLE_PLAY_PACKAGE_NAME` | yes for Play | `com.boomboomapp.date` |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | live Play | Inline JSON **or** leave empty and use a file |
| `GOOGLE_PLAY_SERVICE_ACCOUNT` | live Play | Path to service-account JSON (preferred) |
| `GOOGLE_PLAY_CREDENTIALS` | optional | Alternate credentials path |
| `GOOGLE_PLAY_WEBHOOK_SECRET` | recommended | Shared secret for `POST /api/v1/webhooks/google-play` |
| `GOOGLE_PUBSUB_PROJECT` | RTDN | GCP project |
| `GOOGLE_PUBSUB_TOPIC` | RTDN | e.g. `play-rtdn` |
| `GOOGLE_PUBSUB_SUBSCRIPTION` | RTDN | Full subscription name, e.g. `projects/PROJECT/subscriptions/play-rtdn-push` |

### Apple IAP

| Variable | Required | Purpose |
|----------|----------|---------|
| `APPLE_BUNDLE_ID` | yes for Apple | `com.boomboom.app` |
| `APPLE_IAP_ISSUER_ID` | live Apple | App Store Connect issuer |
| `APPLE_IAP_KEY_ID` | live Apple | Key id |
| `APPLE_IAP_PRIVATE_KEY` | live Apple | `.p8` private key contents |
| `APPLE_IAP_WEBHOOK_SECRET` | optional | Extra header for mock/local posts. Live Apple uses JWS + x5c. |
| `APPLE_IAP_EXPECTED_ENVIRONMENT` | no | `auto` / `Sandbox` / `Production`. `auto` = Production only when `APP_ENV=production`. |

### Universal Links / App Links

| Variable | Purpose |
|----------|---------|
| `PUBLIC_APP_ORIGIN` | Canonical public origin for event share (not the API host), e.g. `https://boomboom.app` |
| `APPLE_TEAM_ID` | Apple Team ID for `.well-known/apple-app-site-association` |
| `ANDROID_SHA256_CERT_FINGERPRINTS` | Comma-separated Play signing cert SHA-256 for Digital Asset Links |

### Media (optional overrides)

| Variable | Default | Purpose |
|----------|---------|---------|
| `MEDIA_STORAGE_PATH` | `./storage/uploads` | Local upload directory |
| `MEDIA_PUBLIC_BASE_URL` | empty | Public URL prefix |
| `MEDIA_MAX_BYTES` | `8000000` | 8 MB |
| `MEDIA_MAX_ITEMS` | `6` | Max profile photos |
| `MEDIA_UPLOAD_EXPIRE_SECONDS` | `900` | Signed upload TTL |

### How the Flutter app authenticates (not an API key)

1. `POST /api/v1/auth/login` or `POST /api/v1/auth/verify-otp` returns `accessToken` + `refreshToken`.
2. Every protected call: header `Authorization: Bearer <accessToken>`.
3. On 401: `POST /api/v1/auth/refresh` with the refresh token, then retry.
4. Identity always comes from JWT `sub`. Clients cannot send `user_id` to act as someone else.

Envelope:

```json
{ "success": true, "data": {}, "request_id": "..." }
```

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." }, "request_id": "..." }
```

---

## 4. How to run

```bash
cd backend
docker compose up --build
```

Host run (optional):

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
docker compose up postgres redis
copy .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8080
```

Tests:

```bash
cd backend
pytest
```

---

## 5. Complete API catalog

Base path: `http://localhost:8080`

**Auth column:** `no` = public. `Bearer` = access JWT. `refresh` = refresh token in body. `staff` = JWT user with `REVIEWER` or `ADMIN` role in the database. `webhook` = store shared secret / JWS.

### Health (no `/api/v1` prefix)

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | no |
| GET | `/ready` | no |

### Public (no `/api/v1` prefix)

| Method | Path | Auth |
|--------|------|------|
| GET | `/.well-known/assetlinks.json` | no |
| GET | `/.well-known/apple-app-site-association` | no |
| GET | `/events/{event_id}` | no (HTML share landing) |

Authenticated event JSON remains `GET /api/v1/events/{event_id}`.

### Authentication — `/api/v1/auth`

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/auth/register` | no |
| POST | `/api/v1/auth/login` | no |
| POST | `/api/v1/auth/refresh` | refresh body |
| POST | `/api/v1/auth/logout` | optional Bearer + refresh |
| POST | `/api/v1/auth/verify-otp` | no |
| POST | `/api/v1/auth/forgot-password` | no |
| POST | `/api/v1/auth/reset-password` | no |
| POST | `/api/v1/auth/resend-otp` | no |
| GET | `/api/v1/auth/me` | Bearer |
| GET | `/api/v1/auth/dev/otp` | no (development peek only) |

- Register body: `{ email, password }` (min 8). Returns `userId`, `verificationRequired`. **No tokens.**
- Verify OTP body: `{ email, otp }`. Returns `accessToken`, `refreshToken`, expiries, `userId`.
- Login body: `{ email, password, device_id? }`. Returns token pair.
- Refresh rotates the refresh token. Reuse of a revoked token invalidates the family.
- Resend OTP body: `{ email, purpose }` (`signup` or `reset`).
- Forgot always returns success (no email enumeration).
- Dev OTP: query `email`, `purpose=signup`. Do not expose in production.

### Profile — `/api/v1`

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

Upload flow: request URL → `PUT` bytes → `POST /profile/media` `{ storageKey, sortOrder, isPrimary }`. JPEG/PNG/WebP, max 8 MB, max 6 photos.

### Discovery and safety

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/discovery` | Bearer |
| POST | `/api/v1/discovery/impressions` | Bearer |
| GET | `/api/v1/safety/blocks` | Bearer |
| POST | `/api/v1/safety/blocks` | Bearer |
| DELETE | `/api/v1/safety/blocks/{user_id}` | Bearer |

Discovery query: `minAge`, `maxAge`, `gender`, `lookingFor`, `maxDistanceKm`, `interests`, `verifiedOnly`, `city`, `limit`, `cursor`.

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

Like/favorite body: `{ "userId": "..." }`. Like response includes `liked`, `matched`, `matchId`, `conversationId`.

### Chat

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/conversations` | Bearer |
| GET | `/api/v1/conversations/{id}/messages` | Bearer |
| POST | `/api/v1/conversations/{id}/messages` | Bearer |
| POST | `/api/v1/conversations/{id}/read` | Bearer |
| GET | `/api/v1/chat/unread-count` | Bearer |
| WS | `/api/v1/ws/chat/{conversation_id}` | Bearer (query or header) |

Send body: `{ content, clientMessageId, messageType: "TEXT" }`.

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

Device body: `{ token, platform, deviceId?, appVersion? }`. Raw FCM token is never returned.

### Verification

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/verification/status` | Bearer |
| POST | `/api/v1/verification/start` | Bearer |
| POST | `/api/v1/verification/upload-url` | Bearer |
| POST | `/api/v1/verification/submit` | Bearer |
| POST | `/api/v1/verification/cancel` | Bearer |
| POST | `/api/v1/verification/retry` | Bearer |
| GET | `/api/v1/verification/media/{media_id}` | Bearer (owner) |
| POST | `/api/v1/verification/review` | Bearer reviewer/admin |

### Reports

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/reports` | Bearer |

Body: `{ reportedUserId, reason or reasonCode, details?, messageId? }`.

### Events

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/events` | Bearer |
| GET | `/api/v1/events/{event_id}` | Bearer |
| POST | `/api/v1/events` | Bearer |
| PATCH | `/api/v1/events/{event_id}` | Bearer (host) |
| DELETE | `/api/v1/events/{event_id}` | Bearer (host) |
| POST | `/api/v1/events/{event_id}/rsvp` | Bearer |
| DELETE | `/api/v1/events/{event_id}/rsvp` | Bearer |
| POST | `/api/v1/events/{event_id}/cover/upload-url` | Bearer |
| POST | `/api/v1/events/{event_id}/cover` | Bearer |
| DELETE | `/api/v1/events/{event_id}/cover` | Bearer |

### Subscriptions and entitlements

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/subscriptions/catalog` | Bearer |
| GET | `/api/v1/subscriptions/me` | Bearer |
| GET | `/api/v1/subscriptions/history` | Bearer |
| POST | `/api/v1/subscriptions/verify` | Bearer |
| POST | `/api/v1/subscriptions/restore` | Bearer |
| GET | `/api/v1/entitlements` | Bearer |
| POST | `/api/v1/webhooks/google-play` | webhook |
| POST | `/api/v1/webhooks/apple` | webhook |

Verify body: `{ platform, productId, purchaseToken, applicationId? }`. Flutter `isPremium` is not trusted.

### Admin (staff JWT only)

| Method | Path | Auth |
|--------|------|------|
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

---

## 6. Rate-limit policies (server-side)

Named Redis counters. Clients cannot override them. Values are `(max requests, window seconds)`.

| Policy | Limit |
|--------|--------|
| registration | 5 / 3600 |
| login | 10 / 900 |
| otp_generation | 5 / 3600 |
| otp_verification | 10 / 900 |
| forgot_password | 5 / 3600 |
| profile_changes | 20 / 3600 |
| discovery | 120 / 60 |
| likes | 60 / 60 |
| chat_requests | 20 / 60 |
| messages | 40 / 60 |
| reports | 10 / 3600 |
| device_register | 40 / 3600 |
| verification_* | see `app/core/rate_limit.py` |
| subscription_verify / restore | 20 / 3600 |
| events_list | 60 / 60 |
| events_mutate | 20 / 3600 |

Staging only: registration 20/600, login 30/600.

---

## 7. Related folders (not in the backend zip)

| Folder | What it is |
|--------|------------|
| `lib/` | Flutter app |
| `apps/admin/` | Next.js staff UI (`localhost:3000`). Compose builds it from `../apps/admin`. Zip separately if they need the admin dashboard. |
| `docs/` | Markdown docs (this file lives here) |
| `android/` `ios/` | Mobile native projects |

---

## 8. Secret checklist to send separately (never in git / zip)

Give these to the backend owner over a password manager, not email/chat files:

1. `JWT_SECRET` (32+ random chars) per environment
2. Production/staging `DATABASE_URL` and `REDIS_URL`
3. Firebase Admin SDK JSON file + `FIREBASE_PROJECT_ID`
4. Google Play service-account JSON + `GOOGLE_PLAY_WEBHOOK_SECRET` + Pub/Sub names
5. Apple IAP issuer, key id, `.p8` private key
6. `APPLE_TEAM_ID` and Android SHA-256 fingerprints
7. `CORS_ORIGINS` for the real frontend origins
