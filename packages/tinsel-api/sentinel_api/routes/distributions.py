"""Provenance Tracing — per-recipient fingerprint issuance and verification.

Endpoints
---------
POST /sequences/{id}/distributions   — issue a fingerprinted copy to a recipient
GET  /sequences/{id}/distributions   — list all issued copies for a sequence
POST /verify-source                  — identify which issued copy a sequence came from
"""

from __future__ import annotations

import hashlib
import hmac
import io
import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tinsel.registry import HostOrganism
from tinsel.sequence.fasta import normalise
from tinsel.watermark.encoder import CODON_POOLS
from tinsel.watermark.tinsel_encoder import TINSELEncoder

from sentinel_api.config import settings
from sentinel_api.db.connection import get_db
from sentinel_api.db.models import Certificate, Organisation, SequenceDistribution
from sentinel_api.dependencies import require_api_key
from sentinel_api.vault import get_vault_client

router = APIRouter()

_VALID_PURPOSES = frozenset({"cmo", "collaboration", "validation", "other"})

_HOST_ORGANISM_ENUM = {
    "ECOLI": HostOrganism.ECOLI,
    "HUMAN": HostOrganism.HUMAN,
    "YEAST": HostOrganism.YEAST,
    "CHO":   HostOrganism.CHO,
    "INSECT": HostOrganism.INSECT,
    "PLANT":  HostOrganism.PLANT,
}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class IssueRequest(BaseModel):
    recipient_name: str
    recipient_org: str
    recipient_email: str | None = None
    purpose: str = "other"
    host_organism: str = "ECOLI"

    @field_validator("purpose")
    @classmethod
    def _valid_purpose(cls, v: str) -> str:
        v = v.lower().strip()
        if v not in _VALID_PURPOSES:
            raise ValueError(f"purpose must be one of: {sorted(_VALID_PURPOSES)}")
        return v

    @field_validator("host_organism")
    @classmethod
    def _valid_host(cls, v: str) -> str:
        v = v.upper().strip()
        if v not in _HOST_ORGANISM_ENUM:
            raise ValueError(f"host_organism must be one of: {sorted(_HOST_ORGANISM_ENUM)}")
        return v


class DistributionSummary(BaseModel):
    id: str
    sequence_id: str
    recipient_name: str
    recipient_org: str
    recipient_email: str | None
    purpose: str
    host_organism: str
    issued_at: str
    revoked_at: str | None
    fingerprint_id: str


class VerifyRequest(BaseModel):
    fasta: str


class VerifyResponse(BaseModel):
    match_found: bool
    sequence_id: str | None = None
    recipient_name: str | None = None
    recipient_org: str | None = None
    purpose: str | None = None
    issued_at: str | None = None
    fingerprint_id: str | None = None
    message: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _derive_fingerprint_seed(spreading_key: bytes, sequence_id: str, fingerprint_id: str) -> bytes:
    """HMAC-SHA3-256 seed unique to one (sequence, recipient) pair."""
    label = f"provenance-dist:{sequence_id}:{fingerprint_id}".encode()
    return hmac.digest(spreading_key, label, hashlib.sha3_256)


def _get_cert_protein(cert: Certificate) -> str:
    """Extract the original protein from a certificate's stored metadata."""
    meta = cert.watermark_metadata or {}
    return meta.get("original_protein", "")


async def _get_own_cert(
    sequence_id: str, org: Organisation, db: AsyncSession
) -> Certificate:
    """Fetch a certificate and verify the requesting org owns it."""
    result = await db.execute(
        select(Certificate).where(Certificate.id == sequence_id)
    )
    cert = result.scalars().first()
    if cert is None:
        raise HTTPException(status_code=404, detail="Sequence not found.")
    if cert.org_id != org.id:
        raise HTTPException(status_code=403, detail="This sequence belongs to a different organisation.")
    return cert


def _fingerprinted_fasta(
    protein: str,
    sequence_id: str,
    recipient_name: str,
    recipient_org: str,
    fingerprint_id: str,
    fingerprint_seed: bytes,
    host_organism: str,
    spreading_key_id: str,
    signing_key: bytes,
    issued_at: datetime,
) -> str:
    """Generate a fingerprinted FASTA string for one recipient.

    Uses fixed encoding parameters (fingerprint_id, sequence_id) so that
    verification can reproduce the exact same codon pattern deterministically
    from the stored issuance record.
    """
    host_enum = _HOST_ORGANISM_ENUM.get(host_organism, HostOrganism.ECOLI)
    encoder = TINSELEncoder(fingerprint_seed, spreading_key_id, signing_key=signing_key)
    # Use fingerprint_id as ethics_code and sequence_id as owner_id so that
    # verification can replay the encoding without a stored timestamp.
    try:
        result = encoder.encode_v1(
            protein,
            owner_id=sequence_id,
            timestamp_str="provenance-v1",
            ethics_code=fingerprint_id,
            organism=host_enum,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    ts_str = issued_at.isoformat()
    header = (
        f">ArtGene-Provenance | seq={sequence_id} | recipient={recipient_name} "
        f"| org={recipient_org} | fingerprint={fingerprint_id} | issued={ts_str}"
    )
    dna = result.dna_sequence
    wrapped = "\n".join(dna[i : i + 60] for i in range(0, len(dna), 60))
    return f"{header}\n{wrapped}\n"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/sequences/{sequence_id}/distributions", status_code=201)
async def issue_distribution_copy(
    sequence_id: str,
    body: IssueRequest,
    db: AsyncSession = Depends(get_db),
    org: Organisation = Depends(require_api_key),
) -> StreamingResponse:
    """Issue a fingerprinted FASTA copy to a named recipient.

    Returns the codon-fingerprinted FASTA as a file download.
    A record of the issuance is stored; the fingerprinted sequence itself
    is not stored — only the seed needed to re-verify it later.
    """
    cert = await _get_own_cert(sequence_id, org, db)
    protein = _get_cert_protein(cert)
    if not protein:
        raise HTTPException(
            status_code=422,
            detail="Cannot generate distribution copy: original sequence data unavailable.",
        )

    vault = get_vault_client()
    spreading_key = await vault.get_spreading_key(settings.spreading_key_id)
    signing_key   = await vault.get_signing_key(settings.spreading_key_id)

    fingerprint_id = f"dist-{uuid.uuid4().hex[:12]}"
    seed = _derive_fingerprint_seed(spreading_key, sequence_id, fingerprint_id)
    issued_at = datetime.now(UTC)

    fasta_content = _fingerprinted_fasta(
        protein=protein,
        sequence_id=sequence_id,
        recipient_name=body.recipient_name,
        recipient_org=body.recipient_org,
        fingerprint_id=fingerprint_id,
        fingerprint_seed=seed,
        host_organism=body.host_organism,
        spreading_key_id=settings.spreading_key_id,
        signing_key=signing_key,
        issued_at=issued_at,
    )

    dist = SequenceDistribution(
        id=uuid.uuid4(),
        sequence_id=sequence_id,
        org_id=org.id,
        recipient_name=body.recipient_name,
        recipient_org=body.recipient_org,
        recipient_email=body.recipient_email,
        purpose=body.purpose,
        fingerprint_id=fingerprint_id,
        fingerprint_seed_hex=seed.hex(),
        host_organism=body.host_organism,
        issued_at=issued_at,
    )
    db.add(dist)
    await db.commit()

    filename = f"{sequence_id}-{fingerprint_id}.fasta"
    return StreamingResponse(
        io.BytesIO(fasta_content.encode()),
        status_code=201,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/sequences/{sequence_id}/distributions", response_model=list[DistributionSummary])
async def list_distributions(
    sequence_id: str,
    db: AsyncSession = Depends(get_db),
    org: Organisation = Depends(require_api_key),
) -> list[DistributionSummary]:
    """List all distribution copies issued for a sequence."""
    await _get_own_cert(sequence_id, org, db)

    result = await db.execute(
        select(SequenceDistribution)
        .where(
            SequenceDistribution.sequence_id == sequence_id,
            SequenceDistribution.org_id == org.id,
        )
        .order_by(SequenceDistribution.issued_at.desc())
    )
    rows = result.scalars().all()
    return [
        DistributionSummary(
            id=str(r.id),
            sequence_id=r.sequence_id,
            recipient_name=r.recipient_name,
            recipient_org=r.recipient_org,
            recipient_email=r.recipient_email,
            purpose=r.purpose,
            host_organism=r.host_organism,
            issued_at=r.issued_at.isoformat(),
            revoked_at=r.revoked_at.isoformat() if r.revoked_at else None,
            fingerprint_id=r.fingerprint_id,
        )
        for r in rows
    ]


@router.post("/verify-source", response_model=VerifyResponse)
async def verify_source(
    body: VerifyRequest,
    db: AsyncSession = Depends(get_db),
    org: Organisation = Depends(require_api_key),
) -> VerifyResponse:
    """Identify which issued distribution copy a submitted sequence came from.

    Checks the submitted FASTA against all fingerprints issued by the
    authenticated organisation and returns the matching issuance record,
    if any.
    """
    try:
        _header, sequence, seq_type = normalise(body.fasta)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # Accept DNA (fingerprinted copies are DNA) or protein
    if seq_type.value == "dna":
        submitted_dna = sequence.upper()
        # Translate to protein to find the base sequence in our registry
        from tinsel.watermark.encoder import _CODON_TO_AA
        if len(submitted_dna) % 3 != 0:
            raise HTTPException(status_code=422, detail="DNA length must be a multiple of 3.")
        try:
            protein = "".join(
                _CODON_TO_AA[submitted_dna[i : i + 3]]
                for i in range(0, len(submitted_dna), 3)
                if _CODON_TO_AA.get(submitted_dna[i : i + 3], "*") != "*"
            )
        except KeyError as exc:
            raise HTTPException(status_code=422, detail=f"Invalid codon: {exc}") from exc
    else:
        raise HTTPException(
            status_code=422,
            detail="Please submit the DNA sequence of the distribution copy, not a protein.",
        )

    # Find the registered certificate for this protein
    seq_hash = hashlib.sha3_256(protein.upper().encode()).hexdigest()
    cert_result = await db.execute(
        select(Certificate).where(
            Certificate.sequence_hash == seq_hash,
            Certificate.org_id == org.id,
        )
    )
    cert = cert_result.scalars().first()
    if cert is None:
        return VerifyResponse(
            match_found=False,
            message="No registered sequence in your organisation matches this protein.",
        )

    # Load all distributions for this certificate
    dist_result = await db.execute(
        select(SequenceDistribution).where(
            SequenceDistribution.sequence_id == cert.id,
            SequenceDistribution.org_id == org.id,
            SequenceDistribution.revoked_at.is_(None),
        )
    )
    distributions = dist_result.scalars().all()
    if not distributions:
        return VerifyResponse(
            match_found=False,
            message="No distribution copies have been issued for this sequence.",
        )

    vault = get_vault_client()
    spreading_key = await vault.get_spreading_key(settings.spreading_key_id)
    signing_key   = await vault.get_signing_key(settings.spreading_key_id)

    # Try to regenerate each fingerprinted copy and compare with the submitted DNA
    original_protein = _get_cert_protein(cert)
    if not original_protein:
        return VerifyResponse(
            match_found=False,
            message="Cannot verify: original sequence data unavailable.",
        )

    for dist in distributions:
        seed = bytes.fromhex(dist.fingerprint_seed_hex)
        host_enum = _HOST_ORGANISM_ENUM.get(dist.host_organism, HostOrganism.ECOLI)
        encoder = TINSELEncoder(seed, settings.spreading_key_id, signing_key=signing_key)
        try:
            # Must use the same fixed parameters as _fingerprinted_fasta()
            result = encoder.encode_v1(
                original_protein,
                owner_id=cert.id,
                timestamp_str="provenance-v1",
                ethics_code=dist.fingerprint_id,
                organism=host_enum,
            )
        except ValueError:
            continue

        if result.dna_sequence.upper() == submitted_dna:
            return VerifyResponse(
                match_found=True,
                sequence_id=cert.id,
                recipient_name=dist.recipient_name,
                recipient_org=dist.recipient_org,
                purpose=dist.purpose,
                issued_at=dist.issued_at.isoformat(),
                fingerprint_id=dist.fingerprint_id,
                message=(
                    f"Match found: this copy was issued to {dist.recipient_name} "
                    f"({dist.recipient_org}) on {dist.issued_at.date()}."
                ),
            )

    return VerifyResponse(
        match_found=False,
        message=(
            "No fingerprint match found among your issued copies. "
            "The sequence may have been independently synthesised or the fingerprint stripped."
        ),
    )
