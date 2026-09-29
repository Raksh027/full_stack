"""Check Alembic heads and database URL configuration."""

from alembic.config import Config
from alembic.script import ScriptDirectory


def main() -> None:
    cfg = Config("alembic.ini")
    script = ScriptDirectory.from_config(cfg)
    heads = script.get_heads()
    if len(heads) != 1:
        raise SystemExit(f"Expected a single Alembic head, found: {heads}")
    print(f"alembic_head={heads[0]}")


if __name__ == "__main__":
    main()
