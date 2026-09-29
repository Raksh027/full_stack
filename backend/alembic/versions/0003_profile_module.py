"""Profile, location, media, preferences, and interest catalog.

Revision ID: 0003_profile_module
Revises: 0002_session_family
Create Date: 2026-09-06
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003_profile_module"
down_revision: str | None = "0002_session_family"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

INTERESTS = (
    "Travel",
    "Music",
    "Fitness",
    "Cooking",
    "Photography",
    "Art",
    "Movies",
    "Gaming",
    "Reading",
    "Sports",
    "Yoga",
    "Coffee",
    "Dancing",
    "Nature",
    "Pets",
    "Food",
    "Fashion",
    "Tech",
    "Hiking",
    "Swimming",
)


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("onboarding_step", sa.String(length=32), nullable=False, server_default="gender"),
    )

    op.add_column("locations", sa.Column("region", sa.String(length=120), nullable=True))
    op.add_column(
        "locations",
        sa.Column("location_updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.add_column(
        "preferences", sa.Column("orientation_filter", sa.String(length=40), nullable=True)
    )
    op.add_column(
        "preferences", sa.Column("looking_for_filter", sa.String(length=80), nullable=True)
    )

    op.add_column("profile_media", sa.Column("storage_key", sa.String(length=512), nullable=True))
    op.add_column(
        "profile_media", sa.Column("thumbnail_url", sa.String(length=1024), nullable=True)
    )
    op.add_column(
        "profile_media",
        sa.Column(
            "moderation_status", sa.String(length=32), nullable=False, server_default="PENDING"
        ),
    )
    op.add_column(
        "profile_media", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.execute("UPDATE profile_media SET storage_key = id::text WHERE storage_key IS NULL")
    op.alter_column("profile_media", "storage_key", nullable=False)
    op.create_unique_constraint("uq_profile_media_storage_key", "profile_media", ["storage_key"])
    op.create_index(
        "ix_profile_media_profile_active",
        "profile_media",
        ["profile_id", "deleted_at"],
    )

    conn = op.get_bind()
    for name in INTERESTS:
        slug = name.lower().replace(" ", "-")
        conn.execute(
            sa.text(
                """
                INSERT INTO interests (id, slug, name, created_at, updated_at)
                VALUES (gen_random_uuid(), :slug, :name, now(), now())
                ON CONFLICT (slug) DO NOTHING
                """
            ),
            {"slug": slug, "name": name},
        )


def downgrade() -> None:
    op.drop_index("ix_profile_media_profile_active", table_name="profile_media")
    op.drop_constraint("uq_profile_media_storage_key", "profile_media", type_="unique")
    op.drop_column("profile_media", "deleted_at")
    op.drop_column("profile_media", "moderation_status")
    op.drop_column("profile_media", "thumbnail_url")
    op.drop_column("profile_media", "storage_key")
    op.drop_column("preferences", "looking_for_filter")
    op.drop_column("preferences", "orientation_filter")
    op.drop_column("locations", "location_updated_at")
    op.drop_column("locations", "region")
    op.drop_column("users", "onboarding_step")
