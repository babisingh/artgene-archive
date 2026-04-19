"""Add fragment_kmer_index table for cross-time assembly risk detection.

Stores SHA3-256 hashes of 20-mer subsequences from registered sequences
(≤ 1,500 AA/nt).  Raw k-mer sequences are never stored — only hashes —
preserving sequence confidentiality while enabling overlap detection.

Revision ID: 005
Revises: 004
Create Date: 2026-04-19 00:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: str | None = "004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "fragment_kmer_index",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("registry_id", sa.String(20), nullable=False),
        sa.Column("org_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kmer_hash", sa.String(64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fragment_kmer_hash", "fragment_kmer_index", ["kmer_hash"])
    op.create_index("ix_fragment_kmer_registry_id", "fragment_kmer_index", ["registry_id"])


def downgrade() -> None:
    op.drop_index("ix_fragment_kmer_registry_id", table_name="fragment_kmer_index")
    op.drop_index("ix_fragment_kmer_hash", table_name="fragment_kmer_index")
    op.drop_table("fragment_kmer_index")
