# BoomBoom backend

Production-ready **modular monolith** for the BoomBoom Flutter app. This phase implements authentication, PostgreSQL + PostGIS, Redis, rate limiting, and operational endpoints. Discovery, chat, matching, and payments are **not** included yet.

## Start locally

```bash
cd backend
docker compose up --build
```

API: http://localhost:8080  
Swagger: http://localhost:8080/docs  
Health: http://localhost:8080/health  
Ready: http://localhost:8080/ready  

Postgres data is stored in the `boomboom_pgdata` Docker volume.

Copy `.env.example` to `.env` for host-run development (not required for compose).

## Host development (optional)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -e ".[dev]"
# Start only postgres + redis:
docker compose up postgres redis
alembic upgrade head
uvicorn app.main:app --reload --port 8080
```

## Tests

```bash
cd backend
pytest
```

Integration tests need a reachable Postgres URL (`DATABASE_URL` or `TEST_DATABASE_URL`) after migrations.

## Layout

`app/api` → `app/services` → `app/repositories` → PostgreSQL / Redis
