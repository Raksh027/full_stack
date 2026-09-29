from app.config.settings import Settings, normalize_database_url


def test_normalize_render_postgres_schemes() -> None:
    rest = "user:pass@host:5432/db?sslmode=require"
    assert normalize_database_url(f"postgres://{rest}") == f"postgresql+asyncpg://{rest}"
    assert normalize_database_url(f"postgresql://{rest}") == f"postgresql+asyncpg://{rest}"


def test_normalize_leaves_asyncpg_and_unknown() -> None:
    asyncpg = "postgresql+asyncpg://user:pass@host:5432/db"
    assert normalize_database_url(asyncpg) == asyncpg
    sqlite = "sqlite+aiosqlite:///./x.db"
    assert normalize_database_url(sqlite) == sqlite


def test_settings_rewrites_plain_postgresql_url() -> None:
    settings = Settings(
        _env_file=None,
        database_url="postgresql://user:pass@db:5432/app",
        jwt_secret="x" * 32,
    )
    assert settings.database_url == "postgresql+asyncpg://user:pass@db:5432/app"
