"""POST /api/v1/analyse — lossless-watermark proof endpoint (no auth, no DB write).

Returns everything needed to prove that TINSEL synonymous watermarking
preserves protein sequence identity and mRNA stability:

- control_dna        : host-optimised reference DNA (highest-RSCU codon per AA)
- watermarked_dna    : TINSEL-encoded DNA
- codon_diffs        : positions where codons differ (always synonymous)
- mRNA secondary structure + approximate MFE for both sequences
- codon bias metrics (chi-squared, p-value, per-AA deviations)

No authentication required — intended for the public demo page.
"""

from __future__ import annotations

import logging
import math
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from tinsel.fragment import Fragment, assemble, find_overlaps, parse_multi_fasta
from tinsel.registry import HostOrganism
from tinsel.sequence.fasta import normalise
from tinsel.watermark.encoder import CODON_POOLS, _CODON_TO_AA
from tinsel.watermark.tinsel_encoder import TINSELEncoder

from sentinel_api.config import settings
from sentinel_api.rate_limit import rate_limit_demo
from tinsel_gates.adapters.gate3.codon import _CODON_USAGE, _HOST_MAP

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class AnalyseRequest(BaseModel):
    fasta: str
    host_organism: str = "ECOLI"


class CodonDiff(BaseModel):
    position: int          # 0-indexed codon index in protein
    amino_acid: str
    control_codon: str
    watermarked_codon: str


class AnalyseResponse(BaseModel):
    original_protein: str
    sequence_length: int
    host_organism: str

    # DNA comparison
    control_dna: str
    watermarked_dna: str
    codon_diffs: list[CodonDiff]
    n_codons_changed: int
    n_codons_total: int

    # Watermark provenance
    watermark_tier: str
    carrier_positions: int

    # Codon bias (proof of covertness)
    chi_squared: float
    p_value: float
    is_covert: bool
    per_aa_deviations: dict[str, Any]

    # mRNA analysis
    control_mrna: str
    watermarked_mrna: str
    control_gc: float
    watermarked_gc: float
    delta_gc: float
    control_mfe: float
    watermarked_mfe: float
    delta_mfe: float
    control_dot_bracket: str
    watermarked_dot_bracket: str
    control_pairs: list[list[int]]
    watermarked_pairs: list[list[int]]
    n_pairs_control: int
    n_pairs_watermarked: int


# ---------------------------------------------------------------------------
# Utility: host-optimised control DNA
# ---------------------------------------------------------------------------

def _make_control_dna(protein: str, host: str) -> str:
    """Generate reference DNA using the highest-RSCU codon per amino acid per host."""
    usage = _CODON_USAGE.get(host, _CODON_USAGE["ECOLI"])
    codons: list[str] = []
    for aa in protein.upper():
        pool = CODON_POOLS.get(aa)
        if pool is None:
            raise ValueError(f"Unknown amino acid '{aa}' in sequence")
        best = max(pool, key=lambda c: usage.get(c, 0.0))
        codons.append(best)
    return "".join(codons)


# ---------------------------------------------------------------------------
# Utility: codon diff
# ---------------------------------------------------------------------------

def _codon_diff(protein: str, control: str, watermarked: str) -> list[CodonDiff]:
    diffs: list[CodonDiff] = []
    for i, aa in enumerate(protein.upper()):
        cc = control[i * 3 : i * 3 + 3]
        wc = watermarked[i * 3 : i * 3 + 3]
        if cc != wc:
            diffs.append(CodonDiff(
                position=i,
                amino_acid=aa,
                control_codon=cc,
                watermarked_codon=wc,
            ))
    return diffs


# ---------------------------------------------------------------------------
# Utility: GC content
# ---------------------------------------------------------------------------

def _gc(seq: str) -> float:
    seq = seq.upper()
    if not seq:
        return 0.0
    return sum(1 for b in seq if b in "GC") / len(seq)


# ---------------------------------------------------------------------------
# Nussinov RNA secondary structure  (O(n³), limited to ≤ 300 nt)
# Returns (dot_bracket_str, sorted_pairs_list)
# ---------------------------------------------------------------------------

_RNA_PAIRS = frozenset([
    ("A", "U"), ("U", "A"), ("G", "C"), ("C", "G"), ("G", "U"), ("U", "G"),
])
_MIN_LOOP = 4   # minimum hairpin loop length


def _nussinov(rna: str) -> tuple[str, list[tuple[int, int]]]:
    n = len(rna)
    if n == 0:
        return "", []
    if n > 300:
        return "." * n, []

    # DP table
    dp = [[0] * n for _ in range(n)]
    for span in range(_MIN_LOOP + 1, n + 1):
        for i in range(n - span + 1):
            j = i + span - 1
            dp[i][j] = dp[i][j - 1]   # j unpaired
            for k in range(i, j - _MIN_LOOP):
                if (rna[k], rna[j]) in _RNA_PAIRS:
                    left = dp[i][k - 1] if k > i else 0
                    val = left + dp[k + 1][j - 1] + 1
                    if val > dp[i][j]:
                        dp[i][j] = val

    # Iterative traceback (avoids Python recursion limit)
    pairs: list[tuple[int, int]] = []
    stack: list[tuple[int, int]] = [(0, n - 1)]
    while stack:
        i, j = stack.pop()
        if i >= j:
            continue
        if dp[i][j] == dp[i][j - 1]:
            stack.append((i, j - 1))
        else:
            found = False
            for k in range(i, j - _MIN_LOOP):
                if (rna[k], rna[j]) in _RNA_PAIRS:
                    left = dp[i][k - 1] if k > i else 0
                    if dp[i][j] == left + dp[k + 1][j - 1] + 1:
                        pairs.append((k, j))
                        if k > i:
                            stack.append((i, k - 1))
                        stack.append((k + 1, j - 1))
                        found = True
                        break
            if not found:
                stack.append((i, j - 1))

    pairs.sort()

    # Dot-bracket
    db = ["."] * n
    for i, j in pairs:
        db[i] = "("
        db[j] = ")"

    return "".join(db), pairs


def _approx_mfe(rna: str, pairs: list[tuple[int, int]]) -> float:
    """Simplified nearest-neighbour MFE estimate (kcal/mol)."""
    energy = 0.0
    for i, j in pairs:
        pair = (rna[i], rna[j])
        if pair in (("G", "C"), ("C", "G")):
            energy -= 3.0
        elif pair in (("A", "U"), ("U", "A")):
            energy -= 2.0
        elif pair in (("G", "U"), ("U", "G")):
            energy -= 1.5
    # Approximate loop initiation penalty
    n_stems = max(1, len(pairs) // 3) if pairs else 0
    energy += n_stems * 3.5
    return round(energy, 2)


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

_HOST_ORGANISM_ENUM = {
    "ECOLI": HostOrganism.ECOLI,
    "HUMAN": HostOrganism.HUMAN,
    "YEAST": HostOrganism.YEAST,
    "CHO":   HostOrganism.CHO,
    "INSECT": HostOrganism.INSECT,
    "PLANT":  HostOrganism.PLANT,
}


@router.post("/analyse", response_model=AnalyseResponse, tags=["demo"])
@rate_limit_demo
async def analyse_sequence(request: Request, body: AnalyseRequest) -> AnalyseResponse:
    """Watermark a sequence and return all proof-of-losslessness metrics."""

    # ── 1. Parse FASTA ────────────────────────────────────────────────────
    try:
        _header, sequence, seq_type = normalise(body.fasta)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # Auto-translate DNA → protein if needed
    if seq_type.value == "dna":
        if len(sequence) % 3 != 0:
            raise HTTPException(
                status_code=422,
                detail="DNA length must be a multiple of 3 to translate to protein."
            )
        try:
            protein = "".join(
                _CODON_TO_AA[sequence[i : i + 3].upper()]
                for i in range(0, len(sequence), 3)
                if _CODON_TO_AA.get(sequence[i : i + 3].upper(), "*") != "*"
            )
        except KeyError as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid codon in DNA sequence: {exc}"
            ) from exc
    else:
        protein = sequence.upper()

    if len(protein) < 3:
        raise HTTPException(status_code=422, detail="Sequence must be at least 3 amino acids.")
    if len(protein) > 1000:
        raise HTTPException(
            status_code=422,
            detail="Demo accepts sequences up to 1,000 amino acids. Use the /register endpoint for longer sequences."
        )

    # ── 2. Resolve host ───────────────────────────────────────────────────
    host_key = _HOST_MAP.get(body.host_organism.upper().strip(), "ECOLI")
    host_enum = _HOST_ORGANISM_ENUM.get(host_key, HostOrganism.ECOLI)

    # ── 3. Control DNA (host-optimised, no watermark) ─────────────────────
    try:
        control_dna = _make_control_dna(protein, host_key)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # ── 4. Watermarked DNA via TINSEL encoder ─────────────────────────────
    from sentinel_api.vault import get_vault_client
    vault = get_vault_client()
    spreading_key = await vault.get_spreading_key(settings.spreading_key_id)
    signing_key   = await vault.get_signing_key(settings.spreading_key_id)

    encoder = TINSELEncoder(spreading_key, settings.spreading_key_id, signing_key=signing_key)
    demo_ts = datetime.now(UTC).isoformat()
    try:
        wm_result = encoder.encode_v1(
            protein, "demo-user", demo_ts, "DEMO-000", organism=host_enum
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    watermarked_dna = wm_result.dna_sequence

    # ── 5. Codon diff ─────────────────────────────────────────────────────
    diffs = _codon_diff(protein, control_dna, watermarked_dna)

    # ── 6. mRNA analysis ──────────────────────────────────────────────────
    LIMIT = 300   # Nussinov is O(n³); cap to keep response fast
    ctrl_mrna = control_dna.replace("T", "U")
    wm_mrna   = watermarked_dna.replace("T", "U")

    ctrl_gc = _gc(control_dna)
    wm_gc   = _gc(watermarked_dna)

    ctrl_db,  ctrl_pairs  = _nussinov(ctrl_mrna[:LIMIT])
    wm_db,    wm_pairs    = _nussinov(wm_mrna[:LIMIT])
    ctrl_mfe  = _approx_mfe(ctrl_mrna[:LIMIT], ctrl_pairs)
    wm_mfe    = _approx_mfe(wm_mrna[:LIMIT],   wm_pairs)

    return AnalyseResponse(
        original_protein=protein,
        sequence_length=len(protein),
        host_organism=host_key,
        control_dna=control_dna,
        watermarked_dna=watermarked_dna,
        codon_diffs=diffs,
        n_codons_changed=len(diffs),
        n_codons_total=len(protein),
        watermark_tier=wm_result.config.tier.value,
        carrier_positions=wm_result.carrier_positions,
        chi_squared=wm_result.codon_bias_metrics.chi_squared,
        p_value=wm_result.codon_bias_metrics.p_value,
        is_covert=wm_result.codon_bias_metrics.is_covert,
        per_aa_deviations=wm_result.codon_bias_metrics.per_aa_deviations,
        control_mrna=ctrl_mrna,
        watermarked_mrna=wm_mrna,
        control_gc=round(ctrl_gc, 4),
        watermarked_gc=round(wm_gc, 4),
        delta_gc=round(wm_gc - ctrl_gc, 4),
        control_mfe=ctrl_mfe,
        watermarked_mfe=wm_mfe,
        delta_mfe=round(wm_mfe - ctrl_mfe, 2),
        control_dot_bracket=ctrl_db,
        watermarked_dot_bracket=wm_db,
        control_pairs=[[i, j] for i, j in ctrl_pairs],
        watermarked_pairs=[[i, j] for i, j in wm_pairs],
        n_pairs_control=len(ctrl_pairs),
        n_pairs_watermarked=len(wm_pairs),
    )


# ---------------------------------------------------------------------------
# POST /analyse/fragments — multi-fragment assembly risk screen (no auth)
# ---------------------------------------------------------------------------

_PRIVACY_NOTICE = (
    "Sequences submitted to this endpoint are analysed in memory only and are not "
    "stored, logged, or cached. No record of this submission is retained by ArtGene Archive."
)

_MAX_FRAGMENTS = 50
_MIN_OVERLAP   = 20
_MAX_SEQ_LEN   = 5_000   # per-fragment cap (AA)


class FragmentsRequest(BaseModel):
    fragments_fasta: str = Field(
        description="Multi-FASTA input. Each >header line starts a new fragment. "
                    f"Maximum {_MAX_FRAGMENTS} fragments, each up to {_MAX_SEQ_LEN} AA."
    )
    host_organism: str = "ECOLI"


class FragmentScreenResult(BaseModel):
    header: str
    sequence_length: int
    gate2_status: str
    gate4_status: str
    overall_status: str
    message: str | None = None


class AssemblyResult(BaseModel):
    contigs_found: int
    assembled_length: int
    gate2_status: str
    gate4_status: str
    gate2_message: str | None
    gate4_message: str | None
    overall_status: str
    risk_verdict: str   # "SAFE" | "WARN" | "BLOCKED"


class FragmentsResponse(BaseModel):
    privacy_notice: str = _PRIVACY_NOTICE
    fragment_count: int
    fragment_results: list[FragmentScreenResult]
    assembly_detected: bool
    overlaps_found: int
    assembled_result: AssemblyResult | None
    message: str


@router.post("/analyse/fragments", tags=["demo"])
@rate_limit_demo
async def analyse_fragments(request: Request, body: FragmentsRequest) -> FragmentsResponse:
    """Screen multiple fragments and their assembled product for biosafety risks.

    No authentication required. Sequences are **never stored** — all analysis
    runs in memory only.
    """
    from tinsel_gates.pipeline import run_consequence_pipeline

    # ── 1. Parse fragments ────────────────────────────────────────────────
    try:
        fragments = parse_multi_fasta(body.fragments_fasta, max_fragments=_MAX_FRAGMENTS)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # Validate individual fragment lengths
    for frag in fragments:
        if len(frag.sequence) > _MAX_SEQ_LEN:
            raise HTTPException(
                status_code=422,
                detail=f"Fragment '{frag.header}' exceeds {_MAX_SEQ_LEN} AA limit "
                       f"({len(frag.sequence)} AA).",
            )
        if len(frag.sequence) < 3:
            raise HTTPException(
                status_code=422,
                detail=f"Fragment '{frag.header}' is too short (minimum 3 AA).",
            )

    env = settings.sentinel_env

    # ── 2. Screen each fragment individually (Gates 2+4 only) ────────────
    fragment_results: list[FragmentScreenResult] = []
    for frag in fragments:
        report = await run_consequence_pipeline(
            protein=frag.sequence,
            dna="",
            env=env,
            run_gates=(2, 4),
        )
        g2 = report.gate2
        g4 = report.gate4
        g2_status = g2.status if g2 else "skip"
        g4_status = g4.status if g4 else "skip"

        statuses = [s for s in (g2_status, g4_status) if s != "skip"]
        if "fail" in statuses:
            overall = "fail"
        elif "warn" in statuses:
            overall = "warn"
        else:
            overall = "pass"

        msg_parts = []
        if g2 and g2.message:
            msg_parts.append(f"Gate 2: {g2.message}")
        if g4 and g4.message:
            msg_parts.append(f"Gate 4: {g4.message}")

        fragment_results.append(FragmentScreenResult(
            header=frag.header,
            sequence_length=len(frag.sequence),
            gate2_status=g2_status,
            gate4_status=g4_status,
            overall_status=overall,
            message="; ".join(msg_parts) if msg_parts else None,
        ))

    # ── 3. Overlap detection + assembly ──────────────────────────────────
    overlaps = find_overlaps(fragments, min_overlap=_MIN_OVERLAP)
    contigs  = assemble(fragments, overlaps)

    if not contigs:
        summary = (
            f"{len(fragments)} fragment(s) screened individually — no assembly overlap detected "
            f"(minimum {_MIN_OVERLAP} AA overlap required)."
        )
        any_fail = any(r.overall_status == "fail" for r in fragment_results)
        any_warn = any(r.overall_status == "warn" for r in fragment_results)
        msg = (
            "One or more individual fragments failed biosafety screening."
            if any_fail else
            "One or more individual fragments raised biosafety warnings."
            if any_warn else
            summary
        )
        return FragmentsResponse(
            fragment_count=len(fragments),
            fragment_results=fragment_results,
            assembly_detected=False,
            overlaps_found=0,
            assembled_result=None,
            message=msg,
        )

    # ── 4. Screen assembled contig(s) through Gates 2+4 ──────────────────
    # Use the longest contig as the primary risk target
    primary_contig = max(contigs, key=len)

    assembly_report = await run_consequence_pipeline(
        protein=primary_contig,
        dna="",
        env=env,
        run_gates=(2, 4),
    )

    ag2 = assembly_report.gate2
    ag4 = assembly_report.gate4
    ag2_status = ag2.status if ag2 else "skip"
    ag4_status = ag4.status if ag4 else "skip"

    a_statuses = [s for s in (ag2_status, ag4_status) if s != "skip"]
    if "fail" in a_statuses:
        a_overall = "fail"
        risk_verdict = "BLOCKED"
    elif "warn" in a_statuses:
        a_overall = "warn"
        risk_verdict = "WARN"
    else:
        a_overall = "pass"
        risk_verdict = "SAFE"

    assembled_result = AssemblyResult(
        contigs_found=len(contigs),
        assembled_length=len(primary_contig),
        gate2_status=ag2_status,
        gate4_status=ag4_status,
        gate2_message=ag2.message if ag2 else None,
        gate4_message=ag4.message if ag4 else None,
        overall_status=a_overall,
        risk_verdict=risk_verdict,
    )

    if risk_verdict == "BLOCKED":
        msg = (
            "BLOCKED: these fragments, when assembled, produce a sequence that fails "
            "biosafety screening. Synthesis is not recommended."
        )
    elif risk_verdict == "WARN":
        msg = (
            "WARNING: the assembled product raised biosafety concerns. "
            "Manual review is recommended before proceeding with synthesis."
        )
    else:
        msg = (
            f"Assembly of {len(fragments)} fragment(s) into a {len(primary_contig)}-AA contig "
            "passed biosafety screening."
        )

    return FragmentsResponse(
        fragment_count=len(fragments),
        fragment_results=fragment_results,
        assembly_detected=True,
        overlaps_found=len(overlaps),
        assembled_result=assembled_result,
        message=msg,
    )
