"""Add visibility field to certificates for private/embargoed registration.

Certificates default to "public" (existing behaviour).  Submitters can
set visibility="embargoed" to prevent the sequence from appearing in
list/search results for other organisations until they explicitly publish it.

Revision ID: 004
Revises: 003
Create Date: 2026-04-16 00:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: str | None = "003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "certificates",
        sa.Column(
            "visibility",
            sa.String(20),
            nullable=False,
            server_default="public",
            comment='"public" | "embargoed"',
        ),
    )
    # Index speeds up list queries that filter on visibility
    op.create_index(
        "ix_certificates_visibility",
        "certificates",
        ["visibility"],
    )


def downgrade() -> None:
    op.drop_index("ix_certificates_visibility", table_name="certificates")
    op.drop_column("certificates", "visibility")
