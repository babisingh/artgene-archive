"""007 — add sequence_distributions table for provenance tracing.

Revision ID: 007
Revises: 006
Create Date: 2026-04-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sequence_distributions",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "sequence_id",
            sa.String(20),
            sa.ForeignKey("certificates.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "org_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organisations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("recipient_name", sa.String(255), nullable=False),
        sa.Column("recipient_org", sa.String(255), nullable=False),
        sa.Column("recipient_email", sa.String(255), nullable=True),
        sa.Column("purpose", sa.String(64), nullable=False, server_default="other"),
        sa.Column("fingerprint_id", sa.String(64), nullable=False, unique=True),
        sa.Column("fingerprint_seed_hex", sa.String(64), nullable=False),
        sa.Column("host_organism", sa.String(32), nullable=False, server_default="ECOLI"),
        sa.Column(
            "issued_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_seq_dist_sequence_id", "sequence_distributions", ["sequence_id"])
    op.create_index("ix_seq_dist_org_id", "sequence_distributions", ["org_id"])


def downgrade() -> None:
    op.drop_index("ix_seq_dist_org_id", table_name="sequence_distributions")
    op.drop_index("ix_seq_dist_sequence_id", table_name="sequence_distributions")
    op.drop_table("sequence_distributions")
