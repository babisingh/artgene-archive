"""Gate 2 chained adapter — composition + SecureDNA DOPRF + IBBIS commec.

Screening pipeline (three layers, all run concurrently):
  Layer 1 — Composition heuristic (offline, always fast)
             GRAVY, toxin/allergen probability, 15-motif k-mer screen.
  Layer 2 — SecureDNA DOPRF (30-bp DNA window screening)
             Privacy-preserving cryptographic hazard database check.
             Mock: local pattern match.  Prod: SecureDNA API.
  Layer 3 — IBBIS commec HMM profiles (protein-level, ≥ 50 AA only)
             Hidden Markov Model search against dangerous protein families.
             Mock: signature substring match.  Prod: commec binary.

Final status: worst status across all three layers.
  FAIL → any layer FAILs
  WARN → no FAIL, but any layer WARNs
  PASS → all layers PASS

screening_method is set to "chained_v1" so certificates clearly indicate
which layers were applied.  The databases_queried list carries per-database
metadata for the compliance attestation layer (Gap 3 / Session 4).
"""

from __future__ import annotations

import asyncio
import logging

from tinsel.consequence import Gate2Result
from tinsel.models import GateStatus

from tinsel_gates.adapters.base import Gate2Adapter
from tinsel_gates.adapters.gate2.composition import CompositionGate2Adapter
from tinsel_gates.adapters.gate2.ibbis import run_ibbis_screen
from tinsel_gates.adapters.gate2.secureDNA import run_secureDNA_screen

logger = logging.getLogger(__name__)

_STATUS_RANK = {GateStatus.FAIL: 2, GateStatus.WARN: 1, GateStatus.PASS: 0}


def _worst(*statuses: GateStatus | None) -> GateStatus:
    """Return the most severe status from the given set."""
    non_null = [s for s in statuses if s is not None]
    if not non_null:
        return GateStatus.PASS
    return max(non_null, key=lambda s: _STATUS_RANK[s])


class ChainedGate2Adapter(Gate2Adapter):
    """Gate 2 implementation: three-layer chained screening.

    Layers: composition heuristic → SecureDNA DOPRF → IBBIS commec HMM.
    All three layers run concurrently via asyncio.gather().
    """

    mock_mode = False   # composition + SecureDNA mock + IBBIS mock still count as "real"

    def __init__(self, *, use_mock_external: bool = True) -> None:
        """
        Parameters
        ----------
        use_mock_external:
            If True (default for dev/demo): SecureDNA and IBBIS use local
            mock implementations (no network calls, no external binaries).
            If False: attempt real SecureDNA API + commec subprocess calls.
        """
        self._mock_external = use_mock_external
        self._composition = CompositionGate2Adapter()

    async def run(self, dna: str, protein: str) -> Gate2Result:
        # ── Run all three layers concurrently ─────────────────────────────
        composition_task = asyncio.create_task(self._composition.run(dna, protein))
        sdna_task = asyncio.create_task(run_secureDNA_screen(dna, mock=self._mock_external))
        ibbis_task = asyncio.create_task(run_ibbis_screen(protein, mock=self._mock_external))

        raw_results = await asyncio.gather(
            composition_task, sdna_task, ibbis_task, return_exceptions=True
        )
        for i, r in enumerate(raw_results):
            if isinstance(r, BaseException):
                layer_name = ("composition", "secureDNA", "IBBIS")[i]
                logger.exception("Gate 2 %s layer raised an error: %s", layer_name, r)
                raise RuntimeError(
                    f"Gate 2 {layer_name} layer failed with an internal error"
                ) from r
        comp_result, sdna_result, ibbis_result = raw_results

        # ── Merge statuses ─────────────────────────────────────────────────
        sdna_status: GateStatus = sdna_result["status"]
        ibbis_status: GateStatus = ibbis_result["status"]
        final_status = _worst(comp_result.status, sdna_status, ibbis_status)

        # ── Build unified message ──────────────────────────────────────────
        parts: list[str] = []
        parts.append(f"Composition: {comp_result.status.value.upper()} — {comp_result.message}")
        if sdna_result["checked"]:
            sdna_hits = sdna_result["hits"]
            parts.append(
                f"SecureDNA DOPRF: {sdna_status.value.upper()} — "
                f"{sdna_result['windows_screened']} windows screened"
                + (f", {len(sdna_hits)} hazard hit(s)" if sdna_hits else ", no hits")
            )
        if ibbis_result["checked"] and ibbis_result["length_sufficient"]:
            ibbis_hits = ibbis_result["hits"]
            parts.append(
                f"IBBIS commec: {ibbis_status.value.upper()} — "
                f"{ibbis_result['families_screened']} families screened"
                + (f", {len(ibbis_hits)} HMM hit(s)" if ibbis_hits else ", no hits")
            )
        elif ibbis_result["checked"] and not ibbis_result["length_sufficient"]:
            parts.append("IBBIS commec: SKIPPED (sequence < 50 AA)")

        # ── Aggregate databases_queried list ───────────────────────────────
        databases_queried: list[dict] = []
        # Composition is always the first entry
        databases_queried.append({
            "name": "Composition Heuristic",
            "version": "1.0",
            "method": "composition_heuristic_v1",
            "status": comp_result.status.value,
        })
        if sdna_result.get("db_entry"):
            databases_queried.append(sdna_result["db_entry"])
        if ibbis_result.get("db_entry"):
            databases_queried.append(ibbis_result["db_entry"])

        logger.info(
            "ChainedGate2: composition=%s  securedna=%s  ibbis=%s  → overall=%s",
            comp_result.status.value,
            sdna_status.value,
            ibbis_status.value,
            final_status.value,
        )

        return Gate2Result(
            status=final_status,
            screening_method="chained_v1",
            blast_hits=comp_result.blast_hits,
            toxin_probability=comp_result.toxin_probability,
            allergen_probability=comp_result.allergen_probability,
            message=" | ".join(parts),
            blast_top_hits=comp_result.blast_top_hits,
            gravy_score=comp_result.gravy_score,
            amino_acid_composition=comp_result.amino_acid_composition,
            # SecureDNA fields
            secureDNA_checked=sdna_result["checked"],
            secureDNA_windows_screened=sdna_result.get("windows_screened", 0),
            secureDNA_hits=sdna_result.get("hits", []),
            secureDNA_status=sdna_status,
            # IBBIS fields
            ibbis_checked=ibbis_result["checked"],
            ibbis_families_screened=ibbis_result.get("families_screened", 0),
            ibbis_hits=ibbis_result.get("hits", []),
            ibbis_status=ibbis_status,
            # Audit trail
            databases_queried=databases_queried,
        )
