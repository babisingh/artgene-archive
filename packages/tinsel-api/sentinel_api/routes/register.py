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
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tinsel.crypto import PQSigner
from tinsel.registry import (
    CERT_HASH_SCHEME_DEFAULT,
    CertificateStatus,
    HostOrganism,
    HybridCertificate,
    LWECommitmentData,
    WOTSPublicKey,
    WOTSSignature,
)

from sentinel_api.accession import (
    AUDIT_SEQ_COUNTER,
    allocate_sequence_number,
    format_accession,
)
from sentinel_api.config import settings
from sentinel_api.db.catalogue import Record
from sentinel_api.db.connection import get_db
from sentinel_api.db.models import (
    Certificate,
    Organisation,
    RegistryAuditLog,
)
from sentinel_api.dependencies import require_api_key
from sentinel_api.ledger import entry_hash as _entry_hash
from sentinel_api.ledger import highest_audit_seq_plus_one as _highest_audit_seq_plus_one
from sentinel_api.ledger import prev_entry_hash as _prev_entry_hash
from sentinel_api.rate_limit import rate_limit_write
from sentinel_api.screening import (
    ScreeningInputError,
    fragment_assembly_risk,
    partial_screen_note,
    prepare,
    run_pipeline,
)
from sentinel_api.screening import add_kmer_index_rows as _add_kmer_index_rows
from sentinel_api.vault import get_vault_client

router = APIRouter()

# Length limits, sequence classification and the gates themselves live in
# sentinel_api.screening, shared with /submissions, so the two routes can
# never screen the same sequence differently.

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

# ---------------------------------------------------------------------------
# Fragment assembly risk helpers
# ---------------------------------------------------------------------------

async def _check_fragment_assembly_risk(
    db: AsyncSession, sequence: str, env: str
) -> None:
    """Raise HTTP 422 if *sequence* and an archived sequence assemble into a hazard.

    The check lives in sentinel_api.screening. This route has always answered
    it with a 422, so it still does, and the message never reveals which
    archived sequence was involved.
    """
    if await fragment_assembly_risk(db, sequence, env):
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

    # ── Step 1: Read and classify the sequence ────────────────────────────
    # Shared with /submissions through sentinel_api.screening.prepare.
    try:
        prepared = prepare(body.fasta)
    except ScreeningInputError as exc:
        raise HTTPException(status_code=422, detail=exc.detail) from exc
    sequence = prepared.sequence
    seq_type = prepared.seq_type
    screen_mode = prepared.screen_mode
    gate_protein = prepared.gate_protein

    # ── Step 1c: Fragment assembly cross-check ────────────────────────────
    # Checks new sequence against the k-mer index of all archived sequences.
    # Raises HTTP 422 (FRAGMENT_ASSEMBLY_RISK) without revealing which
    # archived sequence caused the match.
    try:
        # Skipped when a nucleotide submission encodes nothing long enough to
        # be a gene: there is no peptide to cross-check against the index.
        if gate_protein:
            await _check_fragment_assembly_risk(
                db, gate_protein, settings.sentinel_env
            )
    except HTTPException:
        raise
    except Exception as exc:
        import logging as _log
        _log.getLogger(__name__).exception(
            "Fragment assembly check raised an unexpected error: %s", exc
        )
        raise HTTPException(
            status_code=500,
            detail={
                "code": "FRAGMENT_CHECK_ERROR",
                "message": (
                    "The biosafety pipeline encountered an internal error. "
                    "Please try again. If the problem persists, contact support."
                ),
            },
        ) from exc

    # ── Step 2: Consequence pipeline ──────────────────────────────────────
    import logging as _logging
    _reg_log = _logging.getLogger(__name__)
    try:
        report = await run_pipeline(
            prepared, body.host_organism.value, settings.sentinel_env
        )
    except Exception as exc:
        _reg_log.exception("Consequence pipeline raised an unexpected error: %s", exc)
        raise HTTPException(
            status_code=500,
            detail={
                "code": "PIPELINE_ERROR",
                "message": (
                    "The biosafety pipeline encountered an internal error. "
                    "Please try again. If the problem persists, contact support."
                ),
            },
        ) from exc
    report_dict = report.model_dump()

    from tinsel.models import GateStatus
    if report.overall_status == GateStatus.FAIL:
        return RegistrationResponse(
            status=CertificateStatus.FAILED,
            consequence_report=report_dict,
            message="One or more biosafety gates failed — registration rejected",
        )
    _warn_only = report.overall_status == GateStatus.WARN

    # A certificate must not read as a clean screen when a gate did not run.
    # Two ways that happens: ESMFold Atlas refuses sequences over 400 residues
    # and the adapter substitutes a mock returning pLDDT 87.3, comfortably
    # above the 70.0 fail threshold; and a nucleotide submission with more
    # reading frames than the screen covers is only partly checked.
    partial_screen = partial_screen_note(report)
    if partial_screen:
        _warn_only = True

    # ── Step 2b: Deduplication check ─────────────────────────────────────
    # Hash matches TINSELEncoder.sequence_hash(): SHA3-256 of uppercased protein.
    # We check before watermarking so a duplicate is rejected before spending
    # vault + ESMFold resources.  Do NOT reveal the existing registry_id in the
    # error — that would disclose another organisation's registered sequence.
    pre_hash = hashlib.sha3_256(sequence.upper().encode()).hexdigest()
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

    # ── Steps 3–7: Vault + signing + DB write ────────────────────────────
    # Wrapped in a single try/except so any failure here produces a structured
    # 500 with a specific error code visible in Railway logs and the UI.
    try:
        vault = get_vault_client()
        spreading_key = await vault.get_spreading_key(settings.spreading_key_id)

        now = datetime.now(UTC)
        seq_num = await allocate_sequence_number(
            db, AUDIT_SEQ_COUNTER, seed=lambda: _highest_audit_seq_plus_one(db)
        )
        year = now.year
        registry_id = format_accession("AG", year, seq_num)

        # seq_hash already computed above as pre_hash
        seq_hash = pre_hash

        lwe_com = LWECommitmentData.stub()  # LWE: Phase 4

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

        # Store the original_protein in watermark_metadata for fragment assembly
        # cross-checks (see _check_fragment_assembly_risk above).
        # The shared accession namespace row comes first: certificates.id is a
        # foreign key onto records.id, so inserting the certificate alone would
        # violate it. Both go in the same transaction as the audit entry.
        db.add(Record(id=registry_id, record_class="certificate"))
        await db.flush()

        cert = Certificate(
            id=registry_id,
            org_id=org.id,
            sequence_hash=seq_hash,
            owner_id=body.owner_id,
            ethics_code=body.ethics_code,
            sequence_type=seq_type.value,
            host_organism=body.host_organism.value,
            timestamp=now,
            watermark_metadata={
                # The gates and the fragment cross-check reason about a
                # protein, so that is what `original_protein` holds: the
                # submission for a protein, its translation for a coding
                # sequence, its longest reading frame otherwise. The submission
                # is kept beside it, because for a nucleotide deposit that is
                # the actual deposited object.
                "original_protein": gate_protein,
                "submitted_sequence": sequence,
                "submitted_type": seq_type.value,
                "screen_mode": screen_mode,
            },
            wots_public_key=wots_pub.model_dump(),
            wots_signature=wots_sig.model_dump(),
            lwe_commitment=lwe_com.model_dump(),
            consequence_report=report_dict,
            certificate_hash=cert_hash,
            # Recorded explicitly rather than relying on the column default, so
            # the row states which canonicalisation produced its digest.
            hash_scheme=CERT_HASH_SCHEME_DEFAULT,
            status=(
                CertificateStatus.CERTIFIED_WITH_WARNINGS
                if _warn_only
                else CertificateStatus.CERTIFIED
            ).value,
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

        _add_kmer_index_rows(db, registry_id, org.id, gate_protein)

        await db.commit()

    except HTTPException:
        raise
    except Exception as exc:
        _reg_log.exception(
            "Certificate issuance failed at vault/signing/commit step: %s: %s",
            type(exc).__name__, exc,
        )
        raise HTTPException(
            status_code=500,
            detail={
                "code": "CERTIFICATE_WRITE_ERROR",
                "message": (
                    "The server failed to issue the certificate after biosafety gates passed. "
                    "Please try again. If the problem persists, contact support."
                ),
            },
        ) from exc

    final_status = (
        CertificateStatus.CERTIFIED_WITH_WARNINGS
        if _warn_only
        else CertificateStatus.CERTIFIED
    )
    return RegistrationResponse(
        status=final_status,
        registry_id=registry_id,
        consequence_report=report_dict,
        message=(
            (
                f"Sequence certified with warnings, {registry_id}: "
                f"{partial_screen} Manual biosafety review recommended."
                if partial_screen
                else f"Sequence certified with warnings, {registry_id}. "
                "Manual biosafety review recommended."
            )
            if _warn_only
            else f"Sequence certified, {registry_id}"
        ),
    )
