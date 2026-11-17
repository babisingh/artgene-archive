"""A line for a list.

``catalogue_records`` gains ``subtitle``, nullable: one or two lines saying
what the work is.

The browse page needs a sentence under each title. Neither existing field
serves: ``summary`` is a plain-words explainer of several paragraphs and
``technical_summary`` is denser still, and the opening sentence of either,
clamped to two lines, reads as a paragraph cut off mid-thought rather than as
a description.

So this is written for that job. The twenty backfill drafts already carry
exactly such a line -- "A University of Washington team fine-tuned RFdiffusion
to generate antibodies that bind user-specified epitopes, with cryo-electron
microscopy confirming the designed loops" -- which is where the first twenty
values come from.

Nullable, no backfill: a record without one shows its title and its facts,
which is what the list did before.

Revision ID: 020
Revises: 019
Create Date: 2026-11-17
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "020"
down_revision: str | None = "019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "catalogue_records",
        sa.Column(
            "subtitle",
            sa.Text(),
            nullable=True,
            comment=(
                "One or two lines saying what the work is, for a list where "
                "the title alone is too terse and either summary is far too "
                "long. Written for that job rather than cut from a longer "
                "paragraph, because the opening sentence of an explainer "
                "rarely survives on its own."
            ),
        ),
    )


def downgrade() -> None:
    bind = op.get_bind()
    written = bind.execute(
        sa.text("SELECT count(*) FROM catalogue_records WHERE subtitle IS NOT NULL")
    ).scalar_one()
    if written:
        raise RuntimeError(
            f"Refusing to downgrade: {written} record(s) carry a subtitle, "
            "which is written prose and cannot be recovered once dropped."
        )

    op.drop_column("catalogue_records", "subtitle")
