"""Working the licence enquiry queue.

Every route here requires the ``admin`` scope, because the queue holds contact
details for named people. The Genome Watch agent, which creates the enquiries,
cannot read them.

Nothing here sends anything. ``GET /{id}/letter`` returns text for a person to
read and send from their own mail client, and ``POST /{id}/status`` records
that they did. The absence of a send path is the control, not a setting, and
tests/test_no_send_path.py fails if a mail library ever appears in the package.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from sentinel_api.db.catalogue import CatalogueRecord, License, Source
from sentinel_api.db.connection import get_db
from sentinel_api.db.enquiry import ENQUIRY_STATUSES, LicenseEnquiry
from sentinel_api.dependencies import Principal, require_scope
from sentinel_api.enquiries import apply_response, render_letter
from sentinel_api.rate_limit import rate_limit_read
from sentinel_api.scopes import ADMIN

router = APIRouter()

# One reminder and then stop is a rule in the design, so it is a rule in the
# table: sent may become reminded, and reminded may not. Closing is always
# available, because abandoning an enquiry should never need a detour.
ENQUIRY_TRANSITIONS: dict[str, frozenset[str]] = {
    "queued": frozenset({"drafted", "closed"}),
    "drafted": frozenset({"sent", "closed"}),
    "sent": frozenset({"reminded", "replied", "no_response", "closed"}),
    "reminded": frozenset({"replied", "no_response", "closed"}),
    "replied": frozenset({"closed"}),
    "no_response": frozenset({"closed"}),
    "closed": frozenset(),
}


class EnquiryOut(BaseModel):
    id: uuid.UUID
    source_id: uuid.UUID
    reason: str
    status: str
    contact_name: str | None = None
    contact_orcid: str | None = None
    has_contact_email: bool = False
    source_title: str | None = None
    source_doi: str | None = None
    record_ids: list[str] = []
    response_license: str | None = None
    opt_in: bool | None = None


class EnquiryStatusChange(BaseModel):
    status: str
    #: Supplied when moving to ``sent``, so the operator can record where the
    #: letter went without the agent ever collecting an address.
    contact_email: str | None = None


class EnquiryResponse(BaseModel):
    """What the authors said. ``evidence`` is required, not decorative.

    Every hosted byte should trace to a specific statement by a specific
    person, so the archive can say why it believes it has permission.
    """

    declined: bool = False
    response_license: str | None = None
    note: str | None = None
    evidence: str
    opt_in: bool | None = None
    contact_email: str | None = None


async def _load(db: AsyncSession, enquiry_id: uuid.UUID) -> tuple[LicenseEnquiry, Source]:
    row = (
        await db.execute(
            select(LicenseEnquiry, Source)
            .join(Source, Source.id == LicenseEnquiry.source_id)
            .where(LicenseEnquiry.id == enquiry_id)
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail=f"Enquiry '{enquiry_id}' not found")
    return row[0], row[1]


async def _records_for(db: AsyncSession, source_id: uuid.UUID) -> list[CatalogueRecord]:
    return list(
        (
            await db.execute(
                select(CatalogueRecord).where(CatalogueRecord.source_id == source_id)
            )
        ).scalars().all()
    )


async def _to_out(
    db: AsyncSession, enquiry: LicenseEnquiry, source: Source
) -> EnquiryOut:
    records = await _records_for(db, source.id)
    return EnquiryOut(
        id=enquiry.id,
        source_id=source.id,
        reason=enquiry.reason,
        status=enquiry.status,
        contact_name=enquiry.contact_name,
        contact_orcid=enquiry.contact_orcid,
        has_contact_email=enquiry.contact_email is not None,
        source_title=source.title,
        source_doi=source.doi,
        record_ids=[r.id for r in records],
        response_license=enquiry.response_license,
        opt_in=enquiry.opt_in,
    )


@router.get("", response_model=dict)
@rate_limit_read
async def list_enquiries(
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_scope(ADMIN)),
) -> dict:
    """The queue, oldest first, because the oldest is the one going stale."""
    conditions = []
    if status is not None:
        if status not in ENQUIRY_STATUSES:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "INVALID_STATUS",
                    "message": f"status must be one of {sorted(ENQUIRY_STATUSES)}",
                },
            )
        conditions.append(LicenseEnquiry.status == status)

    total = (
        await db.execute(
            select(func.count()).select_from(LicenseEnquiry).where(*conditions)
        )
    ).scalar_one()

    rows = (
        await db.execute(
            select(LicenseEnquiry, Source)
            .join(Source, Source.id == LicenseEnquiry.source_id)
            .where(*conditions)
            .order_by(LicenseEnquiry.detected_at)
            .limit(limit)
            .offset(offset)
        )
    ).all()

    items = [await _to_out(db, enquiry, source) for enquiry, source in rows]
    return {
        "items": [i.model_dump(mode="json") for i in items],
        "count": total,
        "offset": offset,
        "limit": limit,
    }


@router.get("/{enquiry_id}/letter", response_model=dict)
async def get_letter(
    enquiry_id: uuid.UUID,
    sender: str = Query("", description="How to sign the letter"),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_scope(ADMIN)),
) -> dict:
    """Render the draft letter. Returns text; sends nothing."""
    enquiry, source = await _load(db, enquiry_id)
    records = await _records_for(db, source.id)
    if not records:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "NO_RECORD",
                "message": "This enquiry's source has no catalogue record.",
            },
        )

    return {
        "enquiry_id": str(enquiry.id),
        "letter": render_letter(
            record=records[0],
            source=source,
            enquiry=enquiry,
            sender=sender or principal.org.name,
        ),
        "note": (
            "Draft only. The archive sends nothing: copy this into your own "
            "mail client, then record it as sent."
        ),
    }


@router.post("/{enquiry_id}/status", response_model=EnquiryOut)
async def change_enquiry_status(
    enquiry_id: uuid.UUID,
    body: EnquiryStatusChange,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_scope(ADMIN)),
) -> EnquiryOut:
    """Record what a person did with this enquiry."""
    if body.status not in ENQUIRY_STATUSES:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "INVALID_STATUS",
                "message": f"status must be one of {sorted(ENQUIRY_STATUSES)}",
            },
        )

    enquiry, source = await _load(db, enquiry_id)
    allowed = ENQUIRY_TRANSITIONS[enquiry.status]
    if body.status not in allowed:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "INVALID_TRANSITION",
                "message": (
                    f"An enquiry in '{enquiry.status}' cannot move to "
                    f"'{body.status}'."
                ),
                "allowed": sorted(allowed),
            },
        )

    now = datetime.now(UTC)
    enquiry.status = body.status

    if body.status == "sent":
        enquiry.sent_at = now
        if body.contact_email:
            enquiry.contact_email = body.contact_email
    elif body.status == "reminded":
        enquiry.reminded_at = now
    elif body.status == "closed":
        enquiry.closed_at = now
        # Data minimisation: the address was held to write the letter, and the
        # letter is done. Name and ORCID stay, because attribution needs them.
        enquiry.contact_email = None

    await db.commit()
    enquiry, source = await _load(db, enquiry_id)
    return await _to_out(db, enquiry, source)


@router.post("/{enquiry_id}/response", response_model=EnquiryOut)
async def record_response(
    enquiry_id: uuid.UUID,
    body: EnquiryResponse,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_scope(ADMIN)),
) -> EnquiryOut:
    """Record the authors' answer and apply it to every record of this source."""
    enquiry, source = await _load(db, enquiry_id)

    if enquiry.status not in {"sent", "reminded"}:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "NOT_AWAITING_REPLY",
                "message": (
                    "A reply can only be recorded for an enquiry that was sent. "
                    f"This one is '{enquiry.status}'."
                ),
            },
        )

    license_row: License | None = None
    if body.response_license is not None:
        license_row = (
            await db.execute(
                select(License).where(License.spdx_id == body.response_license)
            )
        ).scalars().first()
        if license_row is None:
            known = (
                await db.execute(select(License.spdx_id).order_by(License.spdx_id))
            ).scalars().all()
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "UNKNOWN_LICENSE",
                    "message": f"Licence {body.response_license!r} is not in the vocabulary.",
                    "known_licenses": list(known),
                },
            )

    records = await _records_for(db, source.id)
    if not records:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "NO_RECORD",
                "message": "This enquiry's source has no catalogue record.",
            },
        )

    # One answer governs every record from that publication, which is the point
    # of keying enquiries on the source rather than on the record.
    await apply_response(
        db,
        enquiry=enquiry,
        records=records,
        source=source,
        declined=body.declined,
        response_license=license_row,
        note=body.note,
        evidence=body.evidence,
        opt_in=body.opt_in,
        contact_email=body.contact_email or enquiry.contact_email,
    )

    await db.commit()
    enquiry, source = await _load(db, enquiry_id)
    return await _to_out(db, enquiry, source)
