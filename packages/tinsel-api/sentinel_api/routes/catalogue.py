"""Catalogue ingest: records of third-party published work.

A catalogue record asserts that a published paper reported AI generated
sequences which were built and tested, and that the archive read it and
recorded what it found. It is a bibliographic and factual claim. The archive
signs nothing on the authors' behalf, asserts no ethics approval, and claims no
provenance over their work. That is what separates it from an AG- certificate.

Three things here are deliberate and worth not undoing:

Creation always lands in ``draft``. The gates are evaluated and recorded, but a
failing attribution gate does not refuse the record; it stops it leaving draft.
A record whose authors we failed to capture is a bug to fix, not a paper to
forget.

Publishing needs a different scope from drafting. The Genome Watch agent holds
``catalogue:draft``, so every publish attempt from it is refused. The editorial
control is a permission.

Biosafety is advisory here, and blocking for certificates. A catalogue record
whose sequence fails screening becomes ``restricted``: the citation survives,
the data does not. An archive that silently dropped the results most relevant
to biosecurity would make absent coverage look like absent risk.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import TypeVar

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from sentinel_api.accession import (
    CATALOGUE_SEQ_COUNTER,
    allocate_sequence_number,
    format_accession,
)
from sentinel_api.db.catalogue import (
    BIOSAFETY_CLASSES,
    CATALOGUE_STATUSES,
    MOLECULE_TYPES,
    CatalogueRecord,
    DesignMetadata,
    ExternalAccession,
    License,
    Record,
    RecordGateResult,
    SequenceBlob,
    Source,
    SourceAuthor,
)
from sentinel_api.db.connection import get_db
from sentinel_api.dependencies import Principal, require_principal, require_scope
from sentinel_api.enquiries import hosting_for, maybe_open_enquiry, resolution_for
from sentinel_api.rate_limit import rate_limit_read, rate_limit_write
from sentinel_api.scopes import (
    CATALOGUE_DRAFT,
    CATALOGUE_PUBLISH,
    READ_EMBARGOED,
)

router = APIRouter()

#: A select of any shape, carried through a helper with its shape intact.
#:
#: The list route applies one set of joins and filters to two selects: a count,
#: and a row of four entities. Annotating that helper as taking and returning
#: ``Select[Any]`` reads as "a select of anything", and is one column under
#: SQLAlchemy 2.1, where ``Select`` became variadic. The four entity select
#: then does not fit the parameter, and the four way unpack of the result does
#: not typecheck. Binding a type variable to a bare ``Select`` says what was
#: meant, whichever shape arrives, and holds under both 2.0 and 2.1.
_SelectT = TypeVar("_SelectT", bound=Select)

# ---------------------------------------------------------------------------
# The state machine
#
# Transitions are listed rather than inferred, so an unintended one is a
# KeyError at review time instead of a surprise in production. `withdrawn` is
# terminal: a withdrawn record keeps its row and its history, because an
# archive that deletes is not an archive.
# ---------------------------------------------------------------------------

TRANSITIONS: dict[str, frozenset[str]] = {
    "draft": frozenset({"staged", "withdrawn"}),
    "staged": frozenset({"reviewed", "draft", "restricted", "withdrawn"}),
    "reviewed": frozenset({"published", "staged", "restricted", "withdrawn"}),
    "published": frozenset({"restricted", "withdrawn"}),
    "restricted": frozenset({"reviewed", "withdrawn"}),
    "withdrawn": frozenset(),
}

#: Only publishing needs the stronger scope. Everything else is drafting work.
SCOPE_FOR_TARGET: dict[str, str] = {
    status: (CATALOGUE_PUBLISH if status == "published" else CATALOGUE_DRAFT)
    for status in CATALOGUE_STATUSES
}


# ---------------------------------------------------------------------------
# Request and response schemas
# ---------------------------------------------------------------------------

class AuthorIn(BaseModel):
    full_name: str
    orcid: str | None = None
    affiliation: str | None = None
    is_corresponding: bool = False


class SourceIn(BaseModel):
    title: str
    url: str
    doi: str | None = None
    container: str | None = None
    published_on: date | None = None
    peer_reviewed: bool = False
    version: str | None = None
    article_license: str | None = None
    data_license: str | None = None
    content_sha3_256: str | None = None
    authors: list[AuthorIn] = Field(default_factory=list)


class DesignIn(BaseModel):
    generating_model: str
    model_version: str | None = None
    model_availability: str | None = None
    design_method: str | None = None
    design_target: str | None = None
    n_designed: int | None = None
    n_tested: int | None = None
    n_functional: int | None = None
    assays: list[str] = Field(default_factory=list)
    expression_host: str | None = None
    wet_lab_validated: bool = False


class AccessionIn(BaseModel):
    database: str
    accession: str
    url: str


class GateAnswerIn(BaseModel):
    """An editorial gate answer from the agent, recorded verbatim."""

    gate_family: str
    gate_key: str
    outcome: str
    detail: str | None = None


class CatalogueCreate(BaseModel):
    title: str
    molecule_type: str
    source: SourceIn
    design: DesignIn
    accessions: list[AccessionIn] = Field(default_factory=list)
    gate_answers: list[GateAnswerIn] = Field(default_factory=list)
    biosafety_class: str = "none"
    ingest_run_id: uuid.UUID | None = None


class GateOut(BaseModel):
    gate_family: str
    gate_key: str
    outcome: str
    detail: str | None = None


class AuthorOut(BaseModel):
    full_name: str
    orcid: str | None = None
    affiliation: str | None = None
    is_corresponding: bool = False


class SourceOut(BaseModel):
    title: str
    url: str
    doi: str | None = None
    container: str | None = None
    published_on: date | None = None
    peer_reviewed: bool = False
    version: str | None = None
    article_license: str | None = None
    data_license: str | None = None
    authors: list[AuthorOut] = Field(default_factory=list)


class DesignOut(BaseModel):
    generating_model: str | None = None
    model_version: str | None = None
    model_availability: str | None = None
    design_method: str | None = None
    design_target: str | None = None
    n_designed: int | None = None
    n_tested: int | None = None
    n_functional: int | None = None
    assays: list[str] = Field(default_factory=list)
    expression_host: str | None = None
    wet_lab_validated: bool = False


class AccessionOut(BaseModel):
    database: str
    accession: str
    url: str


class SequenceOut(BaseModel):
    """What the archive holds. Never the sequence itself."""

    molecule_type: str
    length: int
    sha3_256: str
    held: bool = Field(description="The archive stores the sequence data.")
    withheld: bool = Field(description="Withheld on biosafety or the authors' request.")


class CatalogueOut(BaseModel):
    registry_id: str
    status: str
    visibility: str
    license_resolution: str = "unstated"
    citation_only: bool = False
    title: str
    molecule_type: str
    hosting_decision: str
    hosting_reason: str
    biosafety_class: str
    source_doi: str | None = None
    source_title: str | None = None
    generating_model: str | None = None
    gates: list[GateOut] = Field(default_factory=list)
    # catalogue: a citation of published work (AGC-). submission: deposited
    # directly by its authors (AG-).
    record_kind: str = "catalogue"
    summary: str | None = None
    created_at: datetime | None = None
    published_at: datetime | None = None
    source: SourceOut | None = None
    design: DesignOut | None = None
    accessions: list[AccessionOut] = Field(default_factory=list)
    sequence: SequenceOut | None = None


class StatusChange(BaseModel):
    status: str
    reason: str | None = None


# ---------------------------------------------------------------------------
# Gates
# ---------------------------------------------------------------------------

def _attribution_gate(payload: CatalogueCreate) -> tuple[str, str]:
    """Everything a citation needs must be present before a record can stage.

    This exists because attribution is the archive's charter commitment, and a
    record that cannot credit its authors should never become public.
    """
    missing: list[str] = []
    if not payload.source.authors:
        missing.append("authors")
    if not payload.source.title.strip():
        missing.append("title")
    if not (payload.source.doi or payload.source.url):
        missing.append("doi or url")
    if payload.source.published_on is None:
        missing.append("published_on")
    if not payload.source.container:
        missing.append("container")

    if missing:
        return "fail", "Cannot credit the source without: " + ", ".join(missing)
    return "pass", "Authors, title, venue, date and link are all present."


async def _lookup_license(db: AsyncSession, spdx_id: str | None) -> License | None:
    """Resolve an SPDX id against the vocabulary, rejecting unknown ones.

    Refusing an unknown identifier rather than coercing it to UNSTATED keeps a
    typo from quietly becoming a hosting decision.
    """
    if spdx_id is None:
        return None
    result = await db.execute(select(License).where(License.spdx_id == spdx_id))
    license_row = result.scalars().first()
    if license_row is None:
        known = (
            await db.execute(select(License.spdx_id).order_by(License.spdx_id))
        ).scalars().all()
        raise HTTPException(
            status_code=422,
            detail={
                "code": "UNKNOWN_LICENSE",
                "message": f"Licence {spdx_id!r} is not in the vocabulary.",
                "known_licenses": list(known),
            },
        )
    return license_row


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _record_gate(
    db: AsyncSession,
    record_id: str,
    family: str,
    key: str,
    outcome: str,
    detail: str | None,
    by: str,
) -> None:
    db.add(
        RecordGateResult(
            id=uuid.uuid4(),
            record_id=record_id,
            gate_family=family,
            gate_key=key,
            outcome=outcome,
            detail=detail,
            evaluated_by=by,
        )
    )


async def _gates_for(db: AsyncSession, record_id: str) -> list[GateOut]:
    rows = (
        await db.execute(
            select(RecordGateResult)
            .where(RecordGateResult.record_id == record_id)
            .order_by(RecordGateResult.evaluated_at, RecordGateResult.gate_key)
        )
    ).scalars().all()
    return [
        GateOut(
            gate_family=r.gate_family,
            gate_key=r.gate_key,
            outcome=r.outcome,
            detail=r.detail,
        )
        for r in rows
    ]


async def _load(db: AsyncSession, registry_id: str) -> tuple[CatalogueRecord, Source]:
    row = (
        await db.execute(
            select(CatalogueRecord, Source)
            .join(Source, Source.id == CatalogueRecord.source_id)
            .where(CatalogueRecord.id == registry_id)
        )
    ).first()
    if row is None:
        raise HTTPException(
            status_code=404, detail=f"Catalogue record '{registry_id}' not found"
        )
    return row[0], row[1]


def _public_gate(gate: GateOut) -> bool:
    """Whether a gate row may be shown to someone who is not a reviewer.

    Per-gate biosafety detail (``gate:*``) is for reviewers only: which check
    caught a sequence is exactly what someone designing around the screen
    wants. Integrity rows record who moved a record, which is internal.
    """
    return not gate.gate_key.startswith("gate:") and gate.gate_family != "integrity"


async def _to_out(
    db: AsyncSession,
    record: CatalogueRecord,
    source: Source,
    privileged: bool = True,
) -> CatalogueOut:
    design = (
        await db.execute(
            select(DesignMetadata).where(DesignMetadata.record_id == record.id)
        )
    ).scalars().first()
    authors = (
        await db.execute(
            select(SourceAuthor)
            .where(SourceAuthor.source_id == source.id)
            .order_by(SourceAuthor.position)
        )
    ).scalars().all()
    accessions = (
        await db.execute(
            select(ExternalAccession).where(ExternalAccession.record_id == record.id)
        )
    ).scalars().all()
    blob = (
        await db.execute(select(SequenceBlob).where(SequenceBlob.record_id == record.id))
    ).scalars().first()
    record_class = (
        await db.execute(select(Record.record_class).where(Record.id == record.id))
    ).scalar_one_or_none()

    gates = await _gates_for(db, record.id)
    # A withheld record shows that screening withheld it, and not what it was
    # designed to do: on a failed screen, that description is the hazard.
    redact = not privileged and record.biosafety_class == "restricted"
    if not privileged:
        gates = [g for g in gates if _public_gate(g)]

    design_out = None
    if design is not None:
        design_out = DesignOut(
            generating_model=design.generating_model,
            model_version=design.model_version,
            model_availability=design.model_availability,
            design_method=design.design_method,
            design_target=None if redact else design.design_target,
            n_designed=design.n_designed,
            n_tested=design.n_tested,
            n_functional=design.n_functional,
            assays=[] if redact else list(design.assays or []),
            expression_host=design.expression_host,
            wet_lab_validated=design.wet_lab_validated,
        )

    return CatalogueOut(
        record_kind="submission" if record_class == "submission" else "catalogue",
        summary=None if redact else record.summary,
        created_at=record.created_at,
        published_at=record.published_at,
        source=SourceOut(
            title=source.title,
            url=source.url,
            doi=source.doi,
            container=source.container,
            published_on=source.published_on,
            peer_reviewed=source.peer_reviewed,
            version=source.version,
            article_license=source.article_license,
            data_license=source.data_license,
            authors=[
                AuthorOut(
                    full_name=a.full_name,
                    orcid=a.orcid,
                    affiliation=a.affiliation,
                    is_corresponding=a.is_corresponding,
                )
                for a in authors
            ],
        ),
        design=design_out,
        accessions=[
            AccessionOut(database=a.database, accession=a.accession, url=a.url)
            for a in accessions
        ],
        sequence=(
            SequenceOut(
                molecule_type=blob.molecule_type,
                length=blob.length,
                sha3_256=blob.sha3_256,
                held=blob.data is not None,
                withheld=record.hosting_decision == "withheld",
            )
            if blob is not None
            else None
        ),
        registry_id=record.id,
        status=record.status,
        visibility=record.visibility,
        license_resolution=record.license_resolution,
        citation_only=record.citation_only,
        title=record.title,
        molecule_type=record.molecule_type,
        hosting_decision=record.hosting_decision,
        hosting_reason=record.hosting_reason,
        biosafety_class=record.biosafety_class,
        source_doi=source.doi,
        source_title=source.title,
        generating_model=design.generating_model if design else None,
        gates=gates,
    )


# ---------------------------------------------------------------------------
# POST /catalogue
# ---------------------------------------------------------------------------

@router.post("", status_code=201, response_model=CatalogueOut)
@rate_limit_write
async def create_catalogue_record(
    request: Request,  # slowapi reads the key off the request
    body: CatalogueCreate,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_scope(CATALOGUE_DRAFT)),
) -> CatalogueOut:
    """Create a catalogue record in draft, with its gate answers recorded."""
    if body.molecule_type not in MOLECULE_TYPES:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "INVALID_MOLECULE_TYPE",
                "message": f"molecule_type must be one of {sorted(MOLECULE_TYPES)}",
            },
        )
    if body.biosafety_class not in BIOSAFETY_CLASSES:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "INVALID_BIOSAFETY_CLASS",
                "message": f"biosafety_class must be one of {sorted(BIOSAFETY_CLASSES)}",
            },
        )

    # Dedup on the DOI, which is the canonical identity of a publication. The
    # existing id is returned because the caller owns the catalogue: hiding it
    # would only make an idempotent retry impossible.
    if body.source.doi:
        existing = (
            await db.execute(
                select(CatalogueRecord.id)
                .join(Source, Source.id == CatalogueRecord.source_id)
                .where(Source.doi == body.source.doi)
            )
        ).scalars().first()
        if existing is not None:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "ALREADY_CATALOGUED",
                    "message": f"DOI {body.source.doi} is already catalogued.",
                    "registry_id": existing,
                },
            )

    article_license = await _lookup_license(db, body.source.article_license)
    data_license = await _lookup_license(db, body.source.data_license)

    resolution = resolution_for(data_license)
    hosting_decision, hosting_reason = hosting_for(
        resolution,
        body.biosafety_class,
        data_license.spdx_id if data_license else None,
    )
    license_outcome = "pass" if hosting_decision == "hosted" else "advisory"
    attribution_outcome, attribution_detail = _attribution_gate(body)

    number = await allocate_sequence_number(db, CATALOGUE_SEQ_COUNTER)
    registry_id = format_accession("AGC", datetime.now(UTC).year, number)

    db.add(Record(id=registry_id, record_class="catalogue"))
    await db.flush()

    source = Source(
        id=uuid.uuid4(),
        doi=body.source.doi,
        title=body.source.title,
        container=body.source.container,
        published_on=body.source.published_on,
        peer_reviewed=body.source.peer_reviewed,
        version=body.source.version,
        url=body.source.url,
        article_license=article_license.spdx_id if article_license else None,
        data_license=data_license.spdx_id if data_license else None,
        retrieved_at=datetime.now(UTC),
        retrieved_from=body.source.url,
        content_sha3_256=body.source.content_sha3_256,
    )
    db.add(source)
    await db.flush()

    for position, author in enumerate(body.source.authors, start=1):
        db.add(
            SourceAuthor(
                source_id=source.id,
                position=position,
                full_name=author.full_name,
                orcid=author.orcid,
                affiliation=author.affiliation,
                is_corresponding=author.is_corresponding,
            )
        )

    record = CatalogueRecord(
        id=registry_id,
        source_id=source.id,
        title=body.title,
        molecule_type=body.molecule_type,
        status="draft",
        visibility="private",
        hosting_decision=hosting_decision,
        hosting_reason=hosting_reason,
        biosafety_class=body.biosafety_class,
        license_resolution=resolution,
        ingest_run_id=body.ingest_run_id,
    )
    db.add(record)
    await db.flush()

    db.add(
        DesignMetadata(
            record_id=registry_id,
            generating_model=body.design.generating_model,
            model_version=body.design.model_version,
            model_availability=body.design.model_availability,
            design_method=body.design.design_method,
            design_target=body.design.design_target,
            n_designed=body.design.n_designed,
            n_tested=body.design.n_tested,
            n_functional=body.design.n_functional,
            assays=body.design.assays,
            expression_host=body.design.expression_host,
            wet_lab_validated=body.design.wet_lab_validated,
        )
    )

    for accession in body.accessions:
        db.add(
            ExternalAccession(
                id=uuid.uuid4(),
                record_id=registry_id,
                database=accession.database,
                accession=accession.accession,
                url=accession.url,
            )
        )

    await db.flush()

    # An unstated licence opens a question rather than closing one. Nothing is
    # sent here: the enquiry is queued for a person to read and send.
    enquiry = await maybe_open_enquiry(db, record)

    by = f"key:{principal.key_id}"
    if enquiry is not None:
        await _record_gate(
            db, registry_id, "license", "enquiry",
            "advisory",
            f"Licence enquiry {enquiry.id} queued ({enquiry.reason}). "
            "No message is sent by the archive.",
            by,
        )
    await _record_gate(
        db, registry_id, "attribution", "complete",
        attribution_outcome, attribution_detail, by,
    )
    await _record_gate(
        db, registry_id, "license", "redistribution",
        license_outcome, hosting_reason, by,
    )
    for answer in body.gate_answers:
        await _record_gate(
            db, registry_id, answer.gate_family, answer.gate_key,
            answer.outcome, answer.detail, by,
        )

    await db.commit()
    record, source = await _load(db, registry_id)
    return await _to_out(db, record, source)


# ---------------------------------------------------------------------------
# POST /catalogue/{id}/status
# ---------------------------------------------------------------------------

@router.post("/{registry_id}/status", response_model=CatalogueOut)
async def change_status(
    registry_id: str,
    body: StatusChange,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_principal),
) -> CatalogueOut:
    """Move a record through the lifecycle, enforcing the gates and the scope."""
    if body.status not in CATALOGUE_STATUSES:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "INVALID_STATUS",
                "message": f"status must be one of {sorted(CATALOGUE_STATUSES)}",
            },
        )

    record, source = await _load(db, registry_id)

    allowed = TRANSITIONS[record.status]
    if body.status not in allowed:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "INVALID_TRANSITION",
                "message": (
                    f"A record in '{record.status}' cannot move to "
                    f"'{body.status}'."
                ),
                "allowed": sorted(allowed),
            },
        )

    required_scope = SCOPE_FOR_TARGET[body.status]
    if not principal.has(required_scope):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "INSUFFICIENT_SCOPE",
                "message": (
                    f"Moving a record to '{body.status}' requires the "
                    f"'{required_scope}' scope."
                ),
                "missing_scopes": [required_scope],
            },
        )

    # Leaving draft is where the attribution gate bites: a record that cannot
    # credit its authors must not progress towards publication.
    if body.status == "staged":
        failed = (
            await db.execute(
                select(RecordGateResult)
                .where(
                    RecordGateResult.record_id == registry_id,
                    RecordGateResult.gate_family == "attribution",
                    RecordGateResult.outcome == "fail",
                )
                .order_by(RecordGateResult.evaluated_at.desc())
                .limit(1)
            )
        ).scalars().first()
        if failed is not None:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "ATTRIBUTION_INCOMPLETE",
                    "message": (
                        "The attribution gate has not passed, so this record "
                        "cannot leave draft."
                    ),
                    "detail": failed.detail,
                },
            )

    previous = record.status
    record.status = body.status

    if body.status == "published":
        record.visibility = "public"
        record.published_at = datetime.now(UTC)
    elif body.status in {"restricted", "withdrawn"}:
        record.visibility = "private"

    await _record_gate(
        db,
        registry_id,
        "integrity",
        f"transition:{previous}->{body.status}",
        "pass",
        body.reason,
        f"key:{principal.key_id}",
    )

    await db.commit()
    record, source = await _load(db, registry_id)
    return await _to_out(db, record, source)


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------

@router.get("/{registry_id}", response_model=CatalogueOut)
@rate_limit_read
async def get_catalogue_record(
    request: Request,  # slowapi reads the key off the request
    registry_id: str,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_principal),
) -> CatalogueOut:
    """Read a record. Published records are readable by any valid key."""
    record, source = await _load(db, registry_id)

    if record.visibility != "public" and not (
        principal.has(READ_EMBARGOED) or principal.has(CATALOGUE_DRAFT)
    ):
        # 404 rather than 403, so the response does not confirm that an
        # unpublished record exists.
        raise HTTPException(
            status_code=404, detail=f"Catalogue record '{registry_id}' not found"
        )

    privileged = principal.has(READ_EMBARGOED) or principal.has(CATALOGUE_DRAFT)
    return await _to_out(db, record, source, privileged=privileged)


@router.get("", response_model=dict)
@rate_limit_read
async def list_catalogue_records(
    request: Request,  # slowapi reads the key off the request
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status: str | None = Query(None),
    q: str | None = Query(None, max_length=200, description="Search titles, sources and models"),
    molecule_type: str | None = Query(None),
    model: str | None = Query(None, max_length=100, description="Generating model, partial match"),
    validated: bool | None = Query(None, description="Wet-lab validated only"),
    kind: str | None = Query(None, description="catalogue or submission"),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_principal),
) -> dict:
    """List records. Unpublished ones appear only for a caller who may see them.

    The search deliberately does not reach design targets: a withheld record's
    target is hidden from the public, and a search that matched on it would
    disclose it one query at a time.
    """
    may_see_unpublished = principal.has(READ_EMBARGOED) or principal.has(
        CATALOGUE_DRAFT
    )

    conditions = []
    if not may_see_unpublished:
        conditions.append(CatalogueRecord.visibility == "public")
    if status is not None:
        if status not in CATALOGUE_STATUSES:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "INVALID_STATUS",
                    "message": f"status must be one of {sorted(CATALOGUE_STATUSES)}",
                },
            )
        conditions.append(CatalogueRecord.status == status)
    if molecule_type is not None:
        conditions.append(CatalogueRecord.molecule_type == molecule_type)
    if model:
        conditions.append(
            func.lower(DesignMetadata.generating_model).contains(model.lower(), autoescape=True)
        )
    if validated is not None:
        conditions.append(DesignMetadata.wet_lab_validated == validated)
    if kind in ("catalogue", "submission"):
        conditions.append(Record.record_class == kind)
    if q:
        needle = q.strip().lower()
        conditions.append(
            func.lower(CatalogueRecord.title).contains(needle, autoescape=True)
            | func.lower(Source.title).contains(needle, autoescape=True)
            | func.lower(func.coalesce(Source.container, "")).contains(needle, autoescape=True)
            | func.lower(func.coalesce(DesignMetadata.generating_model, "")).contains(
                needle, autoescape=True
            )
        )

    def joined(stmt: _SelectT) -> _SelectT:
        return (
            stmt.select_from(CatalogueRecord)
            .join(Record, Record.id == CatalogueRecord.id)
            .join(Source, Source.id == CatalogueRecord.source_id)
            .outerjoin(DesignMetadata, DesignMetadata.record_id == CatalogueRecord.id)
            .where(*conditions)
        )

    total = (await db.execute(joined(select(func.count())))).scalar_one()

    rows = (
        await db.execute(
            joined(select(CatalogueRecord, Record.record_class, Source, DesignMetadata))
            .order_by(CatalogueRecord.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()

    return {
        "items": [
            {
                "registry_id": r.id,
                "title": r.title,
                "status": r.status,
                "visibility": r.visibility,
                "molecule_type": r.molecule_type,
                "hosting_decision": r.hosting_decision,
                "biosafety_class": r.biosafety_class,
                "record_kind": "submission" if record_class == "submission" else "catalogue",
                "generating_model": d.generating_model if d else None,
                "wet_lab_validated": bool(d.wet_lab_validated) if d else False,
                "container": src.container,
                "published_on": src.published_on.isoformat() if src.published_on else None,
                "peer_reviewed": src.peer_reviewed,
                "created_at": r.created_at.isoformat(),
                "published_at": r.published_at.isoformat() if r.published_at else None,
            }
            for r, record_class, src, d in rows
        ],
        "count": total,
        "offset": offset,
        "limit": limit,
    }
