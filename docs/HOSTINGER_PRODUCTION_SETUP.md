# BoomBoom API — Hostinger production setup

Run every command from `backend/` on the VPS unless a command says otherwise. Real secrets stay in `.env.production` and credential files on the server. Do not commit those files.

Compose file: `backend/docker-compose.prod.yml`  
Env template: `backend/.env.production.example`  
TLS: `deploy/Caddyfile` (Caddy, ports 80 and 443, reverse proxy to `api:8080`)

The API container listens on port 8080 and is not published on the host. Postgres and Redis are not published either. Public traffic enters through Caddy.

`docker compose` interpolates `${POSTGRES_USER}`, `${POSTGRES_PASSWORD}`, and `${FIREBASE_CREDENTIALS_FILE}` from `--env-file .env.production`. The service `env_file` does not do that interpolation. Every production Compose command below includes `--env-file .env.production`.

## Required environment variables

Copy the template once, then edit only the copy on the VPS:

```bash
cp .env.production.example .env.production
python3 scripts/validate_production_env.py
```

The validator prints variable names and a status (`configured`, `missing`, `placeholder`, `too_short`, `invalid`, or `missing_file`). It does not print values. It exits non-zero until the required names are set.

| Variable | Role |
| --- | --- |
| `APP_ENV` | Must be `production`. Compose also sets this. |
| `POSTGRES_USER` | Database role. Compose builds `DATABASE_URL` from this. |
| `POSTGRES_PASSWORD` | Database password. Compose builds `DATABASE_URL` from this. |
| `JWT_SECRET` | HMAC key for access tokens. At least 32 characters. |
| `FIREBASE_CREDENTIALS_FILE` | Host path to the Firebase Admin JSON. Compose bind-mounts it. |
| `FIREBASE_PROJECT_ID` | Firebase project id. |
| `SMTP_HOST` | SMTP server. |
| `SMTP_USERNAME` | SMTP login. |
| `SMTP_PASSWORD` | SMTP password or app password. |
| `SMTP_FROM_EMAIL` | From address for OTP mail. |
| `SUBSCRIPTION_VERIFY_MODE` | Must be `live`. Compose also sets this. |
| `GOOGLE_PLAY_PACKAGE_NAME` | Android application id. |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` or `GOOGLE_PLAY_SERVICE_ACCOUNT` or `GOOGLE_PLAY_CREDENTIALS` | One Play service-account source. |
| `GOOGLE_PLAY_WEBHOOK_SECRET` | Shared secret checked on Play RTDN posts. |
| `GOOGLE_PUBSUB_PROJECT` | GCP project for Play RTDN. |
| `GOOGLE_PUBSUB_TOPIC` | Pub/Sub topic name. |
| `GOOGLE_PUBSUB_SUBSCRIPTION` | Full Pub/Sub subscription resource name. |
| `APPLE_BUNDLE_ID` | Sign in with Apple audience. |
| `APPLE_IAP_ISSUER_ID` | App Store Server API issuer. |
| `APPLE_IAP_KEY_ID` | App Store Server API key id. |
| `APPLE_IAP_PRIVATE_KEY` | Contents of the Apple `.p8` key, one line, with `\n` escapes. |
| `RAZORPAY_KEY_ID` | Razorpay key id. |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret. |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook secret. |
| `GOOGLE_WEB_CLIENT_ID` | Google Sign-In web client id. |
| `GOOGLE_IOS_CLIENT_ID` | Google Sign-In iOS client id. |
| `FACEBOOK_APP_ID` | Facebook app id. |
| `FACEBOOK_APP_SECRET` | Facebook app secret. |
| `PUBLIC_APP_ORIGIN` | Public origin for share links. |
| `APPLE_TEAM_ID` | Apple team id for Universal Links. |
| `ANDROID_SHA256_CERT_FINGERPRINTS` | Play signing cert fingerprints. |
| `CORS_ORIGINS` | Comma-separated browser origins. |
| `MEDIA_PUBLIC_BASE_URL` | Public base URL for uploaded media. |

`DATABASE_URL` and `REDIS_URL` in the template are replaced inside the `api` and `worker` services by Compose (`postgres:5432` / `redis:6379`). Generate the database password once and put it only in `POSTGRES_PASSWORD`.

`APPLE_IAP_WEBHOOK_SECRET` is optional. Live Apple notifications are verified with JWS.

## Generated on the VPS

Generate these on the server. Do not reuse the development JWT secret or `boomboom_dev_only`.

`JWT_SECRET` (64 hex characters):

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

`POSTGRES_PASSWORD` (hex, safe to embed in the Compose `DATABASE_URL`):

```bash
python3 -c "import secrets; print(secrets.token_hex(24))"
```

If `python3` is not installed yet:

```bash
openssl rand -hex 32
openssl rand -hex 24
```

Use the hex password only. Characters such as `@`, `:`, `/`, `+`, and `=` break the URL Compose builds as:

`postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/boomboom_production`

`POSTGRES_USER` can stay `boomboom_prod` (public name, not a secret).

## Firebase

From Firebase console → Project settings → Service accounts → Generate new private key.

On the VPS:

- `FIREBASE_PROJECT_ID` — project id
- `FIREBASE_CREDENTIALS_FILE` — host path of that JSON, template value `/etc/boomboom/firebase-admin.json`

Compose sets `FIREBASE_CREDENTIALS_JSON=/run/secrets/firebase-admin.json` and mounts the host file there read-only. The API process runs as uid 1001, so the host file must be readable by uid 1001.

## Razorpay

From the Razorpay dashboard (live mode):

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

The key id is returned to the app by the order API. The key secret and webhook secret stay on the server.

## Google Play

From Google Play Console and Google Cloud:

- `GOOGLE_PLAY_PACKAGE_NAME` — `com.boomboomapp.date` unless the application id changes
- One of `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `GOOGLE_PLAY_SERVICE_ACCOUNT`, or `GOOGLE_PLAY_CREDENTIALS`
- `GOOGLE_PLAY_WEBHOOK_SECRET`
- `GOOGLE_PUBSUB_PROJECT`
- `GOOGLE_PUBSUB_TOPIC`
- `GOOGLE_PUBSUB_SUBSCRIPTION`

Compose does not mount a Play JSON file. Put the service-account JSON in `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` on the VPS (single line), or set `GOOGLE_PLAY_SERVICE_ACCOUNT` to a path that exists inside the `api` and `worker` containers. A path that exists only on the host is invisible to the app.

## Apple

From App Store Connect → Users and Access → Integrations → In-App Purchase:

- `APPLE_IAP_ISSUER_ID`
- `APPLE_IAP_KEY_ID`
- `APPLE_IAP_PRIVATE_KEY` — contents of the `.p8` file

From the Apple developer account:

- `APPLE_BUNDLE_ID` — `com.boomboom` (Sign in with Apple audience; the iOS app id `com.boomboom.app` is also accepted in code)
- `APPLE_TEAM_ID`
- `APPLE_IAP_EXPECTED_ENVIRONMENT` — `Production` for this stack

Keep the `.p8` file on the VPS only if you need it outside the env file. Do not commit it.

## SMTP

OTP email is sent only when both `SMTP_USERNAME` and `SMTP_PASSWORD` are set. In production the API does not fall back to a mock OTP.

- `SMTP_HOST` — for Gmail, `smtp.gmail.com`
- `SMTP_PORT` — `587`
- `SMTP_USERNAME`
- `SMTP_PASSWORD` — mailbox app password, not the account password
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME` — `BoomBoom`

## OAuth providers

- `GOOGLE_WEB_CLIENT_ID` and `GOOGLE_IOS_CLIENT_ID` — Google Cloud OAuth client ids used to verify Google ID tokens
- `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` — Meta app settings
- `APPLE_BUNDLE_ID` — Sign in with Apple audience

## Public configuration

These are not secrets. They still must match the real domain before go-live. `deploy/Caddyfile` currently uses `api.boomboom.app`.

- `APP_NAME`, `APP_HOST`, `APP_PORT`
- `JWT_ALGORITHM` — `HS256`
- `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`
- `CORS_ORIGINS`
- `PUBLIC_APP_ORIGIN`
- `MEDIA_PUBLIC_BASE_URL`
- `MEDIA_STORAGE_PATH` — `/app/storage/uploads` (Compose volume `boomboom_prod_media`)
- `MEDIA_MAX_BYTES`, `MEDIA_MAX_ITEMS`, `MEDIA_UPLOAD_EXPIRE_SECONDS`
- `LOG_LEVEL`
- `DATABASE_POOL_SIZE`, `DATABASE_MAX_OVERFLOW`
- `POSTGRES_USER` (the password next to it is a secret)
- `GOOGLE_PLAY_PACKAGE_NAME`
- `APPLE_BUNDLE_ID`
- `ANDROID_SHA256_CERT_FINGERPRINTS`
- `SUBSCRIPTION_VERIFY_MODE=live`
- Redis URL inside the stack: `redis://redis:6379/0`

Replace every `your-domain.com` value, including `CORS_ORIGINS`, `PUBLIC_APP_ORIGIN`, and `MEDIA_PUBLIC_BASE_URL`. Point the domain A record at the VPS and open TCP 80 and 443 before the first Caddy start so Let's Encrypt can issue a certificate.

## File permissions

`.env.production` is read by the Docker daemon, not by the app user:

```bash
chmod 600 .env.production
chown root:root .env.production
```

Firebase Admin JSON is bind-mounted and read by uid 1001 (`appuser` in the image):

```bash
install -d -m 700 /etc/boomboom
install -m 600 /path/to/downloaded-firebase-admin.json /etc/boomboom/firebase-admin.json
chown 1001:1001 /etc/boomboom/firebase-admin.json
chmod 600 /etc/boomboom/firebase-admin.json
```

Set `FIREBASE_CREDENTIALS_FILE=/etc/boomboom/firebase-admin.json`.

After the media volume exists, give the same user ownership so uploads can be written:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres redis
docker run --rm -v backend_boomboom_prod_media:/data alpine chown -R 1001:1001 /data
```

If `docker volume ls` shows a different volume name, use that name instead of `backend_boomboom_prod_media`.

## Docker Compose

From `backend/`:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml config
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

`config` renders the Compose file. Confirm the Firebase mount source is the host path you set, and confirm Postgres and Redis have no `ports:` entries. Do not paste the rendered file into chat or tickets; it contains the database password.

Rolling update of the application containers:

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build api worker
```

The stack services are `postgres`, `redis`, `api`, `worker`, and `proxy` (Caddy).

## Migrations

The `api` command runs `python -m alembic upgrade head` before Uvicorn, and retries for about 90 seconds. To run migrations yourself:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec api python -m alembic upgrade head
docker compose --env-file .env.production -f docker-compose.prod.yml exec api python -m alembic current
```

## Health checks

Inside the API container:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec api curl -fsS http://127.0.0.1:8080/health
docker compose --env-file .env.production -f docker-compose.prod.yml exec api curl -fsS http://127.0.0.1:8080/ready
```

`/health` is liveness. `/ready` returns HTTP 200 only when Postgres and Redis both answer.

Through Caddy, after DNS and certificates are in place (replace the host if `deploy/Caddyfile` uses a different name):

```bash
curl -fsS https://api.boomboom.app/health
curl -fsS https://api.boomboom.app/ready
```
