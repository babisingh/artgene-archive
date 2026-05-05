"""Gate 3 (gamma) adapter — codon-composition HGT and ecological risk scoring.

SCREENING METHOD: codon_hgt_composite_v1
-----------------------------------------
All calculations run locally — no external tools or network calls are required.

Ecological risk pipeline:
1. GC content — extreme GC bias is a strong indicator of foreign/transferred DNA.
   Per-host expected GC ranges are embedded; deviation is measured in tolerance units.

2. Codon Adaptation Index (CAI) — Sharp & Li (1987).
   CAI is the geometric mean of relative synonymous codon usage (RSCU) across the
   coding sequence, excluding Met (ATG) and Trp (TGG).  Low CAI vs host indicates
   codon usage mismatch, a recognised signature of horizontal gene transfer (HGT).
   Host-specific RSCU tables are embedded for ECOLI, HUMAN, YEAST, CHO, INSECT, PLANT.

3. HGT score — custom composite metric [0, 100] (codon_hgt_composite_v1):
       hgt_score = 0.35 × gc_component + 0.45 × cai_component + 0.20 × extreme_gc_penalty
   where:
       gc_component  = min(100, |GC − GC_host_mean| / GC_host_tolerance × 25)
       cai_component = min(100, (1 − CAI) × 60)
       extreme_gc    = 20 if GC < 0.30 or GC > 0.70, else 0
   FAIL threshold: hgt_score >= 50.0 (out of 100)

4. Escape probability — composite of HGT score, GC extremity, CAI deviation,
   and sequence length.  Scale [0, 1]; WARN threshold: escape_probability >= 0.15.

References:
    Sharp & Li (1987) — Codon Adaptation Index (CAI). Nucleic Acids Research, 15(3).
    Karlin & Burge (1995) — Dinucleotide relative abundance profiles. Mol Microbiol.
    Ochman, Lawrence & Groisman (2000) — HGT and the nature of bacterial innovation. Nature.

Decision thresholds:
    pathogen_hits > 0          → FAIL  (pathogen DB integration planned for Phase 3)
    hgt_score >= 50.0          → FAIL  (out of 100-point composite scale)
    escape_probability >= 0.15 → WARN
    otherwise                  → PASS
"""

from __future__ import annotations

import logging
import math

from tinsel.consequence import Gate3Result
from tinsel.models import GateStatus

from tinsel_gates.adapters.base import Gate3Adapter

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Codon tables per host — relative synonymous codon usage (RSCU)
#
# Format: {"codon": relative_usage}  where the most-used synonymous codon = 1.0
# Codons with usage < 0.1 are set to 0.1 to avoid log(0) in CAI.
#
# Sources:
#   E.coli  — Welch et al. (2009) / Codon Usage Database (kazusa.or.jp)
#   Human   — Nakamura et al. (2000)
#   Yeast   — Murray et al. (1989)
#   CHO     — approximated from mammalian consensus
#   Insect  — Lim & Bhatt (2020) Sf9 usage table
#   Plant   — Arabidopsis thaliana, Murray et al. (1989) ext.
# ---------------------------------------------------------------------------

_CODON_USAGE: dict[str, dict[str, float]] = {
    "ECOLI": {
        # Phe
        "TTT": 0.58, "TTC": 1.00,
        # Leu
        "TTA": 0.15, "TTG": 0.41, "CTT": 0.21, "CTC": 0.37, "CTA": 0.10, "CTG": 1.00,
        # Ile
        "ATT": 1.00, "ATC": 0.89, "ATA": 0.21,
        # Met
        "ATG": 1.00,
        # Val
        "GTT": 1.00, "GTC": 0.56, "GTA": 0.54, "GTG": 0.63,
        # Ser
        "TCT": 0.41, "TCC": 0.45, "TCA": 0.19, "TCG": 0.41, "AGT": 0.24, "AGC": 1.00,
        # Pro
        "CCT": 0.40, "CCC": 0.28, "CCA": 0.33, "CCG": 1.00,
        # Thr
        "ACT": 0.67, "ACC": 1.00, "ACA": 0.36, "ACG": 0.43,
        # Ala
        "GCT": 0.72, "GCC": 0.60, "GCA": 0.47, "GCG": 1.00,
        # Tyr
        "TAT": 0.59, "TAC": 1.00,
        # His
        "CAT": 0.57, "CAC": 1.00,
        # Gln
        "CAA": 0.36, "CAG": 1.00,
        # Asn
        "AAT": 0.47, "AAC": 1.00,
        # Lys
        "AAA": 1.00, "AAG": 0.28,
        # Asp
        "GAT": 0.58, "GAC": 1.00,
        # Glu
        "GAA": 1.00, "GAG": 0.41,
        # Cys
        "TGT": 0.46, "TGC": 1.00,
        # Trp
        "TGG": 1.00,
        # Arg
        "CGT": 1.00, "CGC": 0.83, "CGA": 0.11, "CGG": 0.11, "AGA": 0.10, "AGG": 0.10,
        # Gly
        "GGT": 1.00, "GGC": 0.69, "GGA": 0.21, "GGG": 0.16,
        # Stop codons (neutral)
        "TAA": 1.00, "TAG": 0.10, "TGA": 0.10,
    },
    "HUMAN": {
        "TTT": 0.46, "TTC": 1.00,
        "TTA": 0.10, "TTG": 0.40, "CTT": 0.44, "CTC": 0.69, "CTA": 0.23, "CTG": 1.00,
        "ATT": 0.71, "ATC": 1.00, "ATA": 0.36,
        "ATG": 1.00,
        "GTT": 0.46, "GTC": 0.56, "GTA": 0.28, "GTG": 1.00,
        "TCT": 0.55, "TCC": 0.82, "TCA": 0.47, "TCG": 0.20, "AGT": 0.44, "AGC": 1.00,
        "CCT": 0.69, "CCC": 0.92, "CCA": 0.75, "CCG": 0.25,
        "ACT": 0.62, "ACC": 1.00, "ACA": 0.74, "ACG": 0.25,
        "GCT": 0.75, "GCC": 1.00, "GCA": 0.62, "GCG": 0.18,
        "TAT": 0.44, "TAC": 1.00,
        "CAT": 0.43, "CAC": 1.00,
        "CAA": 0.35, "CAG": 1.00,
        "AAT": 0.47, "AAC": 1.00,
        "AAA": 0.71, "AAG": 1.00,
        "GAT": 0.47, "GAC": 1.00,
        "GAA": 0.59, "GAG": 1.00,
        "TGT": 0.45, "TGC": 1.00,
        "TGG": 1.00,
        "CGT": 0.18, "CGC": 0.42, "CGA": 0.22, "CGG": 0.56, "AGA": 0.68, "AGG": 1.00,
        "GGT": 0.35, "GGC": 0.74, "GGA": 0.65, "GGG": 1.00,
        "TAA": 0.30, "TAG": 0.24, "TGA": 1.00,
    },
    "YEAST": {
        "TTT": 0.84, "TTC": 1.00,
        "TTA": 0.53, "TTG": 1.00, "CTT": 0.32, "CTC": 0.14, "CTA": 0.27, "CTG": 0.23,
        "ATT": 1.00, "ATC": 0.60, "ATA": 0.26,
        "ATG": 1.00,
        "GTT": 1.00, "GTC": 0.52, "GTA": 0.30, "GTG": 0.27,
        "TCT": 1.00, "TCC": 0.74, "TCA": 0.82, "TCG": 0.27, "AGT": 0.46, "AGC": 0.31,
        "CCT": 0.72, "CCC": 0.32, "CCA": 1.00, "CCG": 0.22,
        "ACT": 1.00, "ACC": 0.67, "ACA": 0.65, "ACG": 0.21,
        "GCT": 1.00, "GCC": 0.63, "GCA": 0.62, "GCG": 0.14,
        "TAT": 0.99, "TAC": 1.00,
        "CAT": 0.62, "CAC": 1.00,
        "CAA": 1.00, "CAG": 0.31,
        "AAT": 1.00, "AAC": 0.80,
        "AAA": 1.00, "AAG": 0.72,
        "GAT": 1.00, "GAC": 0.62,
        "GAA": 1.00, "GAG": 0.47,
        "TGT": 0.67, "TGC": 1.00,
        "TGG": 1.00,
        "CGT": 0.21, "CGC": 0.10, "CGA": 0.10, "CGG": 0.10, "AGA": 1.00, "AGG": 0.62,
        "GGT": 1.00, "GGC": 0.49, "GGA": 0.71, "GGG": 0.21,
        "TAA": 1.00, "TAG": 0.20, "TGA": 0.26,
    },
    "CHO": {  # Approximated from hamster/mammalian consensus
        "TTT": 0.44, "TTC": 1.00,
        "TTA": 0.10, "TTG": 0.38, "CTT": 0.44, "CTC": 0.70, "CTA": 0.22, "CTG": 1.00,
        "ATT": 0.68, "ATC": 1.00, "ATA": 0.33,
        "ATG": 1.00,
        "GTT": 0.44, "GTC": 0.54, "GTA": 0.26, "GTG": 1.00,
        "TCT": 0.55, "TCC": 0.83, "TCA": 0.46, "TCG": 0.18, "AGT": 0.44, "AGC": 1.00,
        "CCT": 0.71, "CCC": 0.94, "CCA": 0.76, "CCG": 0.21,
        "ACT": 0.62, "ACC": 1.00, "ACA": 0.73, "ACG": 0.22,
        "GCT": 0.74, "GCC": 1.00, "GCA": 0.60, "GCG": 0.17,
        "TAT": 0.43, "TAC": 1.00,
        "CAT": 0.43, "CAC": 1.00,
        "CAA": 0.34, "CAG": 1.00,
        "AAT": 0.46, "AAC": 1.00,
        "AAA": 0.70, "AAG": 1.00,
        "GAT": 0.46, "GAC": 1.00,
        "GAA": 0.58, "GAG": 1.00,
        "TGT": 0.44, "TGC": 1.00,
        "TGG": 1.00,
        "CGT": 0.17, "CGC": 0.41, "CGA": 0.21, "CGG": 0.56, "AGA": 0.67, "AGG": 1.00,
        "GGT": 0.34, "GGC": 0.73, "GGA": 0.64, "GGG": 1.00,
        "TAA": 0.28, "TAG": 0.22, "TGA": 1.00,
    },
    "INSECT": {  # Sf9 insect cell codon usage
        "TTT": 0.82, "TTC": 1.00,
        "TTA": 0.18, "TTG": 1.00, "CTT": 0.38, "CTC": 0.46, "CTA": 0.26, "CTG": 0.73,
        "ATT": 0.87, "ATC": 1.00, "ATA": 0.37,
        "ATG": 1.00,
        "GTT": 0.62, "GTC": 0.76, "GTA": 0.36, "GTG": 1.00,
        "TCT": 0.60, "TCC": 0.78, "TCA": 0.69, "TCG": 0.22, "AGT": 0.44, "AGC": 1.00,
        "CCT": 0.80, "CCC": 0.76, "CCA": 1.00, "CCG": 0.26,
        "ACT": 0.73, "ACC": 1.00, "ACA": 0.78, "ACG": 0.28,
        "GCT": 0.84, "GCC": 1.00, "GCA": 0.74, "GCG": 0.23,
        "TAT": 0.72, "TAC": 1.00,
        "CAT": 0.57, "CAC": 1.00,
        "CAA": 0.56, "CAG": 1.00,
        "AAT": 0.64, "AAC": 1.00,
        "AAA": 0.71, "AAG": 1.00,
        "GAT": 0.62, "GAC": 1.00,
        "GAA": 0.68, "GAG": 1.00,
        "TGT": 0.62, "TGC": 1.00,
        "TGG": 1.00,
        "CGT": 0.26, "CGC": 0.62, "CGA": 0.22, "CGG": 0.52, "AGA": 0.66, "AGG": 1.00,
        "GGT": 0.52, "GGC": 0.84, "GGA": 0.74, "GGG": 1.00,
        "TAA": 0.44, "TAG": 0.28, "TGA": 1.00,
    },
    "PLANT": {  # Arabidopsis thaliana
        "TTT": 0.53, "TTC": 1.00,
        "TTA": 0.14, "TTG": 0.54, "CTT": 0.78, "CTC": 0.58, "CTA": 0.22, "CTG": 1.00,
        "ATT": 0.82, "ATC": 1.00, "ATA": 0.42,
        "ATG": 1.00,
        "GTT": 0.72, "GTC": 0.66, "GTA": 0.32, "GTG": 1.00,
        "TCT": 0.92, "TCC": 0.74, "TCA": 0.70, "TCG": 0.32, "AGT": 0.56, "AGC": 1.00,
        "CCT": 0.96, "CCC": 0.54, "CCA": 1.00, "CCG": 0.38,
        "ACT": 0.96, "ACC": 0.82, "ACA": 1.00, "ACG": 0.36,
        "GCT": 1.00, "GCC": 0.72, "GCA": 0.88, "GCG": 0.28,
        "TAT": 0.60, "TAC": 1.00,
        "CAT": 0.54, "CAC": 1.00,
        "CAA": 0.55, "CAG": 1.00,
        "AAT": 0.68, "AAC": 1.00,
        "AAA": 0.72, "AAG": 1.00,
        "GAT": 0.62, "GAC": 1.00,
        "GAA": 0.70, "GAG": 1.00,
        "TGT": 0.58, "TGC": 1.00,
        "TGG": 1.00,
        "CGT": 0.32, "CGC": 0.44, "CGA": 0.28, "CGG": 0.42, "AGA": 0.76, "AGG": 1.00,
        "GGT": 0.62, "GGC": 0.58, "GGA": 0.78, "GGG": 1.00,
        "TAA": 0.56, "TAG": 0.26, "TGA": 1.00,
    },
}

# Host organism name → codon table key
_HOST_MAP = {
    "ECOLI": "ECOLI", "E.COLI": "ECOLI", "E_COLI": "ECOLI",
    "HUMAN": "HUMAN", "HOMO": "HUMAN",
    "YEAST": "YEAST", "S.CEREVISIAE": "YEAST", "SACCHAROMYCES": "YEAST",
    "CHO": "CHO", "MAMMALIAN": "CHO", "HAMSTER": "CHO",
    "INSECT": "INSECT", "SF9": "INSECT", "BACULOVIRUS": "INSECT",
    "PLANT": "PLANT", "ARABIDOPSIS": "PLANT",
}

# Expected GC content range per host (mean ± tolerance → for HGT assessment)
_HOST_GC_RANGE: dict[str, tuple[float, float]] = {
    "ECOLI":  (0.50, 0.08),   # E.coli typically 50–53% GC
    "HUMAN":  (0.41, 0.07),   # human coding regions ~41%
    "YEAST":  (0.40, 0.07),   # S. cerevisiae ~40%
    "CHO":    (0.41, 0.07),
    "INSECT": (0.42, 0.08),
    "PLANT":  (0.44, 0.08),
}

# ---------------------------------------------------------------------------
# HGT thresholds
# ---------------------------------------------------------------------------

_HGT_FAIL_AT = 50.0
_ESCAPE_WARN_AT = 0.15


# ---------------------------------------------------------------------------
# Core calculations
# ---------------------------------------------------------------------------

def _gc_content(dna: str) -> float:
    dna = dna.upper()
    if not dna:
        return 0.0
    gc = sum(1 for b in dna if b in "GC")
    return gc / len(dna)


def _compute_cai(dna: str, host: str) -> float:
    """Compute Codon Adaptation Index (CAI) for a coding sequence.

    CAI is the geometric mean of the relative synonymous codon usage (RSCU)
    for each codon in the sequence, excluding Met (ATG) and Trp (TGG) which
    have no synonyms.

    Returns a value in [0, 1]; higher = better adapted to the host.
    """
    table = _CODON_USAGE.get(host, _CODON_USAGE["ECOLI"])
    dna_upper = dna.upper().replace("U", "T")

    log_sum = 0.0
    count = 0
    for i in range(0, len(dna_upper) - 2, 3):
        codon = dna_upper[i : i + 3]
        if len(codon) < 3:
            continue
        # Skip Met and Trp (no synonyms) and stop codons
        if codon in ("ATG", "TGG", "TAA", "TAG", "TGA"):
            continue
        rscu = table.get(codon, 0.1)
        log_sum += math.log(max(rscu, 0.01))
        count += 1

    if count == 0:
        return 0.5  # fallback — no degenerate codons (very short sequence)
    return round(math.exp(log_sum / count), 4)


def _hgt_score(gc: float, cai: float, host: str) -> tuple[float, list[str]]:
    """Compute HGT risk score [0, 100] and list of risk factors.

    Higher score = greater likelihood of horizontal gene transfer origin.
    Combines:
    - GC content deviation from host typical range
    - CAI deviation (low CAI = codon bias mismatch)
    - Extreme GC penalty (< 0.3 or > 0.7 flagged as strongly alien)
    """
    risk_factors: list[str] = []
    gc_mean, gc_tol = _HOST_GC_RANGE.get(host, (0.50, 0.08))

    gc_deviation = abs(gc - gc_mean) / gc_tol  # in units of "tolerance sigmas"
    cai_deviation = 1.0 - cai                   # 0 = perfect adaptation, 1 = no adaptation

    # Component scores [0, 100]
    gc_score = min(100.0, gc_deviation * 25.0)
    cai_score = min(100.0, cai_deviation * 60.0)

    # Extreme GC content bonus
    extreme_gc_penalty = 0.0
    if gc < 0.30:
        extreme_gc_penalty = 20.0
        risk_factors.append(f"Extremely low GC content ({gc*100:.1f}%) — AT-rich foreign DNA signature")
    elif gc > 0.70:
        extreme_gc_penalty = 20.0
        risk_factors.append(f"Extremely high GC content ({gc*100:.1f}%) — GC-biased foreign DNA signature")

    if gc_deviation > 1.5:
        risk_factors.append(
            f"GC content ({gc*100:.1f}%) deviates {gc_deviation:.1f}σ from host {host} "
            f"typical range ({gc_mean*100:.0f}% ± {gc_tol*100:.0f}%)"
        )

    if cai < 0.5:
        risk_factors.append(
            f"Low CAI ({cai:.3f}) vs host {host} — codon usage incompatible "
            f"with host translational machinery"
        )
    elif cai < 0.7:
        risk_factors.append(f"Moderate CAI ({cai:.3f}) — suboptimal codon adaptation to host {host}")

    score = min(100.0, gc_score * 0.35 + cai_score * 0.45 + extreme_gc_penalty * 0.20)
    return round(score, 2), risk_factors


def _escape_probability(gc: float, cai: float, seq_length: int, hgt: float) -> float:
    """Estimate evolutionary escape probability.

    Longer sequences with extreme GC, low CAI, and high HGT risk are more
    likely to persist in an unintended host and acquire adaptive mutations.
    Scale is [0, 1]; threshold for WARN is 0.15.
    """
    length_factor = min(1.0, seq_length / 1500.0)   # saturates at 1500 AA
    gc_extremity = abs(gc - 0.50) * 2.0             # 0 = neutral, 1 = extreme
    hgt_factor = hgt / 100.0

    raw = 0.3 * hgt_factor + 0.3 * gc_extremity + 0.2 * (1.0 - cai) + 0.2 * length_factor
    return round(min(1.0, raw), 4)


# ---------------------------------------------------------------------------
# Real Gate 3 adapter
# ---------------------------------------------------------------------------

class CodonGate3Adapter(Gate3Adapter):
    """Gate 3 implementation: codon-composition HGT and ecological risk scoring.

    All calculations are local — no network calls required.
    """

    mock_mode = False

    async def run(self, dna: str, protein: str) -> Gate3Result:
        # Resolve host from the DNA context (protein won't tell us host)
        # Host organism is not passed via the adapter interface, so we default
        # to ECOLI and let the pipeline inject it if available via subclassing.
        host = getattr(self, "_host_organism", "ECOLI").upper().strip()
        host_key = _HOST_MAP.get(host, "ECOLI")

        if not dna:
            return Gate3Result(
                status=GateStatus.PASS,
                pathogen_hits=0,
                hgt_score=None,
                escape_probability=None,
                message="No DNA sequence provided — codon and HGT analysis skipped (protein-only submission)",
                gc_content=None,
                codon_adaptation_index=None,
                hgt_risk_factors=None,
            )

        gc = _gc_content(dna)
        cai = _compute_cai(dna, host_key)
        hgt, risk_factors = _hgt_score(gc, cai, host_key)
        escape_prob = _escape_probability(gc, cai, len(protein), hgt)

        # Pathogen screen — not implemented (Phase 3 DB integration)
        pathogen_hits = 0

        # ── Thresholds ────────────────────────────────────────────────────
        if pathogen_hits > 0:
            status = GateStatus.FAIL
            msg = f"{pathogen_hits} known pathogen sequence match(es) detected"
        elif hgt >= _HGT_FAIL_AT:
            status = GateStatus.FAIL
            msg = (
                f"HGT risk score {hgt:.1f}/100 >= {_HGT_FAIL_AT} threshold "
                f"(GC {gc*100:.1f}%, CAI {cai:.3f})"
            )
        elif escape_prob >= _ESCAPE_WARN_AT:
            status = GateStatus.WARN
            msg = (
                f"Escape probability {escape_prob:.3f} >= {_ESCAPE_WARN_AT} — "
                f"elevated persistence risk (HGT score {hgt:.1f}/100)"
            )
        else:
            status = GateStatus.PASS
            msg = (
                f"HGT score {hgt:.1f}/100, GC {gc*100:.1f}%, CAI {cai:.3f}, "
                f"escape prob {escape_prob:.3f} — within safe thresholds"
            )

        return Gate3Result(
            status=status,
            pathogen_hits=pathogen_hits,
            hgt_score=hgt,
            escape_probability=escape_prob,
            message=msg,
            gc_content=round(gc, 4),
            codon_adaptation_index=cai,
            hgt_risk_factors=risk_factors if risk_factors else None,
        )


def make_codon_gate3_adapter(host_organism: str) -> CodonGate3Adapter:
    """Factory that returns a CodonGate3Adapter pre-configured for a host organism."""
    adapter = CodonGate3Adapter()
    adapter._host_organism = host_organism  # type: ignore[attr-defined]
    return adapter
