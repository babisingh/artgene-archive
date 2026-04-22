"""Pathway endpoints — multi-gene Merkle bundles."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sentinel_api.db.connection import get_db
from sentinel_api.db.models import Certificate, Organisation, Pathway
from sentinel_api.dependencies import require_api_key

router = APIRouter()


class PathwayCreateRequest(BaseModel):
    name: str
    certificate_ids: list[str]  # list of AG-YYYY-NNNNNN registry IDs


@router.post("/", status_code=201)
async def create_pathway(
    body: PathwayCreateRequest,
    db: AsyncSession = Depends(get_db),
    org: Organisation = Depends(require_api_key),
) -> dict:
    """Bundle a list of certified sequences into a named pathway."""
    # Verify all certificates belong to this org
    result = await db.execute(
        select(Certificate).where(
            Certificate.id.in_(body.certificate_ids),
            Certificate.org_id == org.id,
        )
    )
    certs = result.scalars().all()
    if len(certs) != len(body.certificate_ids):
        missing = set(body.certificate_ids) - {c.id for c in certs}
        raise HTTPException(
            status_code=404,
            detail=f"Certificates not found or not owned by this org: {sorted(missing)}",
        )

    # Stub Merkle root — Phase 7 will compute the real tree
    import hashlib
    root = hashlib.sha3_256(
        "|".join(sorted(body.certificate_ids)).encode()
    ).hexdigest()

    pathway = Pathway(
        id=uuid.uuid4(),
        org_id=org.id,
        name=body.name,
        gene_count=len(body.certificate_ids),
        merkle_root=root,
        certificate_ids=body.certificate_ids,
    )
    db.add(pathway)
    await db.flush()

    return {
        "pathway_id": str(pathway.id),
        "name": pathway.name,
        "gene_count": pathway.gene_count,
        "merkle_root": pathway.merkle_root,
        "certificate_ids": pathway.certificate_ids,
    }


@router.get("/{pathway_id}/proof")
async def get_pathway_proof(
    pathway_id: str,
    db: AsyncSession = Depends(get_db),
    org: Organisation = Depends(require_api_key),
) -> dict:
    """Return Merkle proof data for a pathway (stub — real tree in Phase 7)."""
    try:
        pid = uuid.UUID(pathway_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid pathway ID format")

    result = await db.execute(
        select(Pathway).where(Pathway.id == pid, Pathway.org_id == org.id)
    )
    pathway = result.scalars().first()
    if pathway is None:
        raise HTTPException(status_code=404, detail=f"Pathway '{pathway_id}' not found")

    return {
        "pathway_id": str(pathway.id),
        "name": pathway.name,
        "gene_count": pathway.gene_count,
        "merkle_root": pathway.merkle_root,
        "certificate_ids": pathway.certificate_ids,
        "proof": {"not_implemented": True},
    }
