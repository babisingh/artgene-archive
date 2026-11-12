"""Deciding when to ask the authors, and what the letter says.

Kept out of the route modules so the catalogue ingest path and the enquiry
endpoints can both use it without importing each other.

There is no code here, or anywhere in this package, that sends anything. The
letter is rendered as text for a person to read and send from their own mail
client. tests/test_no_send_path.py fails if a mail library ever appears.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sentinel_api.config import settings
from sentinel_api.db.catalogue import (
    CatalogueRecord,
    ExternalAccession,
    License,
    Source,
    SourceAuthor,
)
from sentinel_api.db.enquiry import DoNotContact, LicenseEnquiry, email_fingerprint

#: Biosafety classes for which no enquiry is ever opened. Writing to a group to
#: ask for a hazardous sequence under a friendlier licence is the wrong letter
#: to send, and the archive would not host the answer anyway.
NO_ENQUIRY_BIOSAFETY = frozenset({"elevated", "restricted"})


def pepper() -> bytes:
    """Server-held secret for suppression fingerprints.

    Derived from the configured spreading key. ``email_fingerprint`` domain
    separates its use with a prefix, so this never collides with the watermark
    use of the same secret.
    """
    return bytes.fromhex(settings.spreading_key)


def resolution_for(data_license: License | None) -> str:
    """How the archive knows what it knows about this licence."""
    if data_license is None or data_license.spdx_id == "UNSTATED":
        return "unstated"
    if data_license.allows_redistribution:
        return "stated_permissive"
    return "stated_restrictive"


def hosting_for(resolution: str, biosafety_class: str, spdx_id: str | None) -> tuple[str, str]:
    """Return (hosting_decision, reason) for a resolution.

    Mirrors the trigger on sequence_blobs, which is the actual control. This is
    the explanation, recorded in words so the decision is answerable later
    without being re-derived.
    """
    if biosafety_class == "restricted":
        return (
            "withheld",
            "Biosafety class restricted: sequence data is not stored, whatever "
            "the licence permits.",
        )
    if resolution == "author_declined":
        return (
            "withheld",
            "The authors asked not to be included. The record is reduced to a "
            "citation.",
        )
    if resolution == "unstated":
        return (
            "metadata_only",
            "No data licence stated. An unstated licence is not a permissive "
            "one, so accessions and checksums only.",
        )
    if resolution == "stated_restrictive":
        return (
            "metadata_only",
            f"Licence {spdx_id} does not permit redistribution: accessions and "
            "checksums only.",
        )
    return (
        "hosted",
        f"Licence {spdx_id} permits redistribution with attribution.",
    )


async def _corresponding_author(
    db: AsyncSession, source_id: uuid.UUID
) -> SourceAuthor | None:
    """The author to write to: the corresponding one, else the first listed."""
    authors = (
        await db.execute(
            select(SourceAuthor)
            .where(SourceAuthor.source_id == source_id)
            .order_by(SourceAuthor.position)
        )
    ).scalars().all()
    if not authors:
        return None
    for author in authors:
        if author.is_corresponding:
            return author
    return authors[0]


async def _is_suppressed(db: AsyncSession, author: SourceAuthor | None) -> bool:
    """True if this person has asked not to be contacted again."""
    if author is None or not author.orcid:
        return False
    hit = (
        await db.execute(
            select(DoNotContact.id).where(DoNotContact.orcid == author.orcid)
        )
    ).scalars().first()
    return hit is not None


async def maybe_open_enquiry(
    db: AsyncSession, record: CatalogueRecord
) -> LicenseEnquiry | None:
    """Queue an enquiry for *record*'s source, if one is warranted.

    Returns the existing enquiry when the paper already has one, so a second
    record from the same publication does not generate a second letter.

    Note what is not stored: no email address. The agent has no business
    collecting one, and the operator adds it when they work the queue. Name and
    ORCID are already held for attribution.
    """
    if record.biosafety_class in NO_ENQUIRY_BIOSAFETY:
        return None

    existing = (
        await db.execute(
            select(LicenseEnquiry).where(LicenseEnquiry.source_id == record.source_id)
        )
    ).scalars().first()
    if existing is not None:
        return existing

    reason: str | None = None
    if record.license_resolution == "unstated":
        reason = "unstated"
    elif record.license_resolution == "ambiguous":
        reason = "ambiguous"
    elif record.license_resolution == "stated_permissive":
        # The licence allows redistribution but the authors deposited nothing,
        # so there is no data to host. Worth asking, and the most valuable kind
        # of enquiry: the sequences are not anywhere yet.
        deposited = (
            await db.execute(
                select(ExternalAccession.id).where(
                    ExternalAccession.record_id == record.id
                )
            )
        ).scalars().first()
        if deposited is None:
            reason = "no_data_deposited"

    if reason is None:
        return None

    author = await _corresponding_author(db, record.source_id)
    if await _is_suppressed(db, author):
        return None

    enquiry = LicenseEnquiry(
        source_id=record.source_id,
        reason=reason,
        status="queued",
        contact_name=author.full_name if author else None,
        contact_orcid=author.orcid if author else None,
    )
    db.add(enquiry)
    await db.flush()
    return enquiry


def render_letter(
    *,
    record: CatalogueRecord,
    source: Source,
    enquiry: LicenseEnquiry,
    sender: str,
) -> str:
    """Render the draft letter as plain text, for a person to read and send.

    Says what was recorded, what was not copied, and how to decline. The
    decline offer is deliberately citation-only rather than deletion: a bare
    citation is what any literature review contains, so there is nothing to
    object to, and the index does not become a sample of agreeable
    laboratories.
    """
    name = enquiry.contact_name or "colleague"
    venue = source.container or "a preprint server"
    published = source.published_on.isoformat() if source.published_on else "recently"

    if enquiry.reason == "no_data_deposited":
        situation = (
            "We have not copied your sequence data, because the paper does not "
            "point to a deposit of it."
        )
        first_question = (
            "1. Are the designed sequences deposited anywhere we should link to, "
            "and under what licence may they be redistributed?"
        )
    else:
        situation = (
            "We have not copied your sequence data: the paper states no licence "
            "for it, so the record holds accessions, lengths and checksums only."
        )
        first_question = (
            "1. Under what licence may the designed sequences from this work be "
            "redistributed? If the answer is that they may not, the record stays "
            "as it is, metadata only."
        )

    return f"""Subject: ArtGene Archive record for {record.title}

Dear {name},

I am writing about "{source.title}", {venue}, {published}.

ArtGene Archive is a public index of AI designed protein and nucleic acid
sequences that have been built and tested in a laboratory. Your paper is
recorded as {record.id}, crediting you and your co-authors, with a link to the
original. {situation}

Two questions, if you have a moment.

{first_question}
2. Would you like the sequences themselves included? A deposited record keeps
   your attribution and a permanent identifier, under whichever licence you
   choose, and you can ask for it to be withdrawn at any time.

If you would rather not be involved, reply saying so and the record will be
reduced to a plain citation, title, authors and a link, and you will not be
contacted again.

{sender}
ArtGene Archive, artgene-archive.org
"""


async def apply_response(
    db: AsyncSession,
    *,
    enquiry: LicenseEnquiry,
    records: list[CatalogueRecord],
    source: Source,
    declined: bool,
    response_license: License | None,
    note: str | None,
    evidence: str,
    opt_in: bool | None,
    contact_email: str | None,
) -> None:
    """Record what the authors said, and apply it to every record of the source.

    One answer governs the whole publication, which is why enquiries are keyed
    on the source. Suppression is added once, not once per record: the
    do_not_contact table is unique on ORCID, and a paper with several records
    would otherwise collide with itself.

    On a decline each record is reduced to a citation and the person is added
    to the suppression list, which outlives this enquiry. Otherwise their stated
    licence becomes the archive's permission to hold the data, and
    ``stored_because`` on any blob can cite this enquiry by id.
    """
    spdx = response_license.spdx_id if response_license is not None else None

    # ── enquiry-level effects, applied once ───────────────────────────────
    enquiry.response_license = spdx
    enquiry.response_note = note
    enquiry.response_evidence = evidence
    enquiry.status = "replied"
    enquiry.replied_at = datetime.now(UTC)
    enquiry.opt_in = False if declined else opt_in

    if declined:
        await _suppress(db, enquiry, contact_email)
    elif response_license is not None:
        source.data_license = spdx

    # ── per-record effects ────────────────────────────────────────────────
    for record in records:
        record.license_resolution = (
            "author_declined" if declined else "author_confirmed"
        )
        if declined:
            record.citation_only = True
        decision, reason = hosting_for(
            record.license_resolution, record.biosafety_class, spdx
        )
        record.hosting_decision = decision
        record.hosting_reason = (
            f"{reason} Recorded from enquiry {enquiry.id}: {evidence}"
        )


async def _suppress(
    db: AsyncSession, enquiry: LicenseEnquiry, contact_email: str | None
) -> None:
    """Add this person to the do-not-contact list, if not already on it."""
    fingerprint = (
        email_fingerprint(contact_email, pepper()) if contact_email else None
    )
    if enquiry.contact_orcid:
        already = (
            await db.execute(
                select(DoNotContact.id).where(
                    DoNotContact.orcid == enquiry.contact_orcid
                )
            )
        ).scalars().first()
        if already is not None:
            return
    elif fingerprint is not None:
        already = (
            await db.execute(
                select(DoNotContact.id).where(DoNotContact.email_hmac == fingerprint)
            )
        ).scalars().first()
        if already is not None:
            return
    elif fingerprint is None:
        # Nothing to key suppression on. The decline still applies to the
        # records; there is simply no identifier to remember.
        return

    db.add(
        DoNotContact(
            orcid=enquiry.contact_orcid,
            email_hmac=fingerprint,
            reason="declined",
        )
    )
