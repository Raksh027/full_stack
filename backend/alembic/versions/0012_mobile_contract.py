"""Mobile app contract: richer profiles, swipes, travel, tonight.

Revision ID: 0012_mobile_contract
Revises: 0011_events
Create Date: 2026-09-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0012_mobile_contract"
down_revision: str | None = "0011_events"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_auth",
        sa.Column("provider", sa.String(20), nullable=False, server_default="email"),
    )
    op.alter_column("user_auth", "password_hash", existing_type=sa.String(255), nullable=True)

    op.add_column(
        "profiles",
        sa.Column("show_orientation", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column("profiles", sa.Column("languages", postgresql.JSONB(), nullable=True))
    op.add_column("profiles", sa.Column("work_category", sa.String(80), nullable=True))
    op.add_column("profiles", sa.Column("job_title", sa.String(120), nullable=True))
    op.add_column("profiles", sa.Column("company", sa.String(120), nullable=True))
    op.add_column("profiles", sa.Column("school", sa.String(120), nullable=True))
    op.add_column("profiles", sa.Column("height_cm", sa.Integer(), nullable=True))
    op.add_column("profiles", sa.Column("lifestyle", postgresql.JSONB(), nullable=True))
    op.add_column("profiles", sa.Column("nationality", sa.String(80), nullable=True))

    op.add_column(
        "preferences",
        sa.Column("is_discoverable", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "preferences",
        sa.Column("online_only", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("preferences", sa.Column("filters", postgresql.JSONB(), nullable=True))

    op.add_column(
        "notification_preferences",
        sa.Column("all_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "notification_preferences",
        sa.Column("profile_views", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "notification_preferences",
        sa.Column("cross_path", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "notification_preferences",
        sa.Column("traveller_alerts", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "notification_preferences",
        sa.Column("free_tonight", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "notification_preferences",
        sa.Column("email_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.add_column(
        "likes",
        sa.Column("is_superlike", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "discovery_swipes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "actor_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "target_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Index("ix_discovery_swipes_actor_created", "actor_id", "created_at"),
        sa.Index("ix_discovery_swipes_actor_target", "actor_id", "target_id"),
    )

    op.create_table(
        "profile_views",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "viewer_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "viewed_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Index("ix_profile_views_viewed_created", "viewed_id", "created_at"),
        sa.Index("ix_profile_views_viewer_viewed", "viewer_id", "viewed_id"),
    )

    op.create_table(
        "travel_journeys",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("from_city", sa.String(120), nullable=False, server_default=""),
        sa.Column("from_country", sa.String(120), nullable=False, server_default=""),
        sa.Column("to_city", sa.String(120), nullable=False, server_default=""),
        sa.Column("to_country", sa.String(120), nullable=False, server_default=""),
        sa.Column("departure", sa.String(40), nullable=False, server_default=""),
        sa.Column("return_date", sa.String(40), nullable=False, server_default=""),
        sa.Column("trip_type", sa.String(40), nullable=False, server_default="vacation"),
        sa.Column("travel_style", sa.String(40), nullable=False, server_default="solo"),
        sa.Column("companion", sa.String(40), nullable=False, server_default="any"),
        sa.Column("status", sa.String(20), nullable=False, server_default="upcoming"),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("cover_image", sa.String(1024), nullable=True),
        sa.Column("hide_from_country", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Index("ix_travel_journeys_user_id", "user_id"),
        sa.Index("ix_travel_journeys_to_country", "to_country"),
    )

    op.create_table(
        "tonight_posts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("activity", sa.String(40), nullable=False),
        sa.Column("venue", sa.String(160), nullable=False, server_default=""),
        sa.Column("tagline", sa.String(240), nullable=False, server_default=""),
        sa.Column("looking_for", sa.String(160), nullable=False, server_default=""),
        sa.Column("meet_time", sa.String(40), nullable=False, server_default=""),
        sa.Column("featured_photo", sa.String(1024), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Index("ix_tonight_posts_user_id", "user_id"),
        sa.Index("ix_tonight_posts_activity", "activity"),
        sa.Index("ix_tonight_posts_expires_at", "expires_at"),
    )


def downgrade() -> None:
    op.drop_table("tonight_posts")
    op.drop_table("travel_journeys")
    op.drop_table("profile_views")
    op.drop_table("discovery_swipes")
    op.drop_column("likes", "is_superlike")
    op.drop_column("notification_preferences", "email_enabled")
    op.drop_column("notification_preferences", "free_tonight")
    op.drop_column("notification_preferences", "traveller_alerts")
    op.drop_column("notification_preferences", "cross_path")
    op.drop_column("notification_preferences", "profile_views")
    op.drop_column("notification_preferences", "all_enabled")
    op.drop_column("preferences", "filters")
    op.drop_column("preferences", "online_only")
    op.drop_column("preferences", "is_discoverable")
    op.drop_column("profiles", "nationality")
    op.drop_column("profiles", "lifestyle")
    op.drop_column("profiles", "height_cm")
    op.drop_column("profiles", "school")
    op.drop_column("profiles", "company")
    op.drop_column("profiles", "job_title")
    op.drop_column("profiles", "work_category")
    op.drop_column("profiles", "languages")
    op.drop_column("profiles", "show_orientation")
    op.alter_column("user_auth", "password_hash", existing_type=sa.String(255), nullable=False)
    op.drop_column("user_auth", "provider")
