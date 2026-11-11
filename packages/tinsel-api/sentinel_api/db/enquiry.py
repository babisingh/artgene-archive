"""Licence enquiries: turning an unstated licence into a question.

An unstated licence is the commonest case and the most wasteful one. The data
may well be shareable and nobody has been asked. So `UNSTATED` opens an enquiry
rather than closing the question, and the archive asks permission instead of
assuming it.

Four rules, in descending order of how much they matter. The first is enforced
by the absence of any mail code in this package, and
tests/test_no_send_path.py fails if that ever changes:

1. No agent ever sends an email. The pipeline detects, queues and drafts a
   letter. A person reads it and sends it from their own mail client.
2. Never enquire about a record whose biosafety class is elevated or
   restricted. Writing to a group to ask for a hazardous sequence under a
   friendlier licence is the wrong letter to send, and the archive would not
   host the answer anyway.
3. One enquiry per paper, one reminder, then stop. The uniqueness constraint
   makes the first mechanical; `reminded_at` makes the second visible when it
   slips.
4. Declining never costs the authors their citation, and never costs the index
   its coverage. An objection reduces a record to a bare citation rather than
   deleting it, so the archive does not become a sample of agreeable
   laboratories.

ARCHITECTURE.md section 8 has the reasoning and the draft letter.
"""

from __future__ import annotations

import hashlib
import hmac
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from sentinel_api.db.catalogue import LICENSE_RESOLUTIONS, _in
from sentinel_api.db.models import Base

# ---------------------------------------------------------------------------
# Vocabularies
# ---------------------------------------------------------------------------

#: Why an enquiry was opened. Only `unstated` and `no_data_deposited` are
#: raised automatically: a licence that explicitly forbids redistribution is
#: settled, and asking again would be pestering the authors to change their
#: minds.
ENQUIRY_REASONS = ("unstated", "ambiguous", "conflicting", "no_data_deposited")

ENQUIRY_STATUSES = (
    "queued",      # detected, nothing written yet
    "drafted",     # a letter has been generated for a person to read
    "sent",        # a person sent it
    "reminded",    # one reminder, and only one
    "replied",     # the authors answered
    "no_response", # closed without an answer
    "closed",      # resolved, either way
)

__all__ = [
    "LICENSE_RESOLUTIONS",
    "ENQUIRY_REASONS",
    "ENQUIRY_STATUSES",
    "DO_NOT_CONTACT_REASONS",
    "LicenseEnquiry",
    "DoNotContact",
    "email_fingerprint",
]

DO_NOT_CONTACT_REASONS = ("declined", "requested", "bounced", "other")


def email_fingerprint(email: str, pepper: bytes) -> str:
    """Return a peppered HMAC of *email*, for suppression without retention.

    The address itself is held only while an enquiry is open and purged when it
    closes, but "have we already written to this person" still has to be
    answerable afterwards. An HMAC under a server-held pepper answers it without
    keeping the address, and is domain separated from every other use of the
    same secret by the prefix below.
    """
    normalised = email.strip().lower().encode("utf-8")
    return hmac.new(pepper, b"do-not-contact:" + normalised, hashlib.sha3_256).hexdigest()


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------

class LicenseEnquiry(Base):
    """One enquiry per publication, never per record.

    A paper with forty designed sequences gets one letter. The uniqueness
    constraint on source_id is what guarantees that, rather than a check
    somewhere in the ingest code that a later caller could bypass.
    """

    __tablename__ = "license_enquiries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sources.id"), nullable=False
    )
    reason: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued")

    # Contact details. Name and ORCID stay, because attribution needs them
    # regardless. The address is held only while the enquiry is open.
    contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_orcid: Mapped[str | None] = mapped_column(String(32), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="Purged when the enquiry closes"
    )

    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reminded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    replied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    response_license: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("licenses.spdx_id"), nullable=True
    )
    response_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_evidence: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="How we know, e.g. 'email of 2026-11-20, quoted verbatim'",
    )
    opt_in: Mapped[bool | None] = mapped_column(
        Boolean, nullable=True, comment="Did the authors want the sequences included"
    )

    __table_args__ = (
        UniqueConstraint("source_id", name="uq_enquiry_per_source"),
        _in("reason", ENQUIRY_REASONS, "ck_enquiry_reason"),
        _in("status", ENQUIRY_STATUSES, "ck_enquiry_status"),
    )


class DoNotContact(Base):
    """People the archive must not write to again.

    Survives both record withdrawal and the purging of an enquiry's address,
    which is the point: a suppression list that disappears with the data it
    suppresses is not a suppression list.
    """

    __tablename__ = "do_not_contact"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    orcid: Mapped[str | None] = mapped_column(String(32), nullable=True, unique=True)
    email_hmac: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    reason: Mapped[str] = mapped_column(String(32), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (_in("reason", DO_NOT_CONTACT_REASONS, "ck_dnc_reason"),)
