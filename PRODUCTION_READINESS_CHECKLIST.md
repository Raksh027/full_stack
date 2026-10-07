# BoomBoom Backend — Production Readiness Checklist

> Generated: 2026-10-07  
> Audited by: Cursor AI  
> Scope: `backend/` (FastAPI + PostgreSQL + Redis + Docker)

---

## Audit Summary

| Severity | Count | Status |
|----------|-------|--------|
| P0 — Critical (production blocker) | 7 | ✅ Fixed |
| P1 — High (should fix before launch) | 4 | ✅ Fixed |
| P2 — Medium (recommended improvements) | 5 | 📋 Documented |
| INFO — Notes | 3 | ℹ️ No action needed |

---

## P0 — Critical Issues (Production Blockers)

### P0-1: Missing HSTS Header ✅ FIXED
**File:** `app/middleware/request_id.py` — `SecurityHeadersMiddleware`  
**Problem:** `Strict-Transport-Security` header was missing. Without HSTS, HTTPS-only production deployments are vulnerable to SSL stripping attacks. Browsers won't enforce HTTPS on subsequent visits.  
**Fix:** Added `Strict-Transport-Security: max-age=31536000; includeSubDomains` header when `APP_ENV=production`.

### P0-2: OpenAPI Docs Exposed in Production ✅ FIXED
**File:** `app/main.py` — `create_app()`  
**Problem:** `/docs` (Swagger UI) and `/redoc` were always enabled regardless of environment. In production this exposes full API surface to attackers.  
**Fix:** `docs_url` and `redoc_url` are now `None` in production. Dev/staging keep docs enabled.

### P0-3: docker-compose.yml Admin Service Breaks Build ✅ FIXED
**File:** `docker-compose.yml`  
**Problem:** The `admin` service references `../apps/admin` (a Next.js admin UI) which **does not exist** in this workspace. Running `docker compose up` would fail with a build error.  
**Fix:** Moved the `admin` service to a separate `docker-compose.override.admin.yml` file. Run it only when the admin app is present. Default compose now builds cleanly.

### P0-4: Missing Caddyfile (HTTPS Reverse Proxy Config) ✅ FIXED
**File:** `docker-compose.staging.yml` — references `../deploy/Caddyfile.example`  
**Problem:** The staging compose uses a Caddy container for HTTPS/TLS but the Caddyfile didn't exist. Staging deploy would fail immediately.  
**Fix:** Created `deploy/Caddyfile.example` with Caddy 2 config for HTTPS termination, reverse-proxying to the API container, and auto-TLS via Let's Encrypt.

### P0-5: No Production Docker Compose ✅ FIXED
**File:** *(new)* `docker-compose.prod.yml`  
**Problem:** There was a dev compose and a staging compose, but nothing for the actual Hostinger VPS production deployment. Developers had no clear path to go live.  
**Fix:** Created `docker-compose.prod.yml` with hardened settings: no port exposure for Postgres/Redis, Caddy HTTPS, `restart: always`, proper secret injection, and health checks.

### P0-6: No Production Environment Example ✅ FIXED
**File:** *(new)* `.env.production.example`  
**Problem:** `.env.staging.example` existed but there was no guide for what production-specific values to set (different DB name, real JWT secret, live billing mode, CORS for the real domain, etc.).  
**Fix:** Created `.env.production.example` with all required production environment variables, safety guards documented inline.

### P0-7: JWT_SECRET Validation Missing for Staging ✅ FIXED
**File:** `app/config/settings.py` — `validate_runtime()`  
**Problem:** `validate_runtime()` only rejected `replace-with` in the JWT secret for `production`. A staging server launched with the default placeholder secret would pass this check, creating a security hole.  
**Fix:** Extended the validation to also reject the placeholder JWT secret in `staging` mode.

---

## P1 — High Priority Issues

### P1-1: No Dockerfile HEALTHCHECK ✅ FIXED
**File:** `Dockerfile`  
**Problem:** Docker had no way to determine when the API container was actually healthy. `depends_on: condition: service_healthy` in compose would not work correctly.  
**Fix:** Added `HEALTHCHECK` instruction that curls `/health` every 30s with a 10s timeout.

### P1-2: Single Uvicorn Worker in Production ✅ FIXED
**File:** `docker-compose.prod.yml`  
**Problem:** The dev/staging compose runs a single uvicorn process. For production under real load, one worker will bottleneck on CPU-bound work (auth hashing, JWT, etc.).  
**Fix:** Production compose sets `WEB_CONCURRENCY=4` environment variable. Uvicorn respects this via its `--workers` flag in the CMD.

### P1-3: Ruff E501 Linting Violations ✅ FIXED
**Files:** `app/api/v1/admin.py`, `app/api/v1/mobile.py`, `app/core/mobile_maps.py`  
**Problem:** 3 files had lines exceeding the 100-character limit enforced by the project's ruff config.  
**Fix:** Reformatted the offending lines to comply with `line-length = 100`.

### P1-4: JWT_SECRET in Staging Not Guarded ✅ FIXED
*(Covered in P0-7 above)*

---

## P2 — Medium Priority (Recommended Before Production Launch)

### P2-1: Redis Persistence (AOF)
**Status:** 📋 Not fixed — requires infrastructure decision  
**Problem:** The `redis:7-alpine` image defaults to no persistence. If Redis restarts, all sessions, rate-limit counters, and OTP codes are lost.  
**Recommendation:** In `docker-compose.prod.yml`, add `command: redis-server --appendonly yes` and a named volume for Redis data. Already stubbed in the prod compose.

### P2-2: Database Backup Strategy
**Status:** 📋 Not fixed — requires infrastructure decision  
**Problem:** No automated `pg_dump` or backup schedule is configured.  
**Recommendation:** Use Hostinger's managed database service (if available) or a cron job running `pg_dump` + S3/object-storage upload.

### P2-3: Media Storage for Production
**Status:** 📋 Documented  
**Problem:** `MEDIA_STORAGE_PATH` defaults to `./storage/uploads` inside the container. Works in dev but in production you need either a Docker volume (for single-server) or S3-compatible object storage for multi-server.  
**Recommendation:** Set `MEDIA_STORAGE_PATH=/data/uploads` and map a host volume. For scale, implement S3 storage provider.

### P2-4: Firebase Credentials Injection
**Status:** 📋 Documented  
**Problem:** The `.env` file currently has macOS-specific paths (`/Users/chandanegc/...`). The Docker compose mounts the file via `FIREBASE_CREDENTIALS_FILE`, which is correct, but this env var must be set on the production host.  
**Recommendation:** On Hostinger VPS, copy the Firebase Admin JSON to `/etc/boomboom/firebase-admin.json` and set `FIREBASE_CREDENTIALS_FILE=/etc/boomboom/firebase-admin.json` in `.env.production`.

### P2-5: CORS Origins for Production Domain
**Status:** 📋 Documented  
**Problem:** `CORS_ORIGINS` must be set to the actual production domain(s) in the production `.env`. Mobile apps (Flutter) don't send Origin headers so they aren't blocked, but the admin panel would be.  
**Recommendation:** Set `CORS_ORIGINS=https://admin.boomboom.app` (or wherever the admin panel lives).

---

## ℹ️ Info / No Action Required

### INFO-1: `backend 2` Folder — Incomplete Copy
The `backend 2` folder is an incomplete copy of the backend. It cannot start (missing most app code). **Do not deploy or test from `backend 2`.** Use `backend/` only.

### INFO-2: Seed Scripts Are Development-Only
`scripts/seed_delhi.py`, `scripts/seed_frontend_catalog.py`, etc. contain guards that refuse to run in anything other than `APP_ENV=development`. They are safe to ignore in production.

### INFO-3: OTP Email — SMTP Fallback
When `SMTP_USERNAME`/`SMTP_PASSWORD` are empty, the system falls back to `MockOTPProvider` which logs OTP codes to stdout instead of sending email. This is intentional for dev. In production, set real SMTP credentials.

---

## Pre-Flight Checklist for Hostinger VPS

Copy this section and tick each box before going live.

### Server Setup
- [ ] Ubuntu 22.04 LTS VPS provisioned on Hostinger
- [ ] Docker and Docker Compose installed
- [ ] Domain DNS A record pointing to VPS IP
- [ ] Firewall: port 80 and 443 open, 22 (SSH) open, all others closed
- [ ] SSH key auth enabled, password auth disabled

### Secrets & Environment
- [ ] Generate production JWT secret: `python -c "import secrets; print(secrets.token_hex(32))"`
- [ ] Set `APP_ENV=production` in `.env.production`
- [ ] Set `DATABASE_URL` with production credentials (not `boomboom_dev_only`)
- [ ] Set `SUBSCRIPTION_VERIFY_MODE=live`
- [ ] Set `CORS_ORIGINS` to your production domain(s)
- [ ] Set `PUBLIC_APP_ORIGIN=https://yourdomain.com`
- [ ] Copy Firebase Admin JSON to `/etc/boomboom/firebase-admin.json`
- [ ] Set `FIREBASE_CREDENTIALS_FILE=/etc/boomboom/firebase-admin.json`
- [ ] Set real SMTP credentials for OTP emails
- [ ] Configure Razorpay keys for India billing (if applicable)

### Caddy & HTTPS
- [ ] Copy `deploy/Caddyfile.example` to `deploy/Caddyfile` on server
- [ ] Replace `your-domain.com` placeholder in Caddyfile with real domain
- [ ] Ports 80/443 reachable from internet (for Let's Encrypt challenge)

### Deployment
- [ ] `docker compose -f docker-compose.prod.yml pull` or `build`
- [ ] `docker compose -f docker-compose.prod.yml up -d`
- [ ] Check API health: `curl https://your-domain.com/health`
- [ ] Check readiness: `curl https://your-domain.com/ready`
- [ ] Verify Swagger is **NOT** accessible: `curl https://your-domain.com/docs` → 404

### Flutter App
- [ ] Set API base URL to `https://your-domain.com/api/v1`
- [ ] Rebuild Flutter app with production config
- [ ] Test auth flow (register → OTP → login) on real device
- [ ] Test discovery, matching, chat over HTTPS
- [ ] Test push notifications (FCM)
- [ ] Test subscription verify flow

### Monitoring
- [ ] Set up log aggregation (Loki, Datadog, or `docker logs`)
- [ ] Set up uptime monitoring (UptimeRobot or similar) on `/health`
- [ ] Set up database backup cron job

---

## Test Results

### Unit Tests
All 145 unit tests pass (as of audit date).

```
145 passed, 1 warning in 10.33s
```

### Linting
After P1-3 fixes: 0 ruff errors.

---

## Deployment Commands (Quick Reference)

```bash
# On Hostinger VPS — first deploy
git clone <your-repo> /opt/boomboom
cd /opt/boomboom/backend
cp .env.production.example .env.production
# Edit .env.production with real secrets
docker compose -f docker-compose.prod.yml up -d --build

# Check status
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api

# Update (rolling)
git pull
docker compose -f docker-compose.prod.yml up -d --build api worker

# View migration status
docker compose -f docker-compose.prod.yml exec api alembic current
```
