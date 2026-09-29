"""Reports, suspension window, audit actor/target, verification lock.

Revision ID: 0008_moderation
Revises: 0007_verification
Create Date: 2026-09-06
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008_moderation"
down_revision: str | None = "0007_verification"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("suspended_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "verification_requests",
        sa.Column("lock_version", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("audit_logs", sa.Column("actor_id", sa.Uuid(), nullable=True))
    op.add_column("audit_logs", sa.Column("target_type", sa.String(40), nullable=True))
    op.add_column("audit_logs", sa.Column("target_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_audit_logs_actor_id",
        "audit_logs",
        "users",
        ["actor_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])
    op.create_index("ix_audit_logs_target", "audit_logs", ["target_type", "target_id"])

    op.create_table(
        "reports",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "reporter_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "reported_user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("reason_code", sa.String(40), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("related_content_type", sa.String(40), nullable=True),
        sa.Column("related_content_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="OPEN"),
        sa.Column("severity", sa.String(16), nullable=False, server_default="MEDIUM"),
        sa.Column(
            "assigned_reviewer_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("resolution_code", sa.String(40), nullable=True),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("reporter_id <> reported_user_id", name="ck_reports_not_self"),
    )
    op.create_index("ix_reports_status", "reports", ["status"])
    op.create_index("ix_reports_severity", "reports", ["severity"])
    op.create_index("ix_reports_assigned_reviewer_id", "reports", ["assigned_reviewer_id"])
    op.create_index("ix_reports_created_at", "reports", ["created_at"])
    op.create_index("ix_reports_reported_user_id", "reports", ["reported_user_id"])
    op.create_index("ix_reports_reporter_id", "reports", ["reporter_id"])
    op.create_index("ix_reports_status_created", "reports", ["status", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_reports_status_created", table_name="reports")
    op.drop_index("ix_reports_reporter_id", table_name="reports")
    op.drop_index("ix_reports_reported_user_id", table_name="reports")
    op.drop_index("ix_reports_created_at", table_name="reports")
    op.drop_index("ix_reports_assigned_reviewer_id", table_name="reports")
    op.drop_index("ix_reports_severity", table_name="reports")
    op.drop_index("ix_reports_status", table_name="reports")
    op.drop_table("reports")
    op.drop_index("ix_audit_logs_target", table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor_id", table_name="audit_logs")
    op.drop_constraint("fk_audit_logs_actor_id", "audit_logs", type_="foreignkey")
    op.drop_column("audit_logs", "target_id")
    op.drop_column("audit_logs", "target_type")
    op.drop_column("audit_logs", "actor_id")
    op.drop_column("verification_requests", "lock_version")
    op.drop_column("users", "suspended_until")
