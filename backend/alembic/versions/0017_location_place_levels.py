"""Locations: persist locality (block) and district.

Revision ID: 0017_location_place_levels
Revises: 0016_location_country_flag
Create Date: 2026-09-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017_location_place_levels"
down_revision: str | None = "0016_location_country_flag"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("locations", sa.Column("locality", sa.String(length=120), nullable=True))
    op.add_column("locations", sa.Column("district", sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column("locations", "district")
    op.drop_column("locations", "locality")
