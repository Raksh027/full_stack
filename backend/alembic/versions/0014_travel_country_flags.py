"""Travel journeys: store country codes and flag URLs.

Revision ID: 0014_travel_country_flags
Revises: 0013_travel_hide_from
Create Date: 2026-09-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014_travel_country_flags"
down_revision: str | None = "0013_travel_hide_from"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COUNTRY_CODES = {
    "afghanistan": "af",
    "australia": "au",
    "austria": "at",
    "bangladesh": "bd",
    "belgium": "be",
    "brazil": "br",
    "canada": "ca",
    "china": "cn",
    "egypt": "eg",
    "france": "fr",
    "germany": "de",
    "india": "in",
    "indonesia": "id",
    "italy": "it",
    "japan": "jp",
    "malaysia": "my",
    "nepal": "np",
    "netherlands": "nl",
    "pakistan": "pk",
    "singapore": "sg",
    "spain": "es",
    "thailand": "th",
    "uae": "ae",
    "united arab emirates": "ae",
    "uk": "gb",
    "united kingdom": "gb",
    "usa": "us",
    "united states": "us",
}


def upgrade() -> None:
    op.add_column(
        "travel_journeys",
        sa.Column("from_country_code", sa.String(8), nullable=False, server_default=""),
    )
    op.add_column(
        "travel_journeys",
        sa.Column("from_country_flag", sa.String(512), nullable=False, server_default=""),
    )
    op.add_column(
        "travel_journeys",
        sa.Column("to_country_code", sa.String(8), nullable=False, server_default=""),
    )
    op.add_column(
        "travel_journeys",
        sa.Column("to_country_flag", sa.String(512), nullable=False, server_default=""),
    )

    journeys = sa.table(
        "travel_journeys",
        sa.column("id", sa.Uuid),
        sa.column("from_country", sa.String),
        sa.column("to_country", sa.String),
        sa.column("from_country_code", sa.String),
        sa.column("from_country_flag", sa.String),
        sa.column("to_country_code", sa.String),
        sa.column("to_country_flag", sa.String),
    )
    bind = op.get_bind()
    rows = bind.execute(sa.select(journeys.c.id, journeys.c.from_country, journeys.c.to_country))
    for journey_id, from_country, to_country in rows:
        from_code = COUNTRY_CODES.get((from_country or "").strip().lower(), "")
        to_code = COUNTRY_CODES.get((to_country or "").strip().lower(), "")
        bind.execute(
            journeys.update()
            .where(journeys.c.id == journey_id)
            .values(
                from_country_code=from_code,
                from_country_flag=f"https://flagcdn.com/w80/{from_code}.png" if from_code else "",
                to_country_code=to_code,
                to_country_flag=f"https://flagcdn.com/w80/{to_code}.png" if to_code else "",
            )
        )

    op.alter_column("travel_journeys", "from_country_code", server_default=None)
    op.alter_column("travel_journeys", "from_country_flag", server_default=None)
    op.alter_column("travel_journeys", "to_country_code", server_default=None)
    op.alter_column("travel_journeys", "to_country_flag", server_default=None)


def downgrade() -> None:
    op.drop_column("travel_journeys", "to_country_flag")
    op.drop_column("travel_journeys", "to_country_code")
    op.drop_column("travel_journeys", "from_country_flag")
    op.drop_column("travel_journeys", "from_country_code")
