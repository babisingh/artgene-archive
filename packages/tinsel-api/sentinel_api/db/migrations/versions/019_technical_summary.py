"""A second summary, in the paper's own vocabulary.

``catalogue_records`` gains ``technical_summary``, nullable, beside the
``summary`` it already had.

``summary`` has always been the plain-words one -- its comment since 016 says
"What was designed and why, in plain words" -- and that is the right thing to
lead with for a reader who arrived from outside the field. But a specialist
reading only that is being told less than the archive knows, and writing one
paragraph for both audiences serves neither: it either loses the mechanism or
loses the reader.

So the record page carries both, headed "In the paper's words" and "In plain
words", and this is where the first of those lives. Neither is required: a
record with only one shows only one, and a record with neither shows the
section not at all.

Nullable, no backfill. Writing either summary is editorial work on a specific
paper, which does not belong in a migration.

Revision ID: 019
Revises: 018
Create Date: 2026-11-17
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "019"
down_revision: str | None = "018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "catalogue_records",
        sa.Column(
            "technical_summary",
            sa.Text(),
            nullable=True,
            comment=(
                "The same work in the vocabulary the paper uses, for a reader "
                "who has the background. Sits beside `summary`, which is the "
                "plain words version: the pair exists so that neither audience "
                "is served by watering down what the other one reads."
            ),
        ),
    )


def downgrade() -> None:
    bind = op.get_bind()
    written = bind.execute(
        sa.text(
            "SELECT count(*) FROM catalogue_records "
            "WHERE technical_summary IS NOT NULL"
        )
    ).scalar_one()
    if written:
        raise RuntimeError(
            f"Refusing to downgrade: {written} record(s) carry a technical "
            "summary, which is written prose about a specific paper and "
            "cannot be recovered once dropped. Export them first if this is "
            "really what you want."
        )

    op.drop_column("catalogue_records", "technical_summary")
