"""Travel journeys: persist from/to state.

Revision ID: 0015_travel_states
Revises: 0014_travel_country_flags
Create Date: 2026-09-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015_travel_states"
down_revision: str | None = "0014_travel_country_flags"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "travel_journeys",
        sa.Column("from_state", sa.String(120), nullable=False, server_default=""),
    )
    op.add_column(
        "travel_journeys",
        sa.Column("to_state", sa.String(120), nullable=False, server_default=""),
    )
    op.alter_column("travel_journeys", "from_state", server_default=None)
    op.alter_column("travel_journeys", "to_state", server_default=None)


def downgrade() -> None:
    op.drop_column("travel_journeys", "to_state")
    op.drop_column("travel_journeys", "from_state")
