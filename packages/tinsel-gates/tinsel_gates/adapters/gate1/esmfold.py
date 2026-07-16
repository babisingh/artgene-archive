"""Gate 1 real adapter — ESMFold pLDDT + protein instability index.

Structural analysis pipeline:
1. POST protein sequence to the public ESMFold Atlas API (≤ 400 AA).
2. Parse the returned PDB file — extract per-residue pLDDT from B-factor
   column of Cα (CA) ATOM records.
3. Compute instability index (Guruprasad 1990) from dipeptide composition.
4. Apply standard thresholds and return a Gate1Result with rich fields.

Fails **closed** to a WARN (structure not assessed — never a synthetic PASS) on:
  - Network / timeout error
  - Sequence length > 400 AA (ESMFold Atlas limit)
  - Malformed PDB response
Unexpected (non-transport) errors propagate rather than being masked.

Thresholds (same as mock):
    pLDDT mean < 70.0          → FAIL
    low fraction (< 50) ≥ 0.20 → FAIL
    instability index > 40     → WARN (structural instability likely)
    ΔMFE placeholder           → 0.0 (LinearFold not integrated)
"""

from __future__ import annotations

import logging

import httpx
from tinsel.consequence import Gate1Result
from tinsel.models import GateStatus

from tinsel_gates.adapters.base import Gate1Adapter

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ESMFOLD_URL = "https://api.esmatlas.com/foldSequence/v1/pdb/"
ESMFOLD_MAX_LENGTH = 400      # AA — Atlas rejects longer sequences
ESMFOLD_TIMEOUT_S = 30.0      # seconds; folding is compute-intensive

_PLDDT_FAIL_BELOW: float = 70.0
_LOW_FRAC_FAIL_AT: float = 0.20
_INSTABILITY_WARN_AT: float = 40.0

# ---------------------------------------------------------------------------
# Instability index — Guruprasad et al. (1990) DIWV dipeptide weights
#
# Only values that differ meaningfully from 0 are listed; the calculation
# sums DIWV[aa_i][aa_{i+1}] over the sequence and scales by 10/length.
# The default for any unlisted dipeptide is 1.0 (slightly destabilising).
# ---------------------------------------------------------------------------

_DIWV: dict[str, float] = {
    # Strongly destabilising (positive)
    "WM": 24.68, "WH": 24.68, "CW": 24.68, "HH": 21.86,
    "RH": 20.92, "YW": 20.26, "RW": 20.26, "QW": 18.17,
    "LW": 13.34, "NW": 13.34, "GW": 13.34, "FW": 13.34,
    "KW": 13.34, "MW": 13.34, "IW": 13.34, "SW": 13.34,
    "TW": 13.34, "VW": 13.34, "AW": 13.34, "DW": 13.34,
    "EW": 13.34, "PW": 13.34, "HW": 13.34, "WW":  1.00,
    "WC":  1.00, "WY":  1.00, "WF":  1.00, "WQ":  1.00,
    "WN": 13.34, "WA":  1.00, "WI":  1.00, "WL": 13.34,
    "WR":  1.00, "WD":  1.00, "WE":  1.00, "WK":  1.00,
    "WP":  1.00, "WS":  1.00, "WV":  -7.49, "WT": -14.03,
    "WG":  -9.37,
    # Stabilising (negative)
    "IT": -14.03, "IV": -7.49, "IL": -7.49, "IM": -7.49,
    "VT": -14.03, "LT": -14.03, "LV":  -7.49, "LA": -7.49,
    "LL": -7.49,  "LI": -7.49, "LS": -7.49,  "AL": -7.49,
    "VI": -7.49,  "VA": -7.49, "VV": -7.49,  "VL": -7.49,
    "VS": -7.49,  "AI": -7.49, "AV": -7.49,  "AA": -7.49,
    "AS": -7.49,  "SI": -7.49, "SV": -7.49,  "SA": -7.49,
    "SS": -7.49,  "SL": -7.49,
}


def _compute_instability_index(seq: str) -> float:
    """Return Guruprasad instability index for an amino-acid sequence."""
    if len(seq) < 2:
        return 0.0
    total = sum(_DIWV.get(seq[i : i + 2], 1.0) for i in range(len(seq) - 1))
    return (10.0 / len(seq)) * total


# ---------------------------------------------------------------------------
# PDB parser — extracts per-residue pLDDT from ESMFold output
# ---------------------------------------------------------------------------

def _parse_plddt_from_pdb(pdb_text: str) -> list[float]:
    """Extract per-residue pLDDT scores from ESMFold PDB output.

    ESMFold stores the per-residue pLDDT in the B-factor (temperature factor)
    column (characters 60-66) of each ATOM record.  We take the Cα (CA) atom
    for each residue to get exactly one score per residue.

    Returns an empty list if the PDB cannot be parsed.
    """
    scores: list[float] = []
    seen_residues: set[tuple[str, int]] = set()

    for line in pdb_text.splitlines():
        if not line.startswith("ATOM"):
            continue
        atom_name = line[12:16].strip()
        if atom_name != "CA":
            continue
        chain = line[21]
        try:
            res_seq = int(line[22:26].strip())
        except ValueError:
            continue
        key = (chain, res_seq)
        if key in seen_residues:
            continue
        seen_residues.add(key)
        try:
            bfactor = float(line[60:66].strip())
            scores.append(bfactor)
        except (ValueError, IndexError):
            continue

    return scores


# ---------------------------------------------------------------------------
# Fail-closed degraded result
# ---------------------------------------------------------------------------

def _degraded_gate1(protein: str, reason: str) -> Gate1Result:
    """Return a fail-closed Gate 1 result when the structure could not be assessed.

    Structural confidence is *unknown* — so the gate returns ``WARN`` (never a
    synthetic ``PASS``): the sequence is flagged for manual review rather than
    silently certified as well-folded.  pLDDT fields are ``None`` because no
    folding was performed; the (sequence-only) instability index is still
    reported.  A ``WARN`` does not trip the pipeline's Gate-1 fail-fast, so the
    off-target / ecological / functional gates still run.
    """
    return Gate1Result(
        status=GateStatus.WARN,
        plddt_mean=None,
        plddt_low_fraction=None,
        delta_mfe=None,
        message=(
            f"Structural confidence NOT assessed — {reason}. "
            "Result is not a structural PASS; flagged for manual review."
        ),
        plddt_per_residue=None,
        instability_index=round(_compute_instability_index(protein), 2),
        sequence_length=len(protein),
    )


# ---------------------------------------------------------------------------
# Real Gate 1 adapter
# ---------------------------------------------------------------------------

class ESMFoldGate1Adapter(Gate1Adapter):
    """Gate 1 implementation: ESMFold API for pLDDT + instability index.

    When the sequence is longer than ``ESMFOLD_MAX_LENGTH`` or ESMFold is
    unreachable / returns an unparseable structure, the gate **fails closed**:
    it returns ``WARN`` (structure not assessed), never a synthetic ``PASS``.
    Unexpected (non-network) errors are allowed to propagate so they surface as
    a pipeline error rather than being silently swallowed.
    """

    mock_mode = False

    async def run(self, dna: str, protein: str) -> Gate1Result:
        sequence_length = len(protein)

        # ── Long sequence: ESMFold Atlas cannot fold > limit → fail closed ─
        if sequence_length > ESMFOLD_MAX_LENGTH:
            logger.info(
                "Sequence length %d > %d; Gate 1 cannot assess structure (WARN)",
                sequence_length,
                ESMFOLD_MAX_LENGTH,
            )
            return _degraded_gate1(
                protein,
                f"sequence length {sequence_length} exceeds the ESMFold Atlas "
                f"limit of {ESMFOLD_MAX_LENGTH} AA",
            )

        # ── ESMFold API call ─────────────────────────────────────────────
        # Narrow catch: only expected transient transport errors degrade to a
        # WARN.  Anything else propagates (fail closed via a pipeline error)
        # rather than being masked as "API unavailable".
        pdb_text: str | None = None
        try:
            async with httpx.AsyncClient(timeout=ESMFOLD_TIMEOUT_S) as client:
                response = await client.post(
                    ESMFOLD_URL,
                    content=protein,
                    headers={"Content-Type": "text/plain"},
                )
                response.raise_for_status()
                pdb_text = response.text
        except (TimeoutError, httpx.HTTPError) as exc:
            logger.warning("ESMFold API call failed: %s; Gate 1 fails closed (WARN)", exc)
            return _degraded_gate1(protein, f"ESMFold API unavailable ({type(exc).__name__})")

        # ── Parse PDB ────────────────────────────────────────────────────
        plddt_scores = _parse_plddt_from_pdb(pdb_text)
        if not plddt_scores:
            logger.warning("No pLDDT scores extracted from ESMFold PDB; Gate 1 fails closed (WARN)")
            return _degraded_gate1(protein, "ESMFold returned an unparseable structure")

        # ── Compute metrics ───────────────────────────────────────────────
        plddt_mean = sum(plddt_scores) / len(plddt_scores)
        low_fraction = sum(1 for s in plddt_scores if s < 50.0) / len(plddt_scores)
        instability_ii = _compute_instability_index(protein)

        # ── Apply thresholds ──────────────────────────────────────────────
        if plddt_mean < _PLDDT_FAIL_BELOW:
            status = GateStatus.FAIL
            msg = (
                f"pLDDT mean {plddt_mean:.1f} < {_PLDDT_FAIL_BELOW} threshold "
                f"(low structural confidence)"
            )
        elif low_fraction >= _LOW_FRAC_FAIL_AT:
            status = GateStatus.FAIL
            msg = (
                f"{low_fraction * 100:.1f}% of residues have pLDDT < 50 "
                f"(>= {_LOW_FRAC_FAIL_AT * 100:.0f}% threshold — highly disordered)"
            )
        elif instability_ii > _INSTABILITY_WARN_AT:
            status = GateStatus.WARN
            msg = (
                f"pLDDT mean {plddt_mean:.1f} (PASS), but instability index "
                f"{instability_ii:.1f} > {_INSTABILITY_WARN_AT} — protein may be unstable in vivo"
            )
        else:
            status = GateStatus.PASS
            msg = (
                f"pLDDT mean {plddt_mean:.1f}, low fraction {low_fraction:.2f}, "
                f"instability index {instability_ii:.1f} (all within thresholds)"
            )

        return Gate1Result(
            status=status,
            plddt_mean=round(plddt_mean, 2),
            plddt_low_fraction=round(low_fraction, 4),
            delta_mfe=0.0,
            message=msg,
            plddt_per_residue=[round(s, 1) for s in plddt_scores],
            instability_index=round(instability_ii, 2),
            sequence_length=sequence_length,
        )
