"""POST /api/v1/register — sequence registration endpoint.

Flow
----
1. Parse & normalise FASTA input → detect sequence type
2. Run consequence pipeline (all 4 gates, mock mode in dev/test)
3. If any gate FAILs → return status=FAILED immediately
4. Retrieve vault keys for WOTS+ post-quantum signing
5. Build HybridCertificate with stub WOTS+ / LWE (Phase 7 wires real crypto)
6. Write to certificates table
7. Append tamper-evident entry to registry_audit_log
8. Return RegistrationResponse(status=CERTIFIED, registry_id=...)
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from tinsel.crypto import PQSigner
from tinsel.registry import (
    CertificateStatus,
    HostOrganism,
    HybridCertificate,
    LWECommitmentData,
    WOTSPublicKey,
    WOTSSignature,
)
from tinsel.sequence.fasta import normalise
from tinsel_gates.pipeline import run_consequence_pipeline

from sentinel_api.config import settings
from sentinel_api.db.connection import get_db
from sentinel_api.db.models import Certificate, FragmentKmerIndex, Organisation, RegistryAuditLog
from sentinel_api.dependencies import require_api_key
from sentinel_api.rate_limit import rate_limit_write
from sentinel_api.vault import get_vault_client

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

_VALID_VISIBILITIES = frozenset({"public", "embargoed"})


class RegistrationRequest(BaseModel):
    fasta: str
    owner_id: str
    ethics_code: str
    host_organism: HostOrganism = HostOrganism.ECOLI
    visibility: str = "public"
    # org_id is intentionally NOT a client field — it is always derived from the
    # authenticated API key via Depends(require_api_key) to prevent spoofing.


class RegistrationResponse(BaseModel):
    status: CertificateStatus
    registry_id: str | None = None
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
# Fragment assembly risk helpers
# ---------------------------------------------------------------------------

_KMER_SIZE = 20
_KMER_STEP = 3      # stride — balances index size vs detection sensitivity
_KMER_MAX_LEN = 1_500   # only index sequences ≤ 1,500 AA (synthesis-scale fragments)


def _kmer_hashes(sequence: str) -> set[str]:
    """SHA3-256 hashes of all overlapping 20-mers (step=3) in *sequence*."""
    seq = sequence.upper()
    result: set[str] = set()
    for i in range(0, len(seq) - _KMER_SIZE + 1, _KMER_STEP):
        result.add(hashlib.sha3_256(seq[i : i + _KMER_SIZE].encode()).hexdigest())
    return result


async def _check_fragment_assembly_risk(
    db: AsyncSession, sequence: str, env: str
) -> None:
    """Raise HTTP 422 if *sequence* + any archived sequence assembles into a dangerous product.

    Only checks sequences ≤ _KMER_MAX_LEN AA (longer sequences are not synthesis fragments).
    The error message never reveals which archived sequence was involved.
    """
    if len(sequence) > _KMER_MAX_LEN:
        return

    hashes = _kmer_hashes(sequence)
    if not hashes:
        return

    match_result = await db.execute(
        select(FragmentKmerIndex.registry_id)
        .where(FragmentKmerIndex.kmer_hash.in_(list(hashes)))
        .distinct()
        .limit(10)
    )
    matching_ids = [row[0] for row in match_result.fetchall()]
    if not matching_ids:
        return

    from tinsel.fragment import Fragment, assemble, find_overlaps
    from tinsel.models import GateStatus

    for registry_id in matching_ids:
        cert_res = await db.execute(
            select(Certificate).where(Certificate.id == registry_id)
        )
        archived = cert_res.scalars().first()
        if not archived:
            continue

        archived_seq: str = (archived.watermark_metadata or {}).get("original_protein", "")
        if not archived_seq or archived_seq.upper() == sequence.upper():
            continue

        frags = [Fragment("new", sequence), Fragment("archived", archived_seq)]
        overlaps = find_overlaps(frags, min_overlap=_KMER_SIZE)
        if not overlaps:
            continue

        contigs = assemble(frags, overlaps)
        for contig in contigs:
            report = await run_consequence_pipeline(
                protein=contig,
                dna="",
                env=env,
                run_gates=(2, 4),
            )
            if report.overall_status == GateStatus.FAIL:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "code": "FRAGMENT_ASSEMBLY_RISK",
                        "message": (
                            "Your sequence, when combined with a sequence already in "
                            "the archive, assembles into a product that fails biosafety "
                            "screening. Registration rejected."
                        ),
                    },
                )


def _add_kmer_index_rows(
    db: AsyncSession,
    registry_id: str,
    org_id: uuid.UUID,
    sequence: str,
) -> None:
    """Add k-mer index rows for *sequence* to the session (not yet committed)."""
    if len(sequence) > _KMER_MAX_LEN:
        return

    seen: set[str] = set()
    seq = sequence.upper()
    for i in range(0, len(seq) - _KMER_SIZE + 1, _KMER_STEP):
        h = hashlib.sha3_256(seq[i : i + _KMER_SIZE].encode()).hexdigest()
        if h not in seen:
            seen.add(h)
            db.add(FragmentKmerIndex(
                id=uuid.uuid4(),
                registry_id=registry_id,
                org_id=org_id,
                kmer_hash=h,
            ))


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/register", response_model=RegistrationResponse, status_code=201)
@rate_limit_write
async def register_sequence(
    request: Request,
    body: RegistrationRequest,
    db: AsyncSession = Depends(get_db),
    org: Organisation = Depends(require_api_key),
) -> RegistrationResponse:
    """Register a sequence and issue a certificate if all biosafety gates pass."""

    # ── Step 0: Validate visibility ───────────────────────────────────────
    if body.visibility not in _VALID_VISIBILITIES:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "INVALID_VISIBILITY",
                "message": (
                    f"visibility must be one of: {sorted(_VALID_VISIBILITIES)}. "
                    f"Got: {body.visibility!r}"
                ),
            },
        )

    # ── Step 1: Parse FASTA ───────────────────────────────────────────────
    try:
        _header, sequence, seq_type = normalise(body.fasta)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # For protein-only encoding use the sequence directly;
    # for DNA/RNA sequences we use the sequence as the "protein" placeholder
    # until a translator is wired (Phase 7).
    protein = sequence

    # ── Step 1b: Length cap ───────────────────────────────────────────────
    _MAX_AA = 5000
    if len(protein) > _MAX_AA:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "SEQUENCE_TOO_LONG",
                "message": (
                    f"Sequence length {len(protein):,} AA exceeds the maximum of "
                    f"{_MAX_AA:,} AA. Trim your sequence or contact support for "
                    "bulk registration options."
                ),
            },
        )

    # ── Step 1c: Fragment assembly cross-check ────────────────────────────
    # Checks new sequence against the k-mer index of all archived sequences.
    # Raises HTTP 422 (FRAGMENT_ASSEMBLY_RISK) without revealing which
    # archived sequence caused the match.
    await _check_fragment_assembly_risk(db, protein, settings.sentinel_env)

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
    _warn_only = report.overall_status == GateStatus.WARN

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

    # ── Step 3: Vault keys for post-quantum signing ───────────────────────
    vault = get_vault_client()
    spreading_key = await vault.get_spreading_key(settings.spreading_key_id)

    now = datetime.now(UTC)
    seq_num = await _next_seq_num(db)
    year = now.year
    registry_id = f"AG-{year}-{seq_num:06d}"

    # seq_hash already computed above as pre_hash
    seq_hash = pre_hash

    # ── Step 4: Post-quantum WOTS+ signing ───────────────────────────────
    lwe_com = LWECommitmentData.stub()  # LWE: Phase 4

    # ── Step 5: Certificate hash ──────────────────────────────────────────
    cert_fields = {
        "registry_id": registry_id,
        "owner_id": body.owner_id,
        "org_id": str(org.id),
        "ethics_code": body.ethics_code,
        "sequence_hash": seq_hash,
        "timestamp": now.isoformat(),
    }
    cert_hash = HybridCertificate.compute_hash(cert_fields)

    # PQSigner derives a per-certificate keypair from (spreading_key, registry_id).
    pq_signer = PQSigner(master_seed=spreading_key)
    pk_dict, sig_dict = pq_signer.sign_certificate(registry_id, cert_hash)
    wots_pub = WOTSPublicKey(**pk_dict)
    wots_sig = WOTSSignature(**sig_dict)

    # ── Steps 6 + 7: Write certificate + audit log atomically ────────────
    # Store the original_protein in watermark_metadata for fragment assembly
    # cross-checks (see _check_fragment_assembly_risk above).
    cert = Certificate(
        id=registry_id,
        org_id=org.id,
        sequence_hash=seq_hash,
        owner_id=body.owner_id,
        ethics_code=body.ethics_code,
        sequence_type=seq_type.value,
        host_organism=body.host_organism.value,
        timestamp=now,
        watermark_metadata={"original_protein": protein},
        wots_public_key=wots_pub.model_dump(),
        wots_signature=wots_sig.model_dump(),
        lwe_commitment=lwe_com.model_dump(),
        consequence_report=report_dict,
        certificate_hash=cert_hash,
        status=(CertificateStatus.CERTIFIED_WITH_WARNINGS if _warn_only else CertificateStatus.CERTIFIED).value,
        tier="STANDARD",
        visibility=body.visibility,
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

    # Index k-mers for future assembly risk cross-checks (same transaction).
    _add_kmer_index_rows(db, registry_id, org.id, protein)

    await db.commit()

    final_status = CertificateStatus.CERTIFIED_WITH_WARNINGS if _warn_only else CertificateStatus.CERTIFIED
    return RegistrationResponse(
        status=final_status,
        registry_id=registry_id,
        consequence_report=report_dict,
        message=(
            f"Sequence certified with warnings — {registry_id} (manual biosafety review recommended)"
            if _warn_only else
            f"Sequence certified — {registry_id}"
        ),
    )
