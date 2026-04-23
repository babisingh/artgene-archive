"""Certificate read and verification endpoints."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tinsel.compliance import build_compliance_manifest
from tinsel.crypto import ALGORITHM_WOTS, PQSigner
from tinsel.registry import AnchorMap, CertificateStatus, WatermarkConfig
from tinsel.synthesis_auth import build_synthesis_auth_document
from tinsel.watermark.decoder import TINSELDecoder

from sentinel_api.config import settings
from sentinel_api.db.connection import get_db
from sentinel_api.db.models import Certificate, Organisation
from sentinel_api.dependencies import require_api_key
from sentinel_api.vault import get_vault_client

router = APIRouter()


@router.get("/lookup")
async def lookup_by_sequence_hash(
    sequence_hash: str = Query(..., description="SHA3-256 hex digest of the protein sequence"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Public sequence-hash lookup — no authentication required.

    Returns minimal registry metadata for certificates whose ``sequence_hash``
    matches the supplied digest.  Only publicly visible certificates are
    returned.  Sequence data is never included in the response.
    """
    result = await db.execute(
        select(Certificate).where(
            Certificate.sequence_hash == sequence_hash,
            Certificate.visibility == "public",
        )
    )
    certs = result.scalars().all()
    if not certs:
        raise HTTPException(
            status_code=404,
            detail="No public certificate found for the supplied sequence hash.",
        )
    return {
        "results": [
            {
                "registry_id": c.id,
                "status": c.status,
                "tier": c.tier,
                "certified_at": c.timestamp.isoformat(),
                "host_organism": c.host_organism,
            }
            for c in certs
        ],
        "count": len(certs),
    }


@router.get("/{registry_id}")
async def get_certificate(
    registry_id: str,
    db: AsyncSession = Depends(get_db),
    org: Organisation = Depends(require_api_key),
) -> dict:
    """Fetch a single certificate by registry ID (e.g. AG-2027-000001)."""
    result = await db.execute(
        select(Certificate).where(Certificate.id == registry_id)
    )
    cert = result.scalars().first()
    # Return 404 for both not-found and wrong-org to avoid confirming existence
    # of certificates belonging to other organisations.
    if cert is None or cert.org_id != org.id:
        raise HTTPException(status_code=404, detail=f"Certificate '{registry_id}' not found")

    pk_dict = cert.wots_public_key or {}
    return {
        "registry_id": cert.id,
        "status": cert.status,
        "tier": cert.tier,
        "chi_squared": cert.chi_squared,
        "owner_id": cert.owner_id,
        "org_id": str(cert.org_id),
        "ethics_code": cert.ethics_code,
        "sequence_type": cert.sequence_type,
        "host_organism": cert.host_organism,
        "timestamp": cert.timestamp.isoformat(),
        "certificate_hash": cert.certificate_hash,
        "watermark_metadata": cert.watermark_metadata,
        "consequence_report": cert.consequence_report,
        "pq_algorithm": pk_dict.get("algorithm_id", "stub_zero_v1"),
        "pq_is_stub": pk_dict.get("is_stub", True),
    }


@router.get("/")
async def list_certificates(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    org: Organisation = Depends(require_api_key),
) -> dict:
    """List certificates for the authenticated organisation (paginated)."""
    # Only return certs owned by this org OR public certs from any org.
    # Embargoed certs from other orgs are hidden entirely.
    from sqlalchemy import or_
    result = await db.execute(
        select(Certificate)
        .where(
            or_(
                Certificate.org_id == org.id,
                Certificate.visibility == "public",
            )
        )
        .order_by(Certificate.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    certs = result.scalars().all()
    return {
        "items": [
            {
                "registry_id": c.id,
                "status": c.status,
                "tier": c.tier,
                "chi_squared": c.chi_squared,
                "owner_id": c.owner_id,
                "host_organism": c.host_organism,
                "timestamp": c.timestamp.isoformat(),
                "visibility": getattr(c, "visibility", "public"),
            }
            for c in certs
        ],
        "count": len(certs),
        "offset": offset,
        "limit": limit,
    }


@router.post("/{registry_id}/publish")
async def publish_certificate(
    registry_id: str,
    db: AsyncSession = Depends(get_db),
    org: Organisation = Depends(require_api_key),
) -> dict:
    """Publish an embargoed certificate, making it visible to all organisations.

    Only the owning organisation can publish its own embargoed certificates.
    """
    result = await db.execute(
        select(Certificate).where(Certificate.id == registry_id)
    )
    cert = result.scalars().first()
    if cert is None or cert.org_id != org.id:
        raise HTTPException(status_code=404, detail=f"Certificate '{registry_id}' not found")

    if cert.visibility == "public":
        return {"registry_id": registry_id, "visibility": "public", "message": "Already public"}

    cert.visibility = "public"
    await db.commit()
    return {"registry_id": registry_id, "visibility": "public", "message": "Certificate published"}


@router.get("/{registry_id}/export")
async def export_certificate(
    registry_id: str,
    db: AsyncSession = Depends(get_db),
    org: Organisation = Depends(require_api_key),
) -> JSONResponse:
    """Export a certificate as a canonical signed JSON document.

    The export includes all certificate fields, watermark metadata, and
    consequence report.  The response is returned with a Content-Disposition
    header to trigger a browser download.

    NOTE: Post-quantum signatures (WOTS+/LWE) are Phase 7 stubs and carry
    no cryptographic guarantee in this release.
    """
    result = await db.execute(
        select(Certificate).where(Certificate.id == registry_id)
    )
    cert = result.scalars().first()
    if cert is None or cert.org_id != org.id:
        raise HTTPException(status_code=404, detail=f"Certificate '{registry_id}' not found")

    # ── Determine PQ signature status ─────────────────────────────────────
    pk_dict  = cert.wots_public_key  or {}
    sig_dict = cert.wots_signature   or {}
    pq_is_real = not pk_dict.get("is_stub", True)
    pq_algorithm = pk_dict.get("algorithm_id", "stub_zero_v1")

    export_doc = {
        "schema_version": "1.1",
        "registry_id": cert.id,
        "status": cert.status,
        "tier": cert.tier,
        "chi_squared": cert.chi_squared,
        "owner_id": cert.owner_id,
        "org_id": str(cert.org_id),
        "ethics_code": cert.ethics_code,
        "sequence_type": cert.sequence_type,
        "host_organism": cert.host_organism,
        "timestamp": cert.timestamp.isoformat(),
        "certificate_hash": cert.certificate_hash,
        "watermark_metadata": cert.watermark_metadata,
        "consequence_report": cert.consequence_report,
        "pq_signature": {
            "algorithm": pq_algorithm,
            "is_stub": not pq_is_real,
            "public_key": {
                "chains": pk_dict.get("chains", []),
                "public_seed": pk_dict.get("public_seed", ""),
            } if pq_is_real else None,
            "signature": {
                "chains": sig_dict.get("signature_chains", []),
                "message_hash": sig_dict.get("message_hash", ""),
            } if pq_is_real else None,
            "notice": (
                None if pq_is_real else
                "Pre-session-3 certificate: PQ signature is a zero-filled stub. "
                "Re-register to obtain a real WOTS+ signature."
            ),
        },
    }

    filename = f"{registry_id}.artgene.json"
    return JSONResponse(
        content=export_doc,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "application/json",
        },
    )


@router.post("/{registry_id}/verify")
async def verify_certificate(
    registry_id: str,
    db: AsyncSession = Depends(get_db),
    org: Organisation = Depends(require_api_key),
) -> dict:
    """Verify distribution fingerprint metadata for a registered certificate.

    Certificates registered after v2.0 do not embed a watermark at registration
    time — fingerprinting happens at distribution (see /sequences/{id}/distributions).
    For such certificates this endpoint returns ``verified: false`` with a clear
    ``failure_reason``.

    For certificates that do carry full watermark metadata, the TINSEL decoder
    reconstructs and verifies the embedded signature.
    """
    result = await db.execute(
        select(Certificate).where(Certificate.id == registry_id)
    )
    cert = result.scalars().first()
    # Return 404 for both not-found and wrong-org to avoid leaking existence.
    if cert is None or cert.org_id != org.id:
        raise HTTPException(
            status_code=404, detail=f"Certificate '{registry_id}' not found"
        )

    metadata = cert.watermark_metadata or {}

    # Certificates without full watermark data (registered without per-registration
    # fingerprinting, or pre-v1.0 legacy certs).
    if "config" not in metadata or "anchor_map" not in metadata:
        return {
            "registry_id": registry_id,
            "verified": False,
            "bit_error_rate": None,
            "anchor_positions_mutated": None,
            "bits_recovered": None,
            "tier": cert.tier,
            "failure_reason": (
                "This certificate was registered without per-registration fingerprinting. "
                "Provenance fingerprints are issued per-recipient via the distribution endpoint. "
                "Use POST /api/v1/verify-source to identify a leaked distribution copy."
            ),
        }

    try:
        config = WatermarkConfig(**metadata["config"])
        anchor_map = AnchorMap(**metadata["anchor_map"])
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Watermark metadata is malformed: {exc}",
        ) from exc

    signature_hex: str = metadata.get("signature_hex", "")
    dna: str = metadata.get("dna_sequence", "")
    protein: str = metadata.get("original_protein", "")

    if not signature_hex or not dna or not protein:
        raise HTTPException(
            status_code=422,
            detail="Watermark metadata is incomplete (missing dna_sequence, "
                   "original_protein, or signature_hex).",
        )

    vault = get_vault_client()
    spreading_key = await vault.get_spreading_key(settings.spreading_key_id)

    decoder = TINSELDecoder(spreading_key)
    vr = decoder.verify(dna, signature_hex, config, anchor_map, protein=protein)

    return {
        "registry_id": registry_id,
        "verified": vr.verified,
        "bit_error_rate": vr.bit_error_rate,
        "anchor_positions_mutated": vr.anchor_positions_mutated,
        "bits_recovered": vr.bits_recovered,
        "tier": vr.tier.value,
        "watermark_id": vr.watermark_id,
        "failure_reason": vr.failure_reason,
    }


@router.get("/{registry_id}/compliance")
async def get_compliance_manifest(
    registry_id: str,
    frameworks: str = Query("US_DURC,EU_DUAL_USE", description="Comma-separated framework IDs"),
    db: AsyncSession = Depends(get_db),
    org: Organisation = Depends(require_api_key),
) -> dict:
    """Full compliance attestation manifest (authenticated).

    Returns a ComplianceManifest with one FrameworkAttestation per requested
    framework.  Supported values: ``US_DURC``, ``EU_DUAL_USE``.
    """
    result = await db.execute(
        select(Certificate).where(Certificate.id == registry_id)
    )
    cert = result.scalars().first()
    if cert is None or cert.org_id != org.id:
        raise HTTPException(status_code=404, detail=f"Certificate '{registry_id}' not found")

    fw_list = [f.strip() for f in frameworks.split(",") if f.strip()]
    cert_data = {
        "registry_id": cert.id,
        "certificate_hash": cert.certificate_hash,
        "sequence_hash": cert.sequence_hash,
        "status": cert.status,
        "timestamp": cert.timestamp.isoformat(),
        "owner_id": cert.owner_id,
        "org_id": str(cert.org_id),
        "ethics_code": cert.ethics_code,
        "host_organism": cert.host_organism,
        "consequence_report": cert.consequence_report,
        "wots_public_key": cert.wots_public_key or {},
    }
    manifest = build_compliance_manifest(cert_data, frameworks=fw_list)
    return manifest.model_dump()


@router.get("/{registry_id}/compliance/verify")
async def verify_compliance_public(
    registry_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Public minimal compliance proof — no authentication required.

    Only available for certificates with ``visibility = 'public'``.
    Returns a tamper-evident summary suitable for third-party verification
    (e.g. by DNA synthesis providers).  Does not expose gate internals or
    sequence data.
    """
    result = await db.execute(
        select(Certificate).where(
            Certificate.id == registry_id,
            Certificate.visibility == "public",
        )
    )
    cert = result.scalars().first()
    if cert is None:
        raise HTTPException(
            status_code=404,
            detail=f"Certificate '{registry_id}' not found or not publicly visible",
        )

    pk_dict = cert.wots_public_key or {}
    report = cert.consequence_report or {}
    gate2 = report.get("gate2") or {}
    databases = gate2.get("databases_queried") or []

    return {
        "registry_id": cert.id,
        "certificate_hash": cert.certificate_hash,
        "sequence_hash": cert.sequence_hash,
        "status": cert.status,
        "certified_at": cert.timestamp.isoformat(),
        "pq_algorithm": pk_dict.get("algorithm_id", "stub_zero_v1"),
        "pq_is_stub": pk_dict.get("is_stub", True),
        "overall_gate_status": report.get("overall_status", "skip"),
        "screening_databases": [db.get("name") for db in databases if db.get("name")],
        "verified_at": datetime.now(UTC).isoformat(),
    }


@router.get("/{registry_id}/synthesis-auth")
async def get_synthesis_auth(
    registry_id: str,
    db: AsyncSession = Depends(get_db),
    org: Organisation = Depends(require_api_key),
) -> dict:
    """Return a TINSEL-SAD-1.0 Synthesis Authorization Document.

    Synthesizer firmware reads ``machine_instructions.proceed_with_synthesis``
    to decide whether to proceed.  The full regulatory detail (US DURC,
    EU Directive 2000/54/EC) is included for audit trail purposes.
    """
    result = await db.execute(
        select(Certificate).where(Certificate.id == registry_id)
    )
    cert = result.scalars().first()
    if cert is None or cert.org_id != org.id:
        raise HTTPException(status_code=404, detail=f"Certificate '{registry_id}' not found")

    cert_data = {
        "registry_id": cert.id,
        "sequence_hash": cert.sequence_hash,
        "certificate_hash": cert.certificate_hash,
        "status": cert.status,
        "timestamp": cert.timestamp.isoformat(),
        "host_organism": cert.host_organism,
        "consequence_report": cert.consequence_report or {},
        "wots_public_key": cert.wots_public_key or {},
        "watermark_metadata": cert.watermark_metadata or {},
    }
    sad = build_synthesis_auth_document(cert_data)
    return sad.model_dump()


@router.post("/{registry_id}/revoke")
async def revoke_certificate(
    registry_id: str,
    db: AsyncSession = Depends(get_db),
    org: Organisation = Depends(require_api_key),
) -> dict:
    """Revoke a certificate — permanently blocks synthesis authorisation.

    Only the owning organisation can revoke its own certificates.  Revocation
    is irreversible.  The certificate status is set to REVOKED and any
    subsequent synthesis-auth request will return ``machine_instructions.reject = true``.
    """
    result = await db.execute(
        select(Certificate).where(Certificate.id == registry_id)
    )
    cert = result.scalars().first()
    if cert is None or cert.org_id != org.id:
        raise HTTPException(status_code=404, detail=f"Certificate '{registry_id}' not found")

    if cert.status == CertificateStatus.REVOKED:
        return {"registry_id": registry_id, "status": "REVOKED", "message": "Already revoked"}

    cert.status = CertificateStatus.REVOKED
    await db.commit()
    return {
        "registry_id": registry_id,
        "status": "REVOKED",
        "revoked_at": datetime.now(UTC).isoformat(),
        "message": "Certificate revoked. Synthesis authorisation is permanently blocked.",
    }
