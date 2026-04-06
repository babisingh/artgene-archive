"""Initial schema — five core tables.

Revision ID: 001
Revises:
Create Date: 2027-01-01 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── organisations ──────────────────────────────────────────────────────
    op.create_table(
        "organisations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "api_key_hash",
            sa.String(64),
            nullable=False,
            comment="SHA3-256 hex of the raw API key",
        ),
        sa.Column("tier", sa.String(20), nullable=False, server_default="standard"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # ── certificates ───────────────────────────────────────────────────────
    op.create_table(
        "certificates",
        sa.Column(
            "id",
            sa.String(20),
            nullable=False,
            comment="AG-YYYY-NNNNNN registry ID",
        ),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "sequence_hash",
            sa.String(64),
            nullable=False,
            comment="SHA3-256 hex of original protein",
        ),
        sa.Column("owner_id", sa.String(255), nullable=False),
        sa.Column("ethics_code", sa.String(100), nullable=False),
        sa.Column("sequence_type", sa.String(10), nullable=False),
        sa.Column("host_organism", sa.String(20), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("watermark_metadata", postgresql.JSONB, nullable=True),
        sa.Column("wots_public_key", postgresql.JSONB, nullable=False),
        sa.Column("wots_signature", postgresql.JSONB, nullable=False),
        sa.Column("lwe_commitment", postgresql.JSONB, nullable=False),
        sa.Column("merkle_proof", postgresql.JSONB, nullable=True),
        sa.Column("pathway_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("consequence_report", postgresql.JSONB, nullable=False),
        sa.Column(
            "certificate_hash",
            sa.String(128),
            nullable=False,
            comment="SHA3-512 hex",
        ),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("chi_squared", sa.Float, nullable=True),
        sa.Column("tier", sa.String(20), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organisations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_certificates_org_id", "certificates", ["org_id"])
    op.create_index(
        "ix_certificates_sequence_hash", "certificates", ["sequence_hash"]
    )

    # ── registry_audit_log  (append-only) ─────────────────────────────────
    op.create_table(
        "registry_audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("seq_num", sa.BigInteger, nullable=False),
        sa.Column(
            "prev_hash_hex",
            sa.String(64),
            nullable=False,
            comment="SHA3-256 of previous entry",
        ),
        sa.Column(
            "certificate_hash",
            sa.String(128),
            nullable=False,
            comment="SHA3-512 of the certificate being logged",
        ),
        sa.Column(
            "entry_hash_hex",
            sa.String(64),
            nullable=False,
            comment="SHA3-256(seq_num||prev_hash||cert_hash)",
        ),
        sa.Column("registry_id", sa.String(20), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("seq_num", name="uq_audit_seq_num"),
        sa.UniqueConstraint("registry_id", name="uq_audit_registry_id"),
    )
    # CRITICAL: Do NOT add UPDATE or DELETE permissions on this table in prod.

    # ── pathways ───────────────────────────────────────────────────────────
    op.create_table(
        "pathways",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("gene_count", sa.Integer, nullable=False),
        sa.Column("merkle_root", sa.String(64), nullable=False),
        sa.Column(
            "certificate_ids",
            postgresql.JSONB,
            nullable=False,
            comment="Array of registry IDs",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organisations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── api_keys ───────────────────────────────────────────────────────────
    op.create_table(
        "api_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "key_prefix",
            sa.String(8),
            nullable=False,
            comment="First 8 chars of raw key (non-secret)",
        ),
        sa.Column(
            "key_hash",
            sa.String(64),
            nullable=False,
            comment="SHA3-256 hex of the full raw key",
        ),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["organisations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_api_keys_key_hash", "api_keys", ["key_hash"])


def downgrade() -> None:
    op.drop_table("api_keys")
    op.drop_table("pathways")
    op.drop_table("registry_audit_log")
    op.drop_table("certificates")
    op.drop_table("organisations")
