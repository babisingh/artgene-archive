"""A function class for design methods.

``FUNCTION_CLASSES`` gains ``method``, widening the CHECK on
``catalogue_records.function_class`` from seven values to eight.

Classifying the first twenty records is what called for it. Two of them,
RFdiffusion and LigandMPNN, are method papers: each produces binders,
scaffolds, sensors and enzymes alike, so naming any one of those would have
been a claim the paper does not make, and both were left unclassified rather
than narrowed. "What it does" for those records is "it makes these things",
which is what ``method`` says.

This is a widening, so every existing row still satisfies the new constraint
and nothing has to be rewritten. The rows that will take the new value are set
by hand afterwards, not here, for the reason 017 gives: a classification is a
person's reading of a paper and does not belong in a migration.

Downgrade narrows the CHECK back to seven values, so it refuses while any row
is classified ``method`` rather than silently failing when the constraint is
applied.

Revision ID: 018
Revises: 017
Create Date: 2026-11-17
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "018"
down_revision: str | None = "017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

BEFORE = ("binder", "enzyme", "sensor", "switch", "shell", "gene", "improver")
AFTER = BEFORE + ("method",)


def _values(allowed: tuple[str, ...]) -> str:
    return ", ".join(f"'{v}'" for v in allowed)


def upgrade() -> None:
    op.drop_constraint("ck_catalogue_function_class", "catalogue_records", type_="check")
    op.create_check_constraint(
        "ck_catalogue_function_class",
        "catalogue_records",
        f"function_class IN ({_values(AFTER)})",
    )


def downgrade() -> None:
    bind = op.get_bind()
    classified = bind.execute(
        sa.text(
            "SELECT count(*) FROM catalogue_records WHERE function_class = 'method'"
        )
    ).scalar_one()
    if classified:
        raise RuntimeError(
            f"Refusing to downgrade: {classified} record(s) are classified "
            "'method', which the narrower CHECK would reject. Reclassify them "
            "deliberately first; leaving them unclassified is the honest "
            "fallback, as it was before 018."
        )

    op.drop_constraint("ck_catalogue_function_class", "catalogue_records", type_="check")
    op.create_check_constraint(
        "ck_catalogue_function_class",
        "catalogue_records",
        f"function_class IN ({_values(BEFORE)})",
    )
