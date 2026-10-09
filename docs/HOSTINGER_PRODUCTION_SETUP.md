# BoomBoom API — Hostinger production setup

Run every command from `backend/` on the VPS unless a command says otherwise. Real secrets stay in `.env.production` and credential files on the server. Do not commit those files.

Compose file: `backend/docker-compose.prod.yml`  
Env template: `backend/.env.production.example`  
HTTPS termination: host Nginx (`nginx/1.24.0`) with Let's Encrypt certificates (TLS-ALPN-01 via certbot)  
Nginx config: `deploy/nginx/api.boomboom.app.conf`  
WebSocket map: `deploy/nginx/websocket_upgrade.conf`

The API container publishes port 8080 **on the loopback only** (`127.0.0.1:8080`). It is not reachable from the public internet. Postgres and Redis have no published ports. All public traffic enters through host Nginx.

Caddy is still present in the Compose file under the `caddy` profile for rollback. It does not start unless you explicitly pass `--profile caddy`.

`docker compose` interpolates `${POSTGRES_USER}`, `${POSTGRES_PASSWORD}`, `${FIREBASE_CREDENTIALS_FILE}`, and `${GOOGLE_PLAY_SERVICE_ACCOUNT_FILE}` from `--env-file .env.production`. Every production Compose command below includes `--env-file .env.production`.

## Architecture overview

```
Internet
  │
  ▼
AWS Global Accelerator (anycast 3.33.165.172, 15.197.228.149)
  │  GA:443 ─── TCP passthrough ──► VPS:443
  │  GA:80  ─── port override ────► VPS:443   (port 80 is NOT forwarded to VPS:80)
  ▼
Hostinger VPS  (public IP)
  ├─ host Nginx (port 443)  ← certbot TLS cert  api.boomboom.app
  │     └─ proxy_pass http://127.0.0.1:8080
  │                       │
  │                       ▼
  │               Docker (loopback only)
  │               ┌────────────────────────────────┐
  │               │  api container  (port 8080)     │
  │               │  worker container               │
  │               │  postgres container             │
  │               │  redis container                │
  │               └────────────────────────────────┘
  └─ host Nginx (port 80 + port 443)  api.weprettify.com  (unchanged)
```

### Why GA:80 → VPS:443 matters

The AWS Global Accelerator port override maps GA port 80 to VPS port 443. Port 80 never reaches the VPS. HTTP-01 ACME challenges therefore fail. **TLS-ALPN-01** is the only working method — certbot binds port 443 directly for ~60 seconds while Nginx is stopped, completes the challenge, then Nginx resumes.

During automatic renewal (every ~60 days in practice), certbot pre/post hooks stop and restart Nginx for the ~30 seconds the challenge takes. This is the only planned downtime.

---

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
| `GOOGLE_PLAY_SERVICE_ACCOUNT_FILE` | Host path mounted read-only into the API container. |
| `GOOGLE_PLAY_SERVICE_ACCOUNT` | Container path. Compose sets `/run/secrets/google-play-service-account.json`. |
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

---

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

---

## Firebase

From Firebase console → Project settings → Service accounts → Generate new private key.

On the VPS:

- `FIREBASE_PROJECT_ID` — project id
- `FIREBASE_CREDENTIALS_FILE` — host path of that JSON, template value `/etc/boomboom/firebase-admin.json`

Compose sets `FIREBASE_CREDENTIALS_JSON=/run/secrets/firebase-admin.json` and mounts the host file there read-only. The API process runs as uid 1001, so the host file must be readable by uid 1001.

---

## Razorpay

From the Razorpay dashboard (live mode):

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

The key id is returned to the app by the order API. The key secret and webhook secret stay on the server.

---

## Google Play

From Google Play Console and Google Cloud:

- `GOOGLE_PLAY_PACKAGE_NAME` — `com.boomboomapp.date` unless the application id changes
- `GOOGLE_PLAY_SERVICE_ACCOUNT_FILE` — host path `/etc/boomboom/google-play-service-account.json`
- `GOOGLE_PLAY_SERVICE_ACCOUNT` — container path `/run/secrets/google-play-service-account.json`
- `GOOGLE_PLAY_WEBHOOK_SECRET`
- `GOOGLE_PUBSUB_PROJECT`
- `GOOGLE_PUBSUB_TOPIC`
- `GOOGLE_PUBSUB_SUBSCRIPTION`

Compose mounts `GOOGLE_PLAY_SERVICE_ACCOUNT_FILE` read-only on the `api` service only. `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` and `GOOGLE_PLAY_CREDENTIALS` stay optional fallbacks. The notification worker does not read Play credentials.

---

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

---

## SMTP

OTP email is sent only when both `SMTP_USERNAME` and `SMTP_PASSWORD` are set. In production the API does not fall back to a mock OTP.

- `SMTP_HOST` — for Gmail, `smtp.gmail.com`
- `SMTP_PORT` — `587`
- `SMTP_USERNAME`
- `SMTP_PASSWORD` — mailbox app password, not the account password
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME` — `BoomBoom`

---

## OAuth providers

- `GOOGLE_WEB_CLIENT_ID` and `GOOGLE_IOS_CLIENT_ID` — Google Cloud OAuth client ids used to verify Google ID tokens
- `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` — Meta app settings
- `APPLE_BUNDLE_ID` — Sign in with Apple audience

---

## Public configuration

These are not secrets. They still must match the real domain before go-live.

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

Replace every `your-domain.com` value, including `CORS_ORIGINS`, `PUBLIC_APP_ORIGIN`, and `MEDIA_PUBLIC_BASE_URL`.

---

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

Google Play service account JSON (same directory, same ownership):

```bash
install -m 600 /path/to/google-play-service-account.json /etc/boomboom/google-play-service-account.json
chown 1001:1001 /etc/boomboom/google-play-service-account.json
chmod 600 /etc/boomboom/google-play-service-account.json
```

After the media volume exists, give the same user ownership so uploads can be written:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres redis
docker run --rm -v backend_boomboom_prod_media:/data alpine chown -R 1001:1001 /data
```

If `docker volume ls` shows a different volume name, use that name instead of `backend_boomboom_prod_media`.

---

## HTTPS: certbot + host Nginx

### One-time certificate acquisition

> Prerequisite: DNS for `api.boomboom.app` must resolve through Global Accelerator so GA:443 reaches this VPS. Stop Caddy first so certbot can bind port 443.

```bash
# 1. Stop Caddy (if it was ever started).
#    If it was never started this is a no-op.
docker compose --env-file .env.production -f docker-compose.prod.yml \
  --profile caddy stop proxy

# 2. Stop host Nginx so port 443 is free for the standalone certbot challenge.
systemctl stop nginx

# 3. Obtain certificate — TLS-ALPN-01, standalone mode (certbot binds :443 itself).
certbot certonly \
  --standalone \
  --preferred-challenges tls-alpn-01 \
  -d api.boomboom.app \
  --agree-tos \
  -m admin@boomboom.app

# 4. Verify the cert was issued.
ls -la /etc/letsencrypt/live/api.boomboom.app/

# 5. Restart Nginx.
systemctl start nginx
```

Certbot places the cert at:

```
/etc/letsencrypt/live/api.boomboom.app/fullchain.pem
/etc/letsencrypt/live/api.boomboom.app/privkey.pem
```

These paths are already referenced in `deploy/nginx/api.boomboom.app.conf`.

### Install Nginx config files

From the repo root on the VPS:

```bash
# WebSocket connection-upgrade map (shared; loaded once by Nginx).
cp deploy/nginx/websocket_upgrade.conf /etc/nginx/conf.d/websocket_upgrade.conf

# Virtual-host config for api.boomboom.app.
cp deploy/nginx/api.boomboom.app.conf /etc/nginx/sites-available/api.boomboom.app
ln -sf /etc/nginx/sites-available/api.boomboom.app \
       /etc/nginx/sites-enabled/api.boomboom.app

# Test and reload.
nginx -t && systemctl reload nginx
```

Confirm the existing `api.weprettify.com` site is still enabled and reload did not remove it:

```bash
nginx -T | grep server_name
```

### Certbot automatic renewal

Let's Encrypt certs expire after 90 days. Certbot installs a systemd timer that runs twice daily and renews when fewer than 30 days remain. Because TLS-ALPN-01 requires certbot to bind port 443, Nginx must be stopped for the ~30 seconds the challenge takes.

Configure pre/post hooks:

```bash
# Pre-hook: stop Nginx before renewal.
cat > /etc/letsencrypt/renewal-hooks/pre/stop-nginx.sh << 'EOF'
#!/bin/sh
systemctl stop nginx
EOF
chmod +x /etc/letsencrypt/renewal-hooks/pre/stop-nginx.sh

# Post-hook: restart Nginx after renewal.
cat > /etc/letsencrypt/renewal-hooks/post/start-nginx.sh << 'EOF'
#!/bin/sh
systemctl start nginx
EOF
chmod +x /etc/letsencrypt/renewal-hooks/post/start-nginx.sh
```

Dry-run test to confirm the hooks work:

```bash
certbot renew --dry-run
```

Expected output: `Congratulations, all simulated renewals succeeded`.

---

## Docker Compose

From `backend/`:

```bash
# Validate the rendered Compose (check Firebase/Play mount source paths, no public DB ports).
docker compose --env-file .env.production -f docker-compose.prod.yml config

# First start.
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

# Status.
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

`config` renders the Compose file. Confirm:
- `api.ports` shows `host_ip: 127.0.0.1` (loopback-only — not publicly reachable)
- Firebase and Play credential mounts point at your `/etc/boomboom/` host paths
- `postgres` and `redis` have no `ports:` entries

Do not paste the rendered file into chat or tickets; it contains the database password.

Rolling update of the application containers:

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build api worker
```

The default stack services are `postgres`, `redis`, `api`, and `worker`. Caddy (`proxy`) is excluded from the default profile; see *Caddy rollback* below.

---

## Migrations

The `api` command runs `python -m alembic upgrade head` before Uvicorn, and retries for about 90 seconds. To run migrations manually:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec api python -m alembic upgrade head
docker compose --env-file .env.production -f docker-compose.prod.yml exec api python -m alembic current
```

---

## Health checks

Inside the API container (always works, bypasses TLS):

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec api \
  curl -fsS http://127.0.0.1:8080/health
docker compose --env-file .env.production -f docker-compose.prod.yml exec api \
  curl -fsS http://127.0.0.1:8080/ready
```

From the VPS loopback (confirms Docker→host port binding works):

```bash
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/ready
```

Through Nginx and Global Accelerator (full path):

```bash
curl -4sSI https://api.boomboom.app/health
curl -4fsS https://api.boomboom.app/health
curl -4fsS https://api.boomboom.app/ready
```

`/health` is liveness. `/ready` returns HTTP 200 only when Postgres and Redis both answer.

Confirm `api.weprettify.com` still works after reload:

```bash
curl -4fsS https://api.weprettify.com/health
```

---

## Caddy rollback

Caddy volumes (`boomboom_caddy_data`, `boomboom_caddy_config`) are preserved. To restart Caddy (e.g. for rollback testing) and disable Nginx termination for `api.boomboom.app`:

```bash
# 1. Remove the Nginx site symlink and reload.
rm /etc/nginx/sites-enabled/api.boomboom.app
nginx -t && systemctl reload nginx

# 2. Start Caddy. It will publish port 443 and obtain/renew its own cert.
docker compose --env-file .env.production -f docker-compose.prod.yml \
  --profile caddy up -d proxy
```

To re-enable Nginx after testing:

```bash
# 1. Stop Caddy.
docker compose --env-file .env.production -f docker-compose.prod.yml \
  --profile caddy stop proxy

# 2. Re-enable Nginx site and reload.
ln -sf /etc/nginx/sites-available/api.boomboom.app \
       /etc/nginx/sites-enabled/api.boomboom.app
nginx -t && systemctl reload nginx
```
