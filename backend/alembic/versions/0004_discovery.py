"""Discovery blocks, impressions, and profile filter indexes.

Revision ID: 0004_discovery
Revises: 0003_profile_module
Create Date: 2026-09-06
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004_discovery"
down_revision: str | None = "0003_profile_module"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("ix_profiles_visibility", "profiles", ["visibility"])
    op.create_index("ix_profiles_gender", "profiles", ["gender"])
    op.create_index("ix_profiles_birth_date", "profiles", ["birth_date"])

    op.create_table(
        "user_blocks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "blocker_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "blocked_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("blocker_id", "blocked_id", name="uq_user_blocks_pair"),
    )
    op.create_index("ix_user_blocks_blocker_id", "user_blocks", ["blocker_id"])
    op.create_index("ix_user_blocks_blocked_id", "user_blocks", ["blocked_id"])

    op.create_table(
        "discovery_impressions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "viewer_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "viewed_user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_discovery_impressions_viewer_created",
        "discovery_impressions",
        ["viewer_id", "created_at"],
    )
    op.create_index(
        "ix_discovery_impressions_pair",
        "discovery_impressions",
        ["viewer_id", "viewed_user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_discovery_impressions_pair", table_name="discovery_impressions")
    op.drop_index("ix_discovery_impressions_viewer_created", table_name="discovery_impressions")
    op.drop_table("discovery_impressions")
    op.drop_index("ix_user_blocks_blocked_id", table_name="user_blocks")
    op.drop_index("ix_user_blocks_blocker_id", table_name="user_blocks")
    op.drop_table("user_blocks")
    op.drop_index("ix_profiles_birth_date", table_name="profiles")
    op.drop_index("ix_profiles_gender", table_name="profiles")
    op.drop_index("ix_profiles_visibility", table_name="profiles")
