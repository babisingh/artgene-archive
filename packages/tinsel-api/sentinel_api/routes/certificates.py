"""Certificate read endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sentinel_api.db.connection import get_db
from sentinel_api.db.models import Certificate, Organisation
from sentinel_api.dependencies import require_api_key

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
    if cert is None:
        raise HTTPException(status_code=404, detail=f"Certificate '{registry_id}' not found")

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
    }


@router.get("/")
async def list_certificates(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    org: Organisation = Depends(require_api_key),
) -> dict:
    """List certificates for the authenticated organisation (paginated)."""
    result = await db.execute(
        select(Certificate)
        .where(Certificate.org_id == org.id)
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
            }
            for c in certs
        ],
        "count": len(certs),
        "offset": offset,
        "limit": limit,
    }
