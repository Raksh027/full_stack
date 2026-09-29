"""Profile verification requests, media, and reviews.

Revision ID: 0007_verification
Revises: 0006_notifications
Create Date: 2026-09-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0007_verification"
down_revision: str | None = "0006_notifications"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", sa.String(32), nullable=False, server_default="USER"),
    )

    op.create_table(
        "verification_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "verification_type", sa.String(40), nullable=False, server_default="SELFIE_VERIFICATION"
        ),
        sa.Column("status", sa.String(32), nullable=False, server_default="PENDING"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "reviewer_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("rejection_reason_code", sa.String(40), nullable=True),
        sa.Column("provider_session_id", sa.String(160), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "verification_type IN ('PROFILE_VERIFICATION', 'SELFIE_VERIFICATION')",
            name="ck_verification_requests_type",
        ),
        sa.CheckConstraint(
            "status IN ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED')",
            name="ck_verification_requests_status",
        ),
    )
    op.create_index("ix_verification_requests_user_id", "verification_requests", ["user_id"])
    op.create_index("ix_verification_requests_status", "verification_requests", ["status"])
    op.create_index(
        "ix_verification_requests_user_status",
        "verification_requests",
        ["user_id", "status"],
    )
    op.create_index(
        "ix_verification_requests_user_created",
        "verification_requests",
        ["user_id", "created_at"],
    )
    op.create_index(
        "uq_verification_requests_active",
        "verification_requests",
        ["user_id", "verification_type"],
        unique=True,
        postgresql_where=sa.text("status IN ('PENDING', 'IN_REVIEW')"),
    )

    op.create_table(
        "verification_media",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "verification_request_id",
            sa.Uuid(),
            sa.ForeignKey("verification_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("media_type", sa.String(32), nullable=False, server_default="selfie"),
        sa.Column("storage_key", sa.String(512), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("storage_key", name="uq_verification_media_storage_key"),
    )
    op.create_index(
        "ix_verification_media_request_id",
        "verification_media",
        ["verification_request_id"],
    )

    op.create_table(
        "verification_reviews",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "verification_request_id",
            sa.Uuid(),
            sa.ForeignKey("verification_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "reviewer_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("action", sa.String(32), nullable=False),
        sa.Column("reason_code", sa.String(40), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index(
        "ix_verification_reviews_request_id",
        "verification_reviews",
        ["verification_request_id"],
    )
    op.create_index("ix_verification_reviews_reviewer_id", "verification_reviews", ["reviewer_id"])
    op.create_index("ix_verification_reviews_created_at", "verification_reviews", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_verification_reviews_created_at", table_name="verification_reviews")
    op.drop_index("ix_verification_reviews_reviewer_id", table_name="verification_reviews")
    op.drop_index("ix_verification_reviews_request_id", table_name="verification_reviews")
    op.drop_table("verification_reviews")
    op.drop_index("ix_verification_media_request_id", table_name="verification_media")
    op.drop_table("verification_media")
    op.drop_index("uq_verification_requests_active", table_name="verification_requests")
    op.drop_index("ix_verification_requests_user_created", table_name="verification_requests")
    op.drop_index("ix_verification_requests_user_status", table_name="verification_requests")
    op.drop_index("ix_verification_requests_status", table_name="verification_requests")
    op.drop_index("ix_verification_requests_user_id", table_name="verification_requests")
    op.drop_table("verification_requests")
    op.drop_column("users", "role")
