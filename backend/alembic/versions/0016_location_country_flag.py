"""Locations: persist country ISO code and flag URL.

Revision ID: 0016_location_country_flag
Revises: 0015_travel_states
Create Date: 2026-09-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0016_location_country_flag"
down_revision: str | None = "0015_travel_states"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("locations", sa.Column("country_code", sa.String(length=8), nullable=True))
    op.add_column("locations", sa.Column("country_flag", sa.String(length=512), nullable=True))

    from app.core.country_iso import COUNTRY_ISO

    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, country FROM locations WHERE country IS NOT NULL")).fetchall()
    for row_id, country in rows:
        iso = COUNTRY_ISO.get((country or "").strip().lower(), "")
        if not iso:
            continue
        conn.execute(
            sa.text(
                "UPDATE locations SET country_code = :code, country_flag = :flag WHERE id = :id"
            ),
            {
                "code": iso,
                "flag": f"https://flagcdn.com/w80/{iso}.png",
                "id": row_id,
            },
        )


def downgrade() -> None:
    op.drop_column("locations", "country_flag")
    op.drop_column("locations", "country_code")
