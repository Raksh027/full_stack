"""Travel journeys: hide-from gender.

Revision ID: 0013_travel_hide_from
Revises: 0012_mobile_contract
Create Date: 2026-09-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013_travel_hide_from"
down_revision: str | None = "0012_mobile_contract"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "travel_journeys",
        sa.Column("hide_from", sa.String(20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("travel_journeys", "hide_from")
