"""Direct submissions: AG- records deposited through the submission form or API.

The archive now accepts unpublished sequences from their authors as well as
cataloguing published ones. A submission is screened by the same gates as
every other sequence, then enters the same review and publication workflow as
a catalogue record, so it lives in ``catalogue_records`` alongside them.

What changes:

* ``records`` gains a third class, ``submission``. It shares the AG- prefix
  with ``certificate``, because both are deposits the archive holds directly,
  while AGC- stays reserved for citations of work published elsewhere. The
  prefix-to-class CHECK keeps a bare accession honest about which claim it is.
* ``catalogue_records`` accepts AG- ids as well as AGC-, and gains ``summary``.
* ``fragment_kmer_index.org_id`` becomes nullable: a direct submission belongs
  to no organisation, yet must still be indexed, or nothing submitted would
  ever be cross-checked for fragment assembly against what came later.
* ``submissions`` holds the submitter's contact details and what screening said
  at the time. ``notifications`` is the outbox: the archive drafts a letter, a
  person reads it and sends it from their own mail client. Nothing here can
  send a message (tests/test_no_send_path.py).

Downgrade refuses rather than deletes when submissions exist, for the same
reason 015 does: discovering a premise was wrong by deleting the evidence is
not acceptable.

Revision ID: 016
Revises: 015
Create Date: 2026-11-13
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "016"
down_revision: str | None = "015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # A third record class, sharing AG- with certificates.
    op.drop_constraint("ck_records_class", "records", type_="check")
    op.create_check_constraint(
        "ck_records_class",
        "records",
        "record_class IN ('certificate', 'catalogue', 'submission')",
    )
    op.drop_constraint("ck_records_prefix_matches_class", "records", type_="check")
    op.create_check_constraint(
        "ck_records_prefix_matches_class",
        "records",
        "(record_class IN ('certificate', 'submission') AND id LIKE 'AG-%') OR "
        "(record_class = 'catalogue' AND id LIKE 'AGC-%')",
    )

    # Submissions share the catalogue's review and publication workflow.
    op.drop_constraint("ck_catalogue_id_prefix", "catalogue_records", type_="check")
    op.create_check_constraint(
        "ck_catalogue_id_prefix",
        "catalogue_records",
        "id LIKE 'AGC-%' OR id LIKE 'AG-%'",
    )
    op.add_column(
        "catalogue_records",
        sa.Column(
            "summary",
            sa.Text(),
            nullable=True,
            comment=(
                "What was designed and why, in plain words. Written by the "
                "submitter for AG-, paraphrased by an editor for AGC-: never "
                "copied from an abstract."
            ),
        ),
    )

    # A direct submission belongs to no organisation, but is still indexed.
    op.alter_column(
        "fragment_kmer_index",
        "org_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
        comment="None for a direct submission, which belongs to no organisation",
    )

    op.create_table(
        "submissions",
        sa.Column("record_id", sa.String(20), sa.ForeignKey("records.id"), primary_key=True),
        sa.Column("submitter_name", sa.String(200), nullable=False),
        sa.Column("submitter_email", sa.String(320), nullable=False),
        sa.Column("submitter_affiliation", sa.String(300), nullable=True),
        sa.Column("submitter_orcid", sa.String(19), nullable=True),
        sa.Column("screen_mode", sa.String(16), nullable=False),
        sa.Column("screening_outcome", sa.String(24), nullable=False),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "screening_outcome IN ('passed', 'passed_with_notes', 'withheld')",
            name="ck_submission_outcome",
        ),
    )

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("record_id", sa.String(20), sa.ForeignKey("records.id"), nullable=False),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("recipient_name", sa.String(200), nullable=True),
        sa.Column("recipient_email", sa.String(320), nullable=False),
        sa.Column("subject", sa.String(300), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.CheckConstraint("kind IN ('screening_withheld')", name="ck_notification_kind"),
        sa.CheckConstraint(
            "status IN ('drafted', 'sent', 'suppressed', 'discarded')",
            name="ck_notification_status",
        ),
    )
    op.create_index("ix_notifications_status", "notifications", ["status"])


def downgrade() -> None:
    bind = op.get_bind()
    submissions = bind.execute(
        sa.text("SELECT count(*) FROM records WHERE record_class = 'submission'")
    ).scalar_one()
    if submissions:
        raise RuntimeError(
            f"Refusing to downgrade: {submissions} submission record(s) exist, and "
            "the schema before 016 has nowhere to keep them. Decide where they "
            "belong before downgrading."
        )
    unowned = bind.execute(
        sa.text("SELECT count(*) FROM fragment_kmer_index WHERE org_id IS NULL")
    ).scalar_one()
    if unowned:
        raise RuntimeError(
            f"Refusing to downgrade: {unowned} k-mer index row(s) belong to no "
            "organisation, and the schema before 016 requires one."
        )

    op.drop_index("ix_notifications_status", table_name="notifications")
    op.drop_table("notifications")
    op.drop_table("submissions")
    op.alter_column(
        "fragment_kmer_index",
        "org_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
        comment=None,
    )
    op.drop_column("catalogue_records", "summary")
    op.drop_constraint("ck_catalogue_id_prefix", "catalogue_records", type_="check")
    op.create_check_constraint("ck_catalogue_id_prefix", "catalogue_records", "id LIKE 'AGC-%'")
    op.drop_constraint("ck_records_prefix_matches_class", "records", type_="check")
    op.create_check_constraint(
        "ck_records_prefix_matches_class",
        "records",
        "(record_class = 'certificate' AND id LIKE 'AG-%') OR "
        "(record_class = 'catalogue' AND id LIKE 'AGC-%')",
    )
    op.drop_constraint("ck_records_class", "records", type_="check")
    op.create_check_constraint(
        "ck_records_class", "records", "record_class IN ('certificate', 'catalogue')"
    )
