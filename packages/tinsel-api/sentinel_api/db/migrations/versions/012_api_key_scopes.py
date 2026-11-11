"""Scope, describe and expire API keys; seed the catalogue accession counter.

Until now a key was all or nothing: any valid key could register a sequence and
revoke a certificate. The archive runs on closed service accounts, and the
distinction that matters operationally is that the Genome Watch agent may draft
a catalogue record and may not publish one. That has to be a permission checked
per request, not a line in a prompt.

Existing keys are backfilled with no scopes, which is the fail-closed reading:
they keep working on the older unscoped routes and can do nothing on a scoped
one until someone grants them a scope deliberately.

Also seeds `catalogue_seq_num`, so AGC- accessions come from their own counter
and never interleave with AG- certificate numbers.

Revision ID: 012
Revises: 010
Create Date: 2026-11-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "012"
down_revision: str | None = "010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CATALOGUE_SEQ_COUNTER = "catalogue_seq_num"


def upgrade() -> None:
    op.add_column(
        "api_keys",
        sa.Column(
            "scopes",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column("api_keys", sa.Column("description", sa.String(255), nullable=True))
    op.add_column("api_keys", sa.Column("created_by", sa.String(128), nullable=True))
    op.add_column(
        "api_keys",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Seed from any catalogue records already present so numbering stays
    # contiguous, and from 1 on an empty archive. The id suffix is the last
    # hyphen-separated group of an AGC-YYYY-NNNNNN accession.
    op.execute(
        f"""
        INSERT INTO registry_counters (name, next_value)
        SELECT '{CATALOGUE_SEQ_COUNTER}',
               COALESCE(MAX(CAST(split_part(id, '-', 3) AS BIGINT)), 0) + 1
          FROM catalogue_records
        ON CONFLICT (name) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute(
        f"DELETE FROM registry_counters WHERE name = '{CATALOGUE_SEQ_COUNTER}'"
    )
    op.drop_column("api_keys", "expires_at")
    op.drop_column("api_keys", "created_by")
    op.drop_column("api_keys", "description")
    op.drop_column("api_keys", "scopes")
