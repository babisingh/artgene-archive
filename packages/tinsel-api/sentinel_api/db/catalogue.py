"""ORM models for the catalogue: third-party published work, with attribution.

The archive holds two kinds of record and never conflates them. An ``AG-``
certificate asserts that a depositor registered a sequence they made, accepted
an ethics declaration, passed the biosafety gates, and the registry signed the
result. An ``AGC-`` catalogue record asserts only that a published paper
reported AI generated sequences which were built and tested, and that the
archive read it and recorded what it found. The archive signs nothing on the
authors' behalf and claims no provenance over their work.

``records`` is the shared accession namespace, so the satellites below carry one
foreign key instead of one nullable key per record class. ``certificates`` joins
the same namespace in migration 010.

List-valued columns use JSONB rather than PostgreSQL arrays. The test suite runs
on SQLite with a JSONB-to-JSON compiler patch and has no array equivalent, and
JSONB containment queries cover the one real query ("which records used this
assay"). See tests/conftest.py.

Design notes live in ARCHITECTURE.md sections 4, 5 and 8.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from sentinel_api.db.models import Base

# ---------------------------------------------------------------------------
# Controlled vocabularies
#
# Held as CHECK constraints rather than as prose, so a typo in an ingest script
# is a failed insert instead of a row nobody can query. Widening one is a
# migration, which is the right amount of friction for a registry.
# ---------------------------------------------------------------------------

RECORD_CLASSES = ("certificate", "catalogue")
MOLECULE_TYPES = ("protein", "dna", "rna", "genome", "regulatory_element", "grna_scaffold")
CATALOGUE_STATUSES = ("draft", "staged", "reviewed", "published", "restricted", "withdrawn")
VISIBILITIES = ("private", "public")
HOSTING_DECISIONS = ("hosted", "metadata_only", "withheld")
BIOSAFETY_CLASSES = ("none", "elevated", "restricted")
GATE_FAMILIES = ("editorial", "biosafety", "license", "attribution", "integrity")
GATE_OUTCOMES = ("pass", "fail", "warn", "skip", "advisory")
TAKEDOWN_KINDS = ("license", "privacy", "biosafety", "accuracy", "other")
#: How the archive knows what it knows about a licence. Deliberately distinct
#: from hosting_decision, which is what the archive does about it. Only
#: `unstated` and `ambiguous` are enquiry candidates: a licence that explicitly
#: forbids redistribution is settled, and the authors have already answered.
LICENSE_RESOLUTIONS = (
    "stated_permissive",
    "stated_restrictive",
    "unstated",
    "ambiguous",
    "author_confirmed",
    "author_declined",
)
ACCESSION_DATABASES = (
    "pdb", "genbank", "uniprot", "ena",
    "zenodo", "figshare", "supplementary", "other",
)


def _in(column: str, allowed: tuple[str, ...], name: str) -> CheckConstraint:
    """Build a CHECK that *column* is one of *allowed*."""
    values = ", ".join(f"'{v}'" for v in allowed)
    return CheckConstraint(f"{column} IN ({values})", name=name)


# ---------------------------------------------------------------------------
# records: the shared accession namespace
# ---------------------------------------------------------------------------

class Record(Base):
    """One row per accession, of either class.

    The prefix is tied to the class by a CHECK, so a citation of a bare id
    always says which kind of claim it is. ``AGC-2026-000001`` does not match
    ``AG-%`` because the third character is ``C`` rather than ``-``, so the two
    branches are genuinely exclusive.
    """

    __tablename__ = "records"

    id: Mapped[str] = mapped_column(
        String(20), primary_key=True, comment="AG-YYYY-NNNNNN or AGC-YYYY-NNNNNN"
    )
    record_class: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        _in("record_class", RECORD_CLASSES, "ck_records_class"),
        CheckConstraint(
            "(record_class = 'certificate' AND id LIKE 'AG-%') OR "
            "(record_class = 'catalogue' AND id LIKE 'AGC-%')",
            name="ck_records_prefix_matches_class",
        ),
    )


# ---------------------------------------------------------------------------
# licenses: SPDX vocabulary, with the redistribution decision as data
# ---------------------------------------------------------------------------

class License(Base):
    """A license and what it permits.

    ``UNSTATED`` is a first-class row with ``allows_redistribution = False``.
    An unstated license is not a permissive one, and encoding that here rather
    than in application code is what lets the database refuse to store data it
    has no permission for. See the trigger in migration 010.
    """

    __tablename__ = "licenses"

    spdx_id: Mapped[str] = mapped_column(
        String(64), primary_key=True, comment="SPDX identifier, or UNSTATED / PROPRIETARY"
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    allows_redistribution: Mapped[bool] = mapped_column(Boolean, nullable=False)
    allows_derivatives: Mapped[bool] = mapped_column(Boolean, nullable=False)
    allows_commercial: Mapped[bool] = mapped_column(Boolean, nullable=False)
    requires_attribution: Mapped[bool] = mapped_column(Boolean, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


# ---------------------------------------------------------------------------
# sources: one row per publication
# ---------------------------------------------------------------------------

class Source(Base):
    """A publication the archive read.

    ``content_sha3_256`` records a hash of what was actually read. Preprints get
    revised, so without it a record could silently come to disagree with its
    source and nobody would be able to tell which version was summarised.

    The article license and the data license are separate columns because they
    are frequently different and the data one is frequently absent. A CC-BY-NC-ND
    article with no stated license for its sequences is the common case.
    """

    __tablename__ = "sources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doi: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True, comment="Canonical key when the work has one"
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    container: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="Journal or preprint server"
    )
    published_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    peer_reviewed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    version: Mapped[str | None] = mapped_column(
        String(32), nullable=True, comment="'v1' for a preprint"
    )
    url: Mapped[str] = mapped_column(String(1024), nullable=False)
    article_license: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("licenses.spdx_id"), nullable=True
    )
    data_license: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("licenses.spdx_id"), nullable=True
    )
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    retrieved_from: Mapped[str] = mapped_column(
        String(1024), nullable=False, comment="The exact URL read"
    )
    content_sha3_256: Mapped[str | None] = mapped_column(String(64), nullable=True)

    authors: Mapped[list[SourceAuthor]] = relationship(
        back_populates="source", cascade="all, delete-orphan", order_by="SourceAuthor.position"
    )


class SourceAuthor(Base):
    """An author, in order, because author position carries meaning.

    Personal data: held under the legitimate interest in scholarly attribution,
    minimised to what a citation needs. ARCHITECTURE.md section 8.
    """

    __tablename__ = "source_authors"

    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sources.id", ondelete="CASCADE"), primary_key=True
    )
    position: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    orcid: Mapped[str | None] = mapped_column(String(32), nullable=True)
    affiliation: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_corresponding: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    source: Mapped[Source] = relationship(back_populates="authors")


# ---------------------------------------------------------------------------
# ingest_runs: provenance of the catalogue itself
# ---------------------------------------------------------------------------

class IngestRun(Base):
    """One row per agent run, so a record can say which run produced it.

    ``instructions_sha3_256`` pins the agent instructions in force at the time.
    A catalogue is only as trustworthy as the procedure that built it, and that
    procedure is a file that changes.
    """

    __tablename__ = "ingest_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent: Mapped[str] = mapped_column(String(64), nullable=False, comment="e.g. 'genome-watch'")
    instructions_sha3_256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    candidates_seen: Mapped[int | None] = mapped_column(Integer, nullable=True)
    records_created: Mapped[int | None] = mapped_column(Integer, nullable=True)
    log_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)


# ---------------------------------------------------------------------------
# catalogue_records
# ---------------------------------------------------------------------------

class CatalogueRecord(Base):
    """A record of someone else's published work.

    ``hosting_decision`` is what the archive does; the reason is stored beside it
    in words, so the decision is explicable later without re-deriving it.
    ``biosafety_class`` is advisory for this record class: a sequence that fails
    screening yields ``restricted``, keeping the citation and withholding the
    data. An archive that silently omitted the results most relevant to
    biosecurity would make absent coverage look like absent risk.
    """

    __tablename__ = "catalogue_records"

    id: Mapped[str] = mapped_column(String(20), ForeignKey("records.id"), primary_key=True)
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sources.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    molecule_type: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    visibility: Mapped[str] = mapped_column(String(20), nullable=False, default="private")
    hosting_decision: Mapped[str] = mapped_column(String(20), nullable=False)
    hosting_reason: Mapped[str] = mapped_column(Text, nullable=False)
    biosafety_class: Mapped[str] = mapped_column(String(20), nullable=False, default="none")
    license_resolution: Mapped[str] = mapped_column(
        String(32), nullable=False, default="unstated"
    )
    citation_only: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment=(
            "Set when authors object. The record keeps title, authors, DOI and "
            "link, and sheds everything else, so declining costs them no credit "
            "and costs the index no coverage."
        ),
    )
    ingest_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ingest_runs.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    source: Mapped[Source] = relationship()

    __table_args__ = (
        _in("molecule_type", MOLECULE_TYPES, "ck_catalogue_molecule_type"),
        _in("status", CATALOGUE_STATUSES, "ck_catalogue_status"),
        _in("visibility", VISIBILITIES, "ck_catalogue_visibility"),
        _in("hosting_decision", HOSTING_DECISIONS, "ck_catalogue_hosting_decision"),
        _in("biosafety_class", BIOSAFETY_CLASSES, "ck_catalogue_biosafety_class"),
        _in("license_resolution", LICENSE_RESOLUTIONS, "ck_catalogue_license_resolution"),
        CheckConstraint("id LIKE 'AGC-%'", name="ck_catalogue_id_prefix"),
    )


# ---------------------------------------------------------------------------
# Satellites, shared by both record classes
# ---------------------------------------------------------------------------

class DesignMetadata(Base):
    """How the sequences were generated and what the authors measured.

    Keyed on records.id so a first-party certificate can carry it too. These are
    the fields the deposit form has always collected and discarded.
    """

    __tablename__ = "design_metadata"

    record_id: Mapped[str] = mapped_column(String(20), ForeignKey("records.id"), primary_key=True)
    generating_model: Mapped[str] = mapped_column(String(255), nullable=False)
    model_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model_availability: Mapped[str | None] = mapped_column(
        String(32), nullable=True, comment="open | api | closed | not stated"
    )
    design_method: Mapped[str | None] = mapped_column(Text, nullable=True)
    design_target: Mapped[str | None] = mapped_column(Text, nullable=True)
    n_designed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    n_tested: Mapped[int | None] = mapped_column(Integer, nullable=True)
    n_functional: Mapped[int | None] = mapped_column(Integer, nullable=True)
    assays: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)
    expression_host: Mapped[str | None] = mapped_column(String(64), nullable=True)
    wet_lab_validated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class ExternalAccession(Base):
    """Where the authors put their data.

    The cheapest field with the highest value: a record can be complete and
    useful with no hosted sequence at all, which is the common case.
    """

    __tablename__ = "external_accessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    record_id: Mapped[str] = mapped_column(String(20), ForeignKey("records.id"), nullable=False)
    database: Mapped[str] = mapped_column(String(32), nullable=False)
    accession: Mapped[str] = mapped_column(String(128), nullable=False)
    url: Mapped[str] = mapped_column(String(1024), nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolves: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    __table_args__ = (
        UniqueConstraint("record_id", "database", "accession", name="uq_accession_per_record"),
        _in("database", ACCESSION_DATABASES, "ck_accession_database"),
    )


class SequenceBlob(Base):
    """Sequence data, present only when its license permits redistribution.

    ``data`` is NULL for a metadata-only record, and the length and digest are
    still recorded so the record remains citable and verifiable against the
    source repository. ``stored_because`` holds the permission in words, for
    example naming the enquiry in which an author confirmed a license.

    The license gate is a database trigger, installed by migration 010, not a
    check in application code: no future code path can store data the license
    does not cover.
    """

    __tablename__ = "sequence_blobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    record_id: Mapped[str] = mapped_column(String(20), ForeignKey("records.id"), nullable=False)
    accession_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("external_accessions.id"), nullable=True
    )
    molecule_type: Mapped[str] = mapped_column(String(32), nullable=False)
    length: Mapped[int] = mapped_column(Integer, nullable=False)
    sha3_256: Mapped[str] = mapped_column(String(64), nullable=False)
    data: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="NULL for a metadata-only record"
    )
    license_spdx: Mapped[str] = mapped_column(
        String(64), ForeignKey("licenses.spdx_id"), nullable=False
    )
    stored_because: Mapped[str] = mapped_column(Text, nullable=False)
    stored_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        _in("molecule_type", MOLECULE_TYPES, "ck_blob_molecule_type"),
        CheckConstraint("length >= 0", name="ck_blob_length_non_negative"),
    )


class RecordGateResult(Base):
    """Every gate answer, including failures, so the filter is auditable.

    Three gate families with different authority. The editorial gates decide
    whether a record exists at all; the ingest gates decide hosting; the
    biosafety gates are blocking for certificates and advisory for catalogue
    records. Keeping the answers means the bar can be reviewed rather than
    taken on trust.
    """

    __tablename__ = "record_gate_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    record_id: Mapped[str] = mapped_column(String(20), ForeignKey("records.id"), nullable=False)
    gate_family: Mapped[str] = mapped_column(String(20), nullable=False)
    gate_key: Mapped[str] = mapped_column(
        String(32), nullable=False, comment="'1'..'7' | 'alpha'..'delta' | 'redistribution' | ..."
    )
    outcome: Mapped[str] = mapped_column(String(16), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    evaluated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    evaluated_by: Mapped[str] = mapped_column(
        String(128), nullable=False, comment="key id, 'agent:genome-watch', or 'human:<name>'"
    )

    __table_args__ = (
        _in("gate_family", GATE_FAMILIES, "ck_gate_family"),
        _in("outcome", GATE_OUTCOMES, "ck_gate_outcome"),
    )


class TakedownRequest(Base):
    """License complaints, privacy requests, biosafety concerns, corrections.

    Records are withdrawn by status change, never hard deleted, so the request
    and its outcome remain part of the archive's history. An aggregator without
    a route for complaints is a liability.
    """

    __tablename__ = "takedown_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    record_id: Mapped[str | None] = mapped_column(
        String(20), ForeignKey("records.id"), nullable=True
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    requested_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False)
    outcome: Mapped[str | None] = mapped_column(
        String(20), nullable=True, comment="upheld | declined | partial"
    )
    action_taken: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (_in("kind", TAKEDOWN_KINDS, "ck_takedown_kind"),)
