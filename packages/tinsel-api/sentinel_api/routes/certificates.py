"""Certificate read and verification endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tinsel.crypto import ALGORITHM_WOTS, PQSigner
from tinsel.registry import AnchorMap, WatermarkConfig
from tinsel.watermark.decoder import TINSELDecoder

from sentinel_api.config import settings
from sentinel_api.db.connection import get_db
from sentinel_api.db.models import Certificate, Organisation
from sentinel_api.dependencies import require_api_key
from sentinel_api.vault import get_vault_client

router = APIRouter()


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
    """Verify the TINSEL watermark embedded in a registered certificate.

    Reconstructs the watermark from stored metadata and checks that the
    embedded signature still matches the claimed owner / timestamp.

    Returns a verification report including ``verified`` (bool) and
    ``bit_error_rate`` (0.0 = perfect, higher = corruption detected).
    Legacy certificates issued before v1.0 return ``verified: false`` with
    an explanatory ``failure_reason``.
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

    # Legacy certificates (v0.x) stored EncodeResult which lacks config/anchor_map.
    if "config" not in metadata or "anchor_map" not in metadata:
        return {
            "registry_id": registry_id,
            "verified": False,
            "bit_error_rate": None,
            "anchor_positions_mutated": None,
            "bits_recovered": None,
            "tier": cert.tier,
            "failure_reason": (
                "Certificate was issued with the legacy encoder (pre-v1.0) "
                "and does not contain the anchor map required for verification."
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
