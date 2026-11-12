"""Licence enquiries: ask the authors instead of closing the question.

An unstated licence is the commonest case on a preprint and the most wasteful:
the data may well be shareable and nobody has been asked. This adds the queue
that turns `UNSTATED` into a question, and the suppression list that makes "no"
permanent.

Also adds two columns the Phase 2 schema should have carried.
`license_resolution` records how the archive knows what it knows, kept
deliberately separate from `hosting_decision`, which records what the archive
does about it. `citation_only` is how an objection is honoured: the record
keeps its title, authors, DOI and link, and sheds everything else, so declining
costs the authors no credit and costs the index no coverage.

Existing rows are backfilled from the licence actually recorded on their
source, not with a blanket default, so a record whose data licence is already
permissive is not misreported as unstated.

Revision ID: 013
Revises: 012
Create Date: 2026-11-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "013"
down_revision: str | None = "012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ENQUIRY_REASONS = ("unstated", "ambiguous", "conflicting", "no_data_deposited")
ENQUIRY_STATUSES = (
    "queued", "drafted", "sent", "reminded", "replied", "no_response", "closed",
)
LICENSE_RESOLUTIONS = (
    "stated_permissive", "stated_restrictive", "unstated", "ambiguous",
    "author_confirmed", "author_declined",
)
DO_NOT_CONTACT_REASONS = ("declined", "requested", "bounced", "other")


def _in_list(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{v}'" for v in values)


def upgrade() -> None:
    # ── two columns Phase 2 should have carried ───────────────────────────
    op.add_column(
        "catalogue_records",
        sa.Column("license_resolution", sa.String(32), nullable=True),
    )
    op.add_column(
        "catalogue_records",
        sa.Column(
            "citation_only",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    # Backfill from the licence on the source rather than defaulting, so an
    # already-permissive record is not misreported.
    op.execute(
        """
        UPDATE catalogue_records cr
           SET license_resolution = CASE
                 WHEN l.spdx_id IS NULL OR l.spdx_id = 'UNSTATED' THEN 'unstated'
                 WHEN l.allows_redistribution THEN 'stated_permissive'
                 ELSE 'stated_restrictive'
               END
          FROM sources s
          LEFT JOIN licenses l ON l.spdx_id = s.data_license
         WHERE s.id = cr.source_id
        """
    )
    op.execute(
        "UPDATE catalogue_records SET license_resolution = 'unstated' "
        "WHERE license_resolution IS NULL"
    )
    op.alter_column("catalogue_records", "license_resolution", nullable=False)
    op.create_check_constraint(
        "ck_catalogue_license_resolution",
        "catalogue_records",
        f"license_resolution IN ({_in_list(LICENSE_RESOLUTIONS)})",
    )

    # ── the enquiry queue ─────────────────────────────────────────────────
    # One row per publication, not per record: a paper with forty designed
    # sequences gets one letter, and the uniqueness constraint is what
    # guarantees that rather than a check in ingest code.
    op.create_table(
        "license_enquiries",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("source_id", sa.UUID(), nullable=False),
        sa.Column("reason", sa.String(32), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("contact_name", sa.String(255), nullable=True),
        sa.Column("contact_orcid", sa.String(32), nullable=True),
        sa.Column(
            "contact_email",
            sa.String(255),
            nullable=True,
            comment="Purged when the enquiry closes",
        ),
        sa.Column(
            "detected_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reminded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("replied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("response_license", sa.String(64), nullable=True),
        sa.Column("response_note", sa.Text(), nullable=True),
        sa.Column(
            "response_evidence",
            sa.Text(),
            nullable=True,
            comment="How we know, e.g. 'email of 2026-11-20, quoted verbatim'",
        ),
        sa.Column("opt_in", sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"]),
        sa.ForeignKeyConstraint(["response_license"], ["licenses.spdx_id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_id", name="uq_enquiry_per_source"),
        sa.CheckConstraint(
            f"reason IN ({_in_list(ENQUIRY_REASONS)})", name="ck_enquiry_reason"
        ),
        sa.CheckConstraint(
            f"status IN ({_in_list(ENQUIRY_STATUSES)})", name="ck_enquiry_status"
        ),
    )

    # ── the suppression list ──────────────────────────────────────────────
    # Outlives both record withdrawal and the purging of an enquiry's address.
    # A suppression list that disappears with the data it suppresses is not one.
    op.create_table(
        "do_not_contact",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("orcid", sa.String(32), nullable=True),
        sa.Column("email_hmac", sa.String(64), nullable=True),
        sa.Column("reason", sa.String(32), nullable=False),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("orcid"),
        sa.UniqueConstraint("email_hmac"),
        sa.CheckConstraint(
            f"reason IN ({_in_list(DO_NOT_CONTACT_REASONS)})", name="ck_dnc_reason"
        ),
    )


def downgrade() -> None:
    op.drop_table("do_not_contact")
    op.drop_table("license_enquiries")
    op.drop_constraint(
        "ck_catalogue_license_resolution", "catalogue_records", type_="check"
    )
    op.drop_column("catalogue_records", "citation_only")
    op.drop_column("catalogue_records", "license_resolution")
