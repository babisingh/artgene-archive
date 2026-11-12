"""Allocate audit sequence numbers from a locked counter row.

The audit sequence number was computed as ``count(*) + 1`` over
registry_audit_log, a read-then-write race: two concurrent registrations
compute the same value, and the unique constraint on seq_num fails one of them
with a 500. The same pattern applied to reading the chain head, so two
transactions could extend the chain from the same previous hash.

A PostgreSQL SEQUENCE is the usual answer and is wrong here, because sequence
values are consumed even when the transaction rolls back. The audit chain
relies on seq_num being contiguous in order to be auditable, so a counter row
incremented inside the transaction is the correct primitive: a rollback
un-allocates, and SELECT ... FOR UPDATE serialises allocation and the chain
head read together.

The counter is seeded from the existing log rather than from 1, so this is safe
to apply to a database that already holds entries.

Revision ID: 009
Revises: 008
Create Date: 2026-11-12 00:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "009"
down_revision: str | None = "008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

AUDIT_SEQ_COUNTER = "audit_seq_num"


def upgrade() -> None:
    op.create_table(
        "registry_counters",
        sa.Column("name", sa.String(40), primary_key=True),
        sa.Column("next_value", sa.BigInteger(), nullable=False),
    )

    # Seed from the highest sequence number already issued, so numbering
    # continues contiguously on a populated database and starts at 1 on an
    # empty one.
    op.execute(
        sa.text(
            """
            INSERT INTO registry_counters (name, next_value)
            SELECT :counter_name,
                   COALESCE(MAX(seq_num), 0) + 1
              FROM registry_audit_log
            """
        ).bindparams(counter_name=AUDIT_SEQ_COUNTER)
    )


def downgrade() -> None:
    op.drop_table("registry_counters")
