"""Drop the orphaned `sequences` table from migration 002.

Migration 002 created it as a general CRUD store for the API. Nothing has used
it since: there is no SQLAlchemy model mapped to it, no query references it,
and no route reads or writes it. Sequence data lives in `certificates`
(`watermark_metadata`) and, for catalogue records, in `sequence_blobs` behind
the licence trigger.

An empty table nobody reads is not harmless in this particular schema. The
archive's charter promise is that sequence data is held under a recorded
licence decision, and `sequence_blobs` enforces that with a trigger. A second,
unguarded table with a `sequence` column is a place where that rule does not
apply, and the longer it exists the more likely something writes to it.

Dropped rather than left in place on Babita's instruction, 2026-11-12.

Safety: this is checked at runtime rather than assumed. The upgrade refuses to
drop a table that holds rows, because a non-empty table would mean the premise
of this migration is wrong, and discovering that by deleting the evidence is
not acceptable. On a database where something did start writing here, the
migration fails loudly and the row count is the thing to look at.

The downgrade recreates the table exactly as 002 defined it, so a downgrade to
any revision at or below 002 still finds what it expects to drop. It cannot
restore rows, and `sequences` carries no foreign keys in either direction, so
nothing else in the schema depends on it.

Revision ID: 015
Revises: 014
Create Date: 2026-11-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "015"
down_revision: str | None = "014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "sequences" not in inspector.get_table_names():
        # Already gone, or a database built from metadata rather than from the
        # migration chain. Nothing to do.
        return

    count = bind.execute(sa.text("SELECT count(*) FROM sequences")).scalar_one()
    if count:
        raise RuntimeError(
            f"Refusing to drop `sequences`: it holds {count} row(s). This "
            "migration assumes the table is unused, and a non-empty table "
            "means that assumption is wrong. Inspect the rows and decide "
            "where they belong before running this again."
        )

    op.drop_table("sequences")


def downgrade() -> None:
    op.create_table(
        "sequences",
        sa.Column("id", sa.String(255), nullable=False),
        sa.Column("sequence", sa.Text, nullable=False),
        sa.Column("seq_type", sa.String(10), nullable=False),
        sa.Column("description", sa.String(1000), nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
