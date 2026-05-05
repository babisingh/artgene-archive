"""SQLAlchemy 2.0 ORM models.

Tables
------
organisations          — registered organisations with hashed API credentials
certificates           — issued certificates (one per sequence+owner pair)
registry_audit_log     — tamper-evident hash-chained append-only log
pathways               — multi-gene Merkle pathway bundles
api_keys               — per-organisation API key records
fragment_kmer_index    — SHA3-256 hashes of 20-mer subsequences (assembly risk detection)
sequence_distributions — per-recipient provenance fingerprint issuance records

CRITICAL: registry_audit_log must NEVER be updated or deleted.
          The AppendOnlyMixin enforces this at the ORM layer.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Append-only guard mixin
# ---------------------------------------------------------------------------

class AppendOnlyMixin:
    """Raise RuntimeError if any attribute is mutated after the record is
    marked as committed.  Call ``_mark_committed()`` after the first flush."""

    _committed: bool = False

    def _mark_committed(self) -> None:
        object.__setattr__(self, "_committed", True)

    def __setattr__(self, key: str, value: Any) -> None:
        if key != "_committed" and getattr(self, "_committed", False):
            raise RuntimeError(
                f"{type(self).__name__} is append-only — "
                f"cannot update field '{key}' after commit."
            )
        super().__setattr__(key, value)


# ---------------------------------------------------------------------------
# organisations
# ---------------------------------------------------------------------------

class Organisation(Base):
    __tablename__ = "organisations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    api_key_hash: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="SHA3-256 hex of the raw API key"
    )
    tier: Mapped[str] = mapped_column(String(20), nullable=False, default="standard")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    api_keys: Mapped[list[APIKey]] = relationship(back_populates="organisation")
    certificates: Mapped[list[Certificate]] = relationship(back_populates="organisation")
    pathways: Mapped[list[Pathway]] = relationship(back_populates="organisation")


# ---------------------------------------------------------------------------
# certificates
# ---------------------------------------------------------------------------

class Certificate(Base):
    __tablename__ = "certificates"

    id: Mapped[str] = mapped_column(
        String(20), primary_key=True, comment="AG-YYYY-NNNNNN registry ID"
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organisations.id"), nullable=False
    )
    sequence_hash: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="SHA3-256 hex of original protein"
    )
    owner_id: Mapped[str] = mapped_column(String(255), nullable=False)
    ethics_code: Mapped[str] = mapped_column(String(100), nullable=False)
    sequence_type: Mapped[str] = mapped_column(String(10), nullable=False)
    host_organism: Mapped[str] = mapped_column(String(20), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    watermark_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    wots_public_key: Mapped[dict] = mapped_column(JSONB, nullable=False)
    wots_signature: Mapped[dict] = mapped_column(JSONB, nullable=False)
    lwe_commitment: Mapped[dict] = mapped_column(JSONB, nullable=False)
    merkle_proof: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    pathway_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    consequence_report: Mapped[dict] = mapped_column(JSONB, nullable=False)
    certificate_hash: Mapped[str] = mapped_column(
        String(128), nullable=False, comment="SHA3-512 hex"
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    chi_squared: Mapped[float | None] = mapped_column(Float, nullable=True)
    tier: Mapped[str] = mapped_column(String(20), nullable=False)
    visibility: Mapped[str] = mapped_column(
        String(20), nullable=False, default="public",
        comment='"public" = visible to any org query; "embargoed" = owner-only until published'
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    organisation: Mapped[Organisation] = relationship(back_populates="certificates")


# ---------------------------------------------------------------------------
# registry_audit_log  (hash-chained append-only log)
# ---------------------------------------------------------------------------

class RegistryAuditLog(AppendOnlyMixin, Base):
    """Tamper-evident, append-only audit log.

    Each entry hashes the previous entry's hash, forming a chain.
    The first entry uses ``prev_hash_hex = "0" * 64``.

    CRITICAL: No UPDATE or DELETE operations must ever be issued
    against this table.  The AppendOnlyMixin enforces this at the
    ORM layer; database-level triggers should be added in production.
    """

    __tablename__ = "registry_audit_log"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    seq_num: Mapped[int] = mapped_column(BigInteger, nullable=False, unique=True)
    prev_hash_hex: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="SHA3-256 of previous entry"
    )
    certificate_hash: Mapped[str] = mapped_column(
        String(128), nullable=False, comment="SHA3-512 of the certificate being logged"
    )
    entry_hash_hex: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="SHA3-256(seq_num||prev_hash||cert_hash)"
    )
    registry_id: Mapped[str] = mapped_column(String(20), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("registry_id", name="uq_audit_registry_id"),
    )


# ---------------------------------------------------------------------------
# pathways
# ---------------------------------------------------------------------------

class Pathway(Base):
    __tablename__ = "pathways"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organisations.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    gene_count: Mapped[int] = mapped_column(Integer, nullable=False)
    merkle_root: Mapped[str] = mapped_column(String(64), nullable=False)
    certificate_ids: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list, comment="Array of registry IDs"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    organisation: Mapped[Organisation] = relationship(back_populates="pathways")


# ---------------------------------------------------------------------------
# api_keys
# ---------------------------------------------------------------------------

class APIKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organisations.id"), nullable=False
    )
    key_prefix: Mapped[str] = mapped_column(
        String(8), nullable=False, comment="First 8 chars of raw key (non-secret)"
    )
    key_hash: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="SHA3-256 hex of the full raw key"
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    organisation: Mapped[Organisation] = relationship(back_populates="api_keys")


# ---------------------------------------------------------------------------
# fragment_kmer_index  (privacy-preserving overlap detection)
# ---------------------------------------------------------------------------

class FragmentKmerIndex(Base):
    """SHA3-256 hashes of 20-mer subsequences from registered sequences.

    Enables cross-time, cross-session fragment assembly risk detection:
    when a new sequence is submitted for registration its k-mers are
    checked against this index.  Raw k-mer sequences are never stored —
    only their hashes — so this table cannot be used to reconstruct any
    registered sequence.

    Only sequences ≤ 1,500 AA/nt are indexed (longer sequences are
    screened directly rather than as synthesisable fragments).
    """

    __tablename__ = "fragment_kmer_index"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    registry_id: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="Certificate registry ID that owns this k-mer"
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    kmer_hash: Mapped[str] = mapped_column(
        String(64), nullable=False,
        comment="SHA3-256 hex of the 20-mer (raw k-mer is never stored)"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# ---------------------------------------------------------------------------
# sequence_distributions
# ---------------------------------------------------------------------------

class SequenceDistribution(Base):
    """Per-recipient provenance fingerprint issuance records.

    Each row represents a distribution copy issued to one recipient.
    The fingerprint_seed (stored as hex) is used to both generate the
    recipient-specific codon pattern and to verify a leaked copy later.
    The full fingerprinted FASTA is never stored — only the seed needed
    to re-derive it.
    """

    __tablename__ = "sequence_distributions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sequence_id: Mapped[str] = mapped_column(
        String(20), ForeignKey("certificates.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    recipient_name: Mapped[str] = mapped_column(String(255), nullable=False)
    recipient_org: Mapped[str] = mapped_column(String(255), nullable=False)
    recipient_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    purpose: Mapped[str] = mapped_column(
        String(64), nullable=False, default="other",
        comment="cmo | collaboration | validation | other"
    )
    fingerprint_id: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True,
        comment="Stable label used as part of the HMAC key derivation"
    )
    fingerprint_seed_hex: Mapped[str] = mapped_column(
        String(64), nullable=False,
        comment="Hex-encoded HMAC seed used to generate and verify this copy"
    )
    host_organism: Mapped[str] = mapped_column(String(32), nullable=False, default="ECOLI")
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
