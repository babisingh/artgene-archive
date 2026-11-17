"""What a record does, and what it acts on.

``catalogue_records`` gains two nullable, controlled columns:

* ``function_class`` -- binder, enzyme, sensor, switch, shell, gene, improver.
* ``subject_class`` -- virion, bacterium, receptor, soluble_protein,
  disordered_chain, condensate, hormone_peptide, nucleic_acid_duplex,
  small_molecule, nanoparticle.

Why they exist. Browsing the archive is currently near-impossible to do by
eye: ``molecule_type`` is ``protein`` for eighteen of the first twenty
catalogue records, so the one dimension the list already had says almost
nothing about which record is which. Counting those twenty records, ten are a
binder of some kind and the rest spread across six other functions, and that is
the division a reader can actually use. For the binders, what they act on
divides them again.

Why they are columns rather than something derived. ``design_metadata.
design_target`` holds the same information in prose -- "de novo VHHs ... that
bind user-specified epitopes on targets including Clostridioides difficile
toxin B, influenza haemagglutinin ..." -- which is the right place for it and
useless for grouping. Nothing reliable can be regexed out of forty words of
free text, and a wrong guess shown as a fact is worse than a blank.

Both are nullable, and NULL is a real answer rather than a gap to be filled: a
method paper has no single subject. Existing rows keep NULL. Nothing is
backfilled here, because assigning these is a reading of the paper and belongs
to a person, not to a migration.

The CHECK constraints are of the form ``col IN (...)``, which NULL satisfies,
so nullable and constrained are not in tension.

Downgrade drops both columns. That discards the assignments, so it refuses
while any row carries one, in the manner of 015 and 016: a downgrade that
destroys a person's work silently is not a downgrade.

Revision ID: 017
Revises: 016
Create Date: 2026-11-17
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "017"
down_revision: str | None = "016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

FUNCTION_CLASSES = (
    "binder",
    "enzyme",
    "sensor",
    "switch",
    "shell",
    "gene",
    "improver",
)

SUBJECT_CLASSES = (
    "virion",
    "bacterium",
    "receptor",
    "soluble_protein",
    "disordered_chain",
    "condensate",
    "hormone_peptide",
    "nucleic_acid_duplex",
    "small_molecule",
    "nanoparticle",
)


def _values(allowed: tuple[str, ...]) -> str:
    return ", ".join(f"'{v}'" for v in allowed)


def upgrade() -> None:
    op.add_column(
        "catalogue_records",
        sa.Column(
            "function_class",
            sa.String(length=32),
            nullable=True,
            comment=(
                "What the designed thing does: binder, enzyme, sensor, switch, "
                "shell, gene, improver. Nullable because it is assigned by a "
                "reader, not computed, and a record is useful before anyone has."
            ),
        ),
    )
    op.add_column(
        "catalogue_records",
        sa.Column(
            "subject_class",
            sa.String(length=32),
            nullable=True,
            comment=(
                "What it acts on. NULL is a real answer, not a gap: a method "
                "paper has no single subject."
            ),
        ),
    )
    op.create_check_constraint(
        "ck_catalogue_function_class",
        "catalogue_records",
        f"function_class IN ({_values(FUNCTION_CLASSES)})",
    )
    op.create_check_constraint(
        "ck_catalogue_subject_class",
        "catalogue_records",
        f"subject_class IN ({_values(SUBJECT_CLASSES)})",
    )
    # Browse filters by these, and the list query already filters by
    # visibility, so the pair is what an index has to serve.
    op.create_index(
        "ix_catalogue_function_class",
        "catalogue_records",
        ["visibility", "function_class"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    assigned = bind.execute(
        sa.text(
            "SELECT count(*) FROM catalogue_records "
            "WHERE function_class IS NOT NULL OR subject_class IS NOT NULL"
        )
    ).scalar_one()
    if assigned:
        raise RuntimeError(
            f"Refusing to downgrade: {assigned} record(s) have a function or "
            "subject assigned, and the schema before 017 has nowhere to keep "
            "them. Each one is a person's reading of a paper, not a derived "
            "value that can be recomputed. Clear them deliberately first if "
            "that is really what you want."
        )

    op.drop_index("ix_catalogue_function_class", table_name="catalogue_records")
    op.drop_constraint("ck_catalogue_subject_class", "catalogue_records", type_="check")
    op.drop_constraint("ck_catalogue_function_class", "catalogue_records", type_="check")
    op.drop_column("catalogue_records", "subject_class")
    op.drop_column("catalogue_records", "function_class")
