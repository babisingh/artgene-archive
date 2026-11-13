"""Direct submission of sequences by their authors.

Anyone may submit, through the website or through this API, and every sequence
is screened by the same gates as everything else in the archive
(``sentinel_api.screening``). A submission becomes an AG- record in draft. It is
not public until an editor publishes it, through the same workflow as a
catalogue record.

Three rules shape this route.

1. **The response never reveals the screening outcome.** An anonymous endpoint
   that answered pass or fail on demand would let someone vary a sequence until
   it slipped through. Every accepted submission gets the same receipt, and the
   outcome reaches the submitter only in a letter a person has read.

2. **A sequence that fails screening is never stored.** Its length and digest
   are recorded, so the record stays citable and a resubmission is recognised,
   and ``data`` stays NULL. Once reviewed, a failed record can still be listed
   with its sequence marked withheld: leaving it out would make absent coverage
   look like absent risk.

3. **The archive drafts the letter and cannot deliver it.** It is queued in the
   outbox; someone reads it and sends it from their own mail client. That
   absence of a send path is enforced by tests/test_no_send_path.py.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import uuid
from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tinsel.models import SequenceType
from tinsel.registry import HostOrganism

from sentinel_api.accession import (
    AUDIT_SEQ_COUNTER,
    allocate_sequence_number,
    format_accession,
)
from sentinel_api.config import settings
from sentinel_api.db.catalogue import (
    ACCESSION_DATABASES,
    MOLECULE_TYPES,
    CatalogueRecord,
    DesignMetadata,
    ExternalAccession,
    License,
    Notification,
    Record,
    RecordGateResult,
    SequenceBlob,
    Source,
    SourceAuthor,
    Submission,
)
from sentinel_api.db.connection import get_db
from sentinel_api.db.enquiry import DoNotContact, email_fingerprint
from sentinel_api.db.models import RegistryAuditLog
from sentinel_api.dependencies import Principal, require_scope
from sentinel_api.enquiries import hosting_for, pepper, resolution_for
from sentinel_api.ledger import entry_hash, highest_audit_seq_plus_one, prev_entry_hash
from sentinel_api.rate_limit import rate_limit_read, rate_limit_write
from sentinel_api.routes.catalogue import AccessionIn, AuthorIn, DesignIn
from sentinel_api.scopes import CATALOGUE_DRAFT
from sentinel_api.screening import (
    ScreeningInputError,
    ScreenResult,
    add_kmer_index_rows,
    prepare,
    screen,
)

router = APIRouter()
log = logging.getLogger(__name__)

#: Canonical address of an AG record, used as the source link of a submission
#: that has no preprint or repository of its own: the archive is its venue.
RECORD_URL = "https://artgene-archive.org/sequences/{registry_id}"
SUBMISSION_VENUE = "ArtGene Archive (direct submission)"

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_ORCID = re.compile(r"^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$")

#: What every accepted submission is told, whatever screening concluded.
RECEIPT_MESSAGE = (
    "Thank you. Your submission has been received and is awaiting review. "
    "We will write to you at the address you gave."
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class SubmitterIn(BaseModel):
    """The person the archive will write to. Need not be an author."""

    name: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=320)
    affiliation: str | None = Field(default=None, max_length=300)
    orcid: str | None = None


class SubmissionSourceIn(BaseModel):
    """Optional: where the work can be read, for a preprint or repository."""

    url: str | None = None
    doi: str | None = None
    title: str | None = None
    container: str | None = None
    published_on: date | None = None


class SubmissionCreate(BaseModel):
    title: str = Field(min_length=3, max_length=300)
    summary: str | None = Field(default=None, max_length=2000)
    molecule_type: str
    fasta: str = Field(min_length=1)
    host_organism: HostOrganism = HostOrganism.ECOLI
    authors: list[AuthorIn] = Field(min_length=1)
    design: DesignIn
    accessions: list[AccessionIn] = Field(default_factory=list)
    source: SubmissionSourceIn = Field(default_factory=SubmissionSourceIn)
    data_license: str
    submitter: SubmitterIn
    confirms_rights: bool = False
    accepts_screening: bool = False
    #: Left empty by people. A form field hidden from them, filled by bots.
    website: str | None = None


class SubmissionReceipt(BaseModel):
    registry_id: str | None
    status: str = "received"
    message: str = RECEIPT_MESSAGE


class NotificationOut(BaseModel):
    id: uuid.UUID
    record_id: str
    kind: str
    recipient_name: str | None
    recipient_email: str
    subject: str
    body: str
    status: str
    created_at: datetime
    sent_at: datetime | None
    note: str | None


class NotificationUpdate(BaseModel):
    status: str
    note: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _invalid(code: str, message: str) -> HTTPException:
    return HTTPException(status_code=422, detail={"code": code, "message": message})


def _validate(body: SubmissionCreate) -> None:
    if not (body.confirms_rights and body.accepts_screening):
        raise _invalid(
            "CONFIRMATION_REQUIRED",
            "Please confirm you may share this sequence, and accept that it "
            "will be screened before anything is stored or published.",
        )
    if body.molecule_type not in MOLECULE_TYPES:
        raise _invalid(
            "INVALID_MOLECULE_TYPE",
            f"molecule_type must be one of {sorted(MOLECULE_TYPES)}",
        )
    if not _EMAIL.match(body.submitter.email.strip()):
        raise _invalid("INVALID_EMAIL", "Please give an email address we can write to.")
    orcids = [body.submitter.orcid] + [a.orcid for a in body.authors]
    for orcid in filter(None, orcids):
        if not _ORCID.match(orcid.strip()):
            raise _invalid("INVALID_ORCID", f"{orcid} is not an ORCID iD (0000-0000-0000-0000).")
    for acc in body.accessions:
        if acc.database not in ACCESSION_DATABASES:
            raise _invalid(
                "INVALID_ACCESSION_DATABASE",
                f"database must be one of {sorted(ACCESSION_DATABASES)}",
            )


def _molecule_matches(molecule_type: str, seq_type: SequenceType) -> bool:
    """A protein must be declared a protein, and only a protein may be."""
    return (molecule_type == "protein") == (seq_type is SequenceType.PROTEIN)


_GATE_OUTCOMES = {"pass": "pass", "warn": "warn", "fail": "fail", "skip": "skip"}

#: The one biosafety line anyone may read. Per-gate rows are for reviewers.
_PUBLIC_SCREENING = {
    "passed": ("pass", "Passed every biosafety gate."),
    "passed_with_notes": ("warn", "Passed, with notes for the reviewer."),
    "withheld": ("fail", "Did not pass biosafety screening, so the sequence is withheld."),
}


def _gate_rows(result: ScreenResult) -> list[tuple[str, str, str | None]]:
    """Per-gate outcomes for reviewers, keyed ``gate:<name>``."""
    if result.fragment_risk:
        return [(
            "gate:fragment_assembly",
            "fail",
            "Combined with a sequence already in the archive, this assembles "
            "into a product that fails screening.",
        )]
    rows = []
    for name, value in (result.report or {}).items():
        if isinstance(value, dict) and "status" in value:
            status = str(value["status"]).split(".")[-1].lower()
            rows.append((
                f"gate:{name}",
                _GATE_OUTCOMES.get(status, "advisory"),
                value.get("message"),
            ))
    if result.note:
        rows.append(("gate:coverage", "warn", f"Partial screen: {result.note}"))
    return rows


def _content_hash(registry_id: str, body: SubmissionCreate, digest: str, outcome: str) -> str:
    """SHA3-512 over what was submitted, for the ledger entry.

    The ledger proves what the archive received and when. It holds this digest,
    never the sequence.
    """
    canonical = json.dumps(
        {
            "registry_id": registry_id,
            "title": body.title,
            "molecule_type": body.molecule_type,
            "sequence_sha3_256": digest,
            "screening_outcome": outcome,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha3_512(canonical.encode()).hexdigest()


def render_withheld_letter(name: str, title: str, registry_id: str) -> tuple[str, str]:
    """The letter to a submitter whose sequence failed screening.

    It says what happened and what follows, and deliberately not why: the
    detail of a screening decision is a map for designing around the screen.
    """
    subject = f"Your submission to ArtGene Archive ({registry_id})"
    body = (
        f"Dear {name},\n\n"
        f'Thank you for submitting "{title}" to ArtGene Archive. It has been '
        f"given the accession {registry_id}.\n\n"
        "Every sequence that enters the archive is screened for biosafety "
        "before anything is stored or published. Your submission did not pass "
        "that screening, so the sequence has not been stored, and it will not "
        "be published or shared.\n\n"
        "What this means:\n"
        "- We have kept only the sequence's length and a checksum, so the "
        "record can be identified if you write to us about it.\n"
        "- After review, the record may be listed in the archive with its "
        "sequence marked as withheld. A listing says that screening withheld a "
        "sequence. It does not say why.\n\n"
        "We do not share the details of screening decisions, because they "
        "would help someone design around the checks. If you believe this "
        "outcome is mistaken, reply to this message and a person will look at "
        "it.\n\n"
        "ArtGene Archive\n"
    )
    return subject, body


async def _suppressed(db: AsyncSession, email: str) -> bool:
    fingerprint = email_fingerprint(email, pepper())
    return (
        await db.execute(select(DoNotContact.id).where(DoNotContact.email_hmac == fingerprint))
    ).scalars().first() is not None


# ---------------------------------------------------------------------------
# POST /submissions
# ---------------------------------------------------------------------------


@router.post("", status_code=202, response_model=SubmissionReceipt)
@rate_limit_write
async def create_submission(
    request: Request,  # slowapi reads the key off the request
    body: SubmissionCreate,
    db: AsyncSession = Depends(get_db),
) -> SubmissionReceipt:
    """Submit a sequence. Open to anyone; nothing is public until reviewed."""
    if body.website:
        # A person never sees this field. Answer as if accepted, store nothing.
        return SubmissionReceipt(registry_id=None)

    _validate(body)

    data_license = (
        await db.execute(select(License).where(License.spdx_id == body.data_license))
    ).scalars().first()
    if data_license is None:
        raise _invalid(
            "UNKNOWN_LICENSE", f"{body.data_license} is not a licence the archive knows."
        )

    try:
        prepared = prepare(body.fasta)
    except ScreeningInputError as exc:
        raise _invalid(exc.code, exc.message) from exc
    if not _molecule_matches(body.molecule_type, prepared.seq_type):
        raise _invalid(
            "MOLECULE_TYPE_MISMATCH",
            f"The sequence reads as {prepared.seq_type.value}, which does not "
            f"match the molecule type you chose ({body.molecule_type}).",
        )

    if (
        await db.execute(
            select(SequenceBlob.id).where(SequenceBlob.sha3_256 == prepared.sha3_256).limit(1)
        )
    ).scalars().first() is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "SEQUENCE_ALREADY_IN_ARCHIVE",
                "message": "This sequence is already in the archive.",
            },
        )
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

    try:
        result = await screen(
            db, prepared, body.host_organism.value, settings.sentinel_env
        )
    except Exception as exc:
        log.exception("Screening raised an unexpected error: %s", exc)
        raise HTTPException(
            status_code=500,
            detail={
                "code": "PIPELINE_ERROR",
                "message": (
                    "The biosafety pipeline encountered an internal error. "
                    "Please try again. If the problem persists, contact us."
                ),
            },
        ) from exc

    biosafety_class = result.biosafety_class
    resolution = resolution_for(data_license)
    hosting_decision, hosting_reason = hosting_for(
        resolution, biosafety_class, data_license.spdx_id
    )
    store_sequence = result.outcome != "withheld" and hosting_decision == "hosted"
    now = datetime.now(UTC)
    email = body.submitter.email.strip()

    # The counter row lock taken here is held until commit, which is what makes
    # extending the ledger chain safe. It is taken after screening on purpose:
    # holding it through the gates would serialise every submission.
    seq_num = await allocate_sequence_number(
        db, AUDIT_SEQ_COUNTER, seed=lambda: highest_audit_seq_plus_one(db)
    )
    registry_id = format_accession("AG", now.year, seq_num)

    db.add(Record(id=registry_id, record_class="submission"))
    await db.flush()

    source = Source(
        id=uuid.uuid4(),
        doi=body.source.doi,
        title=body.source.title or body.title,
        container=body.source.container or SUBMISSION_VENUE,
        published_on=body.source.published_on or now.date(),
        peer_reviewed=False,
        url=body.source.url or RECORD_URL.format(registry_id=registry_id),
        data_license=data_license.spdx_id,
        retrieved_at=now,
        retrieved_from="submission",
    )
    db.add(source)
    await db.flush()

    for position, author in enumerate(body.authors, start=1):
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

    db.add(
        CatalogueRecord(
            id=registry_id,
            source_id=source.id,
            title=body.title,
            summary=body.summary,
            molecule_type=body.molecule_type,
            status="draft",
            visibility="private",
            hosting_decision=hosting_decision,
            hosting_reason=hosting_reason,
            biosafety_class=biosafety_class,
            license_resolution=resolution,
            citation_only=False,
        )
    )
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
    for acc in body.accessions:
        db.add(
            ExternalAccession(
                id=uuid.uuid4(),
                record_id=registry_id,
                database=acc.database,
                accession=acc.accession,
                url=acc.url,
            )
        )

    outcome, detail = _PUBLIC_SCREENING[result.outcome]
    gates = [
        ("attribution", "complete", "pass",
         "Submitted directly by the authors, with the archive as the venue."),
        ("license", "redistribution",
         "pass" if hosting_decision == "hosted" else "advisory", hosting_reason),
        ("biosafety", "screening", outcome, detail),
        *[("biosafety", key, out, det) for key, out, det in _gate_rows(result)],
    ]
    for family, key, gate_outcome, gate_detail in gates:
        db.add(
            RecordGateResult(
                id=uuid.uuid4(),
                record_id=registry_id,
                gate_family=family,
                gate_key=key,
                outcome=gate_outcome,
                detail=gate_detail,
                evaluated_by="submission-screen",
            )
        )

    db.add(
        SequenceBlob(
            id=uuid.uuid4(),
            record_id=registry_id,
            molecule_type=body.molecule_type,
            length=len(prepared.sequence),
            sha3_256=prepared.sha3_256,
            data=prepared.sequence if store_sequence else None,
            license_spdx=data_license.spdx_id,
            stored_because=(
                f"Submitted by its authors under {data_license.spdx_id}, and "
                "passed biosafety screening."
                if store_sequence
                else f"Not stored: {hosting_reason}"
            ),
        )
    )
    db.add(
        Submission(
            record_id=registry_id,
            submitter_name=body.submitter.name,
            submitter_email=email,
            submitter_affiliation=body.submitter.affiliation,
            submitter_orcid=body.submitter.orcid,
            screen_mode=prepared.screen_mode,
            screening_outcome=result.outcome,
        )
    )

    if result.outcome == "withheld":
        subject, letter = render_withheld_letter(body.submitter.name, body.title, registry_id)
        suppressed = await _suppressed(db, email)
        db.add(
            Notification(
                id=uuid.uuid4(),
                record_id=registry_id,
                kind="screening_withheld",
                recipient_name=body.submitter.name,
                recipient_email=email,
                subject=subject,
                body=letter,
                status="suppressed" if suppressed else "drafted",
                note="Recipient is on the do-not-contact list." if suppressed else None,
            )
        )

    if store_sequence and prepared.gate_protein:
        add_kmer_index_rows(db, registry_id, None, prepared.gate_protein)

    content_hash = _content_hash(registry_id, body, prepared.sha3_256, result.outcome)
    prev = await prev_entry_hash(db)
    db.add(
        RegistryAuditLog(
            id=uuid.uuid4(),
            seq_num=seq_num,
            prev_hash_hex=prev,
            certificate_hash=content_hash,
            entry_hash_hex=entry_hash(seq_num, prev, content_hash),
            registry_id=registry_id,
            timestamp=now,
        )
    )

    await db.commit()
    return SubmissionReceipt(registry_id=registry_id)


# ---------------------------------------------------------------------------
# The outbox: letters drafted for a person to read and send
# ---------------------------------------------------------------------------


@router.get("/outbox", response_model=list[NotificationOut])
@rate_limit_read
async def list_outbox(
    request: Request,  # slowapi reads the key off the request
    status: str = Query("drafted"),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_scope(CATALOGUE_DRAFT)),
) -> list[NotificationOut]:
    """Letters waiting for a person. Drafted ones by default."""
    rows = (
        await db.execute(
            select(Notification)
            .where(Notification.status == status)
            .order_by(Notification.created_at)
        )
    ).scalars().all()
    return [NotificationOut.model_validate(r, from_attributes=True) for r in rows]


@router.post("/outbox/{notification_id}", response_model=NotificationOut)
@rate_limit_write
async def update_outbox_letter(
    request: Request,  # slowapi reads the key off the request
    notification_id: uuid.UUID,
    body: NotificationUpdate,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_scope(CATALOGUE_DRAFT)),
) -> NotificationOut:
    """Record what a person did with a drafted letter: sent it, or discarded it."""
    if body.status not in {"sent", "discarded"}:
        raise _invalid("INVALID_STATUS", "status must be 'sent' or 'discarded'.")
    letter = (
        await db.execute(select(Notification).where(Notification.id == notification_id))
    ).scalars().first()
    if letter is None:
        raise HTTPException(status_code=404, detail="No such letter.")
    if letter.status != "drafted":
        raise HTTPException(
            status_code=409,
            detail={
                "code": "NOT_DRAFTED",
                "message": f"This letter is already {letter.status}.",
            },
        )
    letter.status = body.status
    letter.note = body.note
    if body.status == "sent":
        letter.sent_at = datetime.now(UTC)
    await db.commit()
    return NotificationOut.model_validate(letter, from_attributes=True)
