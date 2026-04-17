"""POST /api/v1/analyse/structure — async ESMFold structure endpoint.

Calls ESMFold Atlas to fold a protein sequence and returns:
- pdb_text          : raw PDB file from ESMFold (for 3Dmol.js)
- plddt_per_residue : per-residue confidence (from B-factor column)
- plddt_mean        : mean pLDDT score
- instability_index : Guruprasad 1990 instability index
- sequence_length   : number of amino acids
- fallback          : True if ESMFold was unavailable (pdb_text = None)
- message           : human-readable status

No authentication required — intended for the public demo page.
ESMFold is limited to ≤ 400 AA; longer sequences return fallback=True.
"""

from __future__ import annotations

import asyncio
import logging

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from tinsel_gates.adapters.gate1.esmfold import (
    ESMFOLD_MAX_LENGTH,
    ESMFOLD_TIMEOUT_S,
    ESMFOLD_URL,
    _compute_instability_index,
    _parse_plddt_from_pdb,
)

router = APIRouter()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class StructureRequest(BaseModel):
    protein: str


class StructureResponse(BaseModel):
    pdb_text: str | None
    plddt_mean: float | None
    plddt_per_residue: list[float] | None
    instability_index: float | None
    sequence_length: int
    fallback: bool
    message: str | None


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/analyse/structure", response_model=StructureResponse, tags=["demo"])
async def analyse_structure(body: StructureRequest) -> StructureResponse:
    """Fold a protein with ESMFold and return PDB + per-residue pLDDT scores."""

    protein = body.protein.upper().strip()
    if not protein:
        raise HTTPException(status_code=422, detail="protein must be a non-empty string.")
    if len(protein) > 1000:
        raise HTTPException(
            status_code=422,
            detail="Demo accepts sequences up to 1,000 amino acids.",
        )

    sequence_length = len(protein)
    instability_ii = round(_compute_instability_index(protein), 2)

    # ── ESMFold length limit ──────────────────────────────────────────────
    if sequence_length > ESMFOLD_MAX_LENGTH:
        return StructureResponse(
            pdb_text=None,
            plddt_mean=None,
            plddt_per_residue=None,
            instability_index=instability_ii,
            sequence_length=sequence_length,
            fallback=True,
            message=(
                f"Sequence length {sequence_length} exceeds ESMFold Atlas limit of "
                f"{ESMFOLD_MAX_LENGTH} AA. 3D structure not available."
            ),
        )

    # ── ESMFold API call ──────────────────────────────────────────────────
    pdb_text: str | None = None
    error_msg: str | None = None
    try:
        async with httpx.AsyncClient(timeout=ESMFOLD_TIMEOUT_S) as client:
            response = await client.post(
                ESMFOLD_URL,
                content=protein,
                headers={"Content-Type": "text/plain"},
            )
            response.raise_for_status()
            pdb_text = response.text
    except (httpx.HTTPError, asyncio.TimeoutError) as exc:
        error_msg = str(exc)
        logger.warning("ESMFold API failed for /analyse/structure: %s", exc)
    except Exception as exc:  # noqa: BLE001
        error_msg = str(exc)
        logger.warning("Unexpected error calling ESMFold: %s", exc)

    if pdb_text is None:
        return StructureResponse(
            pdb_text=None,
            plddt_mean=None,
            plddt_per_residue=None,
            instability_index=instability_ii,
            sequence_length=sequence_length,
            fallback=True,
            message=f"ESMFold API unavailable — 3D view not shown. ({error_msg})",
        )

    # ── Parse pLDDT from PDB ──────────────────────────────────────────────
    plddt_scores = _parse_plddt_from_pdb(pdb_text)
    if not plddt_scores:
        return StructureResponse(
            pdb_text=pdb_text,
            plddt_mean=None,
            plddt_per_residue=None,
            instability_index=instability_ii,
            sequence_length=sequence_length,
            fallback=True,
            message="ESMFold returned a PDB with no parseable pLDDT scores.",
        )

    plddt_mean = round(sum(plddt_scores) / len(plddt_scores), 2)

    return StructureResponse(
        pdb_text=pdb_text,
        plddt_mean=plddt_mean,
        plddt_per_residue=[round(s, 1) for s in plddt_scores],
        instability_index=instability_ii,
        sequence_length=sequence_length,
        fallback=False,
        message=(
            f"ESMFold folded {sequence_length} AA — "
            f"pLDDT mean {plddt_mean:.1f}, "
            f"instability index {instability_ii:.1f}."
        ),
    )
