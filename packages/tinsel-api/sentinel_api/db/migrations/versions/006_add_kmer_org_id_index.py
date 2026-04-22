"""Add missing index on fragment_kmer_index.org_id.

org_id is filtered in assembly-risk cross-checks but was absent from
migration 005.  This index covers that query path without touching data.

Revision ID: 006
Revises: 005
Create Date: 2026-04-22 00:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "006"
down_revision: str | None = "005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("ix_fragment_kmer_org_id", "fragment_kmer_index", ["org_id"])


def downgrade() -> None:
    op.drop_index("ix_fragment_kmer_org_id", table_name="fragment_kmer_index")
