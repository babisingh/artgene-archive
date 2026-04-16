"""POST /api/v1/register — sequence registration endpoint.

Flow
----
1. Parse & normalise FASTA input → detect sequence type
2. Run consequence pipeline (all 3 gates, mock mode in dev/test)
3. If any gate FAILs → return status=FAILED immediately
4. Retrieve spreading key from vault
5. Encode TINSEL watermark (TINSELEncoder)
6. Build HybridCertificate with stub WOTS+ / LWE (Phase 7 wires real crypto)
7. Write to certificates table
8. Append tamper-evident entry to registry_audit_log
9. Return RegistrationResponse(status=CERTIFIED, registry_id=...)
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from tinsel.registry import (
    CertificateStatus,
    HostOrganism,
    HybridCertificate,
    LWECommitmentData,
    WOTSPublicKey,
    WOTSSignature,
)
from tinsel.sequence.fasta import normalise
from tinsel.watermark.tinsel_encoder import TINSELEncoder
from tinsel_gates.pipeline import run_consequence_pipeline

from sentinel_api.config import settings
from sentinel_api.db.connection import get_db
from sentinel_api.db.models import Certificate, Organisation, RegistryAuditLog
from sentinel_api.dependencies import require_api_key
from sentinel_api.vault import get_vault_client

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class RegistrationRequest(BaseModel):
    fasta: str
    owner_id: str
    ethics_code: str
    host_organism: HostOrganism = HostOrganism.ECOLI
    # org_id is intentionally NOT a client field — it is always derived from the
    # authenticated API key via Depends(require_api_key) to prevent spoofing.


class RegistrationResponse(BaseModel):
    status: CertificateStatus
    registry_id: str | None = None
    tier: str | None = None
    chi_squared: float | None = None
    consequence_report: dict | None = None
    message: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _entry_hash(seq_num: int, prev_hash: str, cert_hash: str) -> str:
    """SHA3-256 of the audit log entry fields (blockchain-style chaining)."""
    payload = f"{seq_num}|{prev_hash}|{cert_hash}".encode()
    return hashlib.sha3_256(payload).hexdigest()


async def _next_seq_num(db: AsyncSession) -> int:
    """Return the next sequential registry number (1-indexed)."""
    result = await db.execute(
        select(func.count()).select_from(RegistryAuditLog)
    )
    count = result.scalar_one()
    return count + 1


async def _prev_entry_hash(db: AsyncSession) -> str:
    """Return the ``entry_hash_hex`` of the most-recent audit entry, or zeros."""
    result = await db.execute(
        select(RegistryAuditLog.entry_hash_hex)
        .order_by(RegistryAuditLog.seq_num.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    return row if row is not None else "0" * 64


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/register", response_model=RegistrationResponse, status_code=201)
async def register_sequence(
    body: RegistrationRequest,
    db: AsyncSession = Depends(get_db),
    org: Organisation = Depends(require_api_key),
) -> RegistrationResponse:
    """Register a sequence and issue a TINSEL certificate if all gates pass."""

    # ── Step 1: Parse FASTA ───────────────────────────────────────────────
    try:
        _header, sequence, seq_type = normalise(body.fasta)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # For protein-only encoding use the sequence directly;
    # for DNA/RNA sequences we use the sequence as the "protein" placeholder
    # until a translator is wired (Phase 7).
    protein = sequence

    # ── Step 2: Consequence pipeline ──────────────────────────────────────
    report = await run_consequence_pipeline(
        protein=protein,
        dna=sequence if seq_type.value == "dna" else "",
        env=settings.sentinel_env,
        host_organism=body.host_organism.value,
    )
    report_dict = report.model_dump()

    from tinsel.models import GateStatus
    if report.overall_status == GateStatus.FAIL:
        return RegistrationResponse(
            status=CertificateStatus.FAILED,
            consequence_report=report_dict,
            message="One or more biosafety gates failed — registration rejected",
        )

    # ── Step 2b: Deduplication check ─────────────────────────────────────
    # Hash matches TINSELEncoder.sequence_hash(): SHA3-256 of uppercased protein.
    # We check before watermarking so a duplicate is rejected before spending
    # vault + ESMFold resources.  Do NOT reveal the existing registry_id in the
    # error — that would disclose another organisation's registered sequence.
    pre_hash = hashlib.sha3_256(protein.upper().encode()).hexdigest()
    dup_result = await db.execute(
        select(Certificate.id).where(Certificate.sequence_hash == pre_hash).limit(1)
    )
    if dup_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "SEQUENCE_ALREADY_REGISTERED",
                "message": (
                    "This sequence has already been registered in ArtGene Archive. "
                    "If you believe this is an error, contact support with your "
                    "ethics code and owner ID."
                ),
            },
        )

    # ── Step 3–4: Vault + watermark encoding (v1.0 API) ──────────────────
    vault = get_vault_client()
    spreading_key = await vault.get_spreading_key(settings.spreading_key_id)
    signing_key = await vault.get_signing_key(settings.spreading_key_id)

    now = datetime.now(UTC)
    seq_num = await _next_seq_num(db)
    year = now.year
    registry_id = f"AG-{year}-{seq_num:06d}"

    encoder = TINSELEncoder(
        spreading_key, settings.spreading_key_id, signing_key=signing_key
    )
    try:
        encode_result = encoder.encode_v1(
            protein,
            body.owner_id,
            now.isoformat(),
            body.ethics_code,
            organism=body.host_organism,
        )
    except ValueError as exc:
        return RegistrationResponse(
            status=CertificateStatus.FAILED,
            consequence_report=report_dict,
            message=f"Sequence cannot be watermarked: {exc}",
        )
    seq_hash = encoder.sequence_hash(protein)

    # ── Step 5: Stub WOTS+ / LWE (Phase 7 replaces these) ────────────────
    signed_material = hashlib.sha3_256(
        seq_hash.encode() + registry_id.encode()
    ).hexdigest()

    wots_pub = WOTSPublicKey.stub()
    wots_sig = WOTSSignature.stub(message_hash=signed_material)
    lwe_com = LWECommitmentData.stub()

    # ── Step 6: Certificate hash ──────────────────────────────────────────
    cert_fields = {
        "registry_id": registry_id,
        "owner_id": body.owner_id,
        "org_id": str(org.id),
        "ethics_code": body.ethics_code,
        "sequence_hash": seq_hash,
        "timestamp": now.isoformat(),
        "watermark_id": encode_result.watermark_id,
        "tier": encode_result.config.tier.value,
        "chi_squared": encode_result.codon_bias_metrics.chi_squared,
    }
    cert_hash = HybridCertificate.compute_hash(cert_fields)

    # ── Steps 7 + 8: Write certificate + audit log atomically ────────────
    # Both objects are added to the same session and committed together so
    # they either both land in the database or both roll back.  No flush()
    # between them — registry_id is generated in Python, not by a DB sequence,
    # so there is nothing to flush for ID generation purposes.
    cert = Certificate(
        id=registry_id,
        org_id=org.id,
        sequence_hash=seq_hash,
        owner_id=body.owner_id,
        ethics_code=body.ethics_code,
        sequence_type=seq_type.value,
        host_organism=body.host_organism.value,
        timestamp=now,
        watermark_metadata=encode_result.model_dump(),
        wots_public_key=wots_pub.model_dump(),
        wots_signature=wots_sig.model_dump(),
        lwe_commitment=lwe_com.model_dump(),
        consequence_report=report_dict,
        certificate_hash=cert_hash,
        status=CertificateStatus.CERTIFIED.value,
        chi_squared=encode_result.codon_bias_metrics.chi_squared,
        tier=encode_result.config.tier.value,
    )
    db.add(cert)

    prev_hash = await _prev_entry_hash(db)
    entry_hash = _entry_hash(seq_num, prev_hash, cert_hash)

    log_entry = RegistryAuditLog(
        id=uuid.uuid4(),
        seq_num=seq_num,
        prev_hash_hex=prev_hash,
        certificate_hash=cert_hash,
        entry_hash_hex=entry_hash,
        registry_id=registry_id,
        timestamp=now,
    )
    db.add(log_entry)

    # Explicit commit — do not rely on the get_db() teardown so the caller
    # can be certain both rows are durable before the response is returned.
    await db.commit()

    return RegistrationResponse(
        status=CertificateStatus.CERTIFIED,
        registry_id=registry_id,
        tier=encode_result.config.tier.value,
        chi_squared=encode_result.codon_bias_metrics.chi_squared,
        consequence_report=report_dict,
        message=f"Sequence certified — {registry_id}",
    )
