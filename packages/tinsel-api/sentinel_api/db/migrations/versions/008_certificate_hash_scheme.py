"""Record which canonicalisation produced each certificate_hash.

HybridCertificate.compute_hash originally joined the field values with no
delimiter and no keys, so field boundaries were ambiguous: {"owner_id": "ab",
"ethics_code": "c"} and {"owner_id": "a", "ethics_code": "bc"} both hashed
"abc". The digest also depended on dict insertion order. The replacement
serialises the fields as JSON with sorted keys, prefixed by a scheme
identifier.

That changes the digest for the same inputs, so the scheme has to be stored
alongside it or an old certificate becomes unverifiable. Any row written before
this migration was produced by the old scheme, so existing rows are backfilled
with 'concat-v1' rather than with the new default.

Revision ID: 008
Revises: 007
Create Date: 2026-11-12 00:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "008"
down_revision: str | None = "007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_V1 = "concat-v1"
_V2 = "artgene-cert-sha3-512-v2"


def upgrade() -> None:
    # Added nullable so the backfill can distinguish "not set yet" from a real
    # value, then tightened once every row has one.
    op.add_column(
        "certificates",
        sa.Column("hash_scheme", sa.String(40), nullable=True),
    )
    op.execute(
        sa.text(
            "UPDATE certificates SET hash_scheme = :scheme WHERE hash_scheme IS NULL"
        ).bindparams(scheme=_V1)
    )
    op.alter_column(
        "certificates",
        "hash_scheme",
        nullable=False,
        server_default=sa.text(f"'{_V2}'"),
    )


def downgrade() -> None:
    op.drop_column("certificates", "hash_scheme")
