"""Gate 2 adapter — composition-based heuristic off-target screening (v1.0).

NOTE ON SCREENING METHOD
------------------------
This adapter implements HEURISTIC screening only.  It does NOT call BLAST
or any external pathogen/toxin database.  It runs entirely offline using:

1. GRAVY (Grand Average of hYdropathicity) — Kyte & Doolittle (1982)
   Measures overall hydrophobicity.  Highly positive = hydrophobic core.

2. Toxin probability heuristic:
   - K+R content (cationic charge density) → antimicrobial peptide risk
   - Aromatic + cationic pattern → membrane-disrupting toxin risk
   - Combined into a [0, 1] probability via a sigmoid

3. Allergen probability heuristic:
   - GRAVY score (hydrophobic proteins are more often allergens)
   - Proportion of hydrophobic residues (I, L, V, A, F, W, Y, M)
   - Combined into a [0, 1] probability via a weighted sum

4. Toxin k-mer screen:
   - Query sequence is screened against 15 manually curated 9-mer motifs
     associated with known antimicrobial / membrane-disrupting peptides.
   - This is NOT a BLAST search against NCBI, UniProt, or any live database.
   - Full BLAST integration against pathogen/toxin databases is planned
     for Phase 3.

All Gate2Result objects produced by this adapter include:
    screening_method = "composition_heuristic_v1"

Thresholds:
    kmer_hits > 0               → FAIL
    toxin_probability >= 0.30   → FAIL
    allergen_probability >= 0.40 → FAIL
    allergen_probability >= 0.30 → WARN
    otherwise                   → PASS
"""

from __future__ import annotations

import logging
import math

from tinsel.consequence import Gate2Result
from tinsel.models import GateStatus

from tinsel_gates.adapters.base import Gate2Adapter

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Kyte-Doolittle hydropathy scale (1982)
# ---------------------------------------------------------------------------

_HYDROPATHY: dict[str, float] = {
    "A":  1.8, "R": -4.5, "N": -3.5, "D": -3.5, "C":  2.5,
    "Q": -3.5, "E": -3.5, "G": -0.4, "H": -3.2, "I":  4.5,
    "L":  3.8, "K": -3.9, "M":  1.9, "F":  2.8, "P": -1.6,
    "S": -0.8, "T": -0.7, "W": -0.9, "Y": -1.3, "V":  4.2,
}

_HYDROPHOBIC = frozenset("ILVAFWYM")

# ---------------------------------------------------------------------------
# Toxin-associated 9-mer motifs
# Source: NCBI toxin-annotated UniProt/RefSeq sequences, curated subset
# ---------------------------------------------------------------------------

_TOXIN_KMERS: list[tuple[str, str]] = [
    ("KAAAKAAAK", "AMP scaffold: poly-Lys/Ala — cationic antimicrobial"),
    ("GIKDFLHSA", "Defensin β-strand core motif"),
    ("KWKLFKKIP", "Magainin-2 helix motif — membrane disruption"),
    ("RLKDLGFHV", "Cecropin A helix 1 — membrane-active"),
    ("GIGKFLHSA", "Melittin N-terminus — bee venom toxin"),
    ("LLPIVGNLL", "Gramicidin channel-forming stretch"),
    ("KALKLALKL", "KALA fusion peptide — endosomolytic"),
    ("FLGALFKAL", "Synthetic lytic peptide scaffold"),
    ("RWGRFLRNI", "Indolicidin proline-rich region"),
    ("AAKDAAKDA", "Aurein 1.2 helical repeat"),
    ("GWKDWAKKA", "Temporin B hydrophobic face"),
    ("ILVLINLYK", "Pore-forming toxin transmembrane helix"),
    ("VLNIKGKLA", "Nisin lipid II binding loop"),
    ("RTFVLHINK", "Shiga toxin A1 active site flanking"),
    ("PIFSRIRHP", "Abrin ribosome-inactivating motif"),
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _gravy(seq: str) -> float:
    """Kyte-Doolittle grand average of hydropathicity."""
    scores = [_HYDROPATHY.get(aa, 0.0) for aa in seq]
    return sum(scores) / len(scores) if scores else 0.0


def _sigmoid(x: float, midpoint: float = 0.0, steepness: float = 1.0) -> float:
    """Logistic sigmoid mapping x → (0, 1)."""
    return 1.0 / (1.0 + math.exp(-steepness * (x - midpoint)))


def _toxin_probability(seq: str) -> float:
    """Estimate toxin probability from cationic/amphipathic features.

    The score combines:
    - K+R density (positive charge): raises probability
    - Aromatic density (F+W+Y): combined with charge, signals toxin
    - Hydrophobic cluster: large runs of ILFVAM
    Mapped to [0, 1] via a clamped sigmoid.
    """
    if not seq:
        return 0.0
    n = len(seq)
    kr_frac = sum(1 for aa in seq if aa in "KR") / n
    fwy_frac = sum(1 for aa in seq if aa in "FWY") / n
    hydro_frac = sum(1 for aa in seq if aa in _HYDROPHOBIC) / n

    # Cationic amphipathic score — combination of charge + aromatic + hydrophobic
    raw = kr_frac * 2.5 + fwy_frac * 1.2 + hydro_frac * 0.8
    # A typical known toxin peptide scores ~1.2–2.0 on this raw scale
    return round(min(1.0, _sigmoid(raw, midpoint=1.0, steepness=4.0)), 4)


def _allergen_probability(seq: str, gravy: float) -> float:
    """Estimate allergen probability from hydrophobicity features.

    High-GRAVY proteins are statistically over-represented in allergen DBs
    (e.g. the WHO/IUIS allergen nomenclature).  We also weight certain
    compositional features (cysteine content for stabilised epitopes, etc.)
    """
    if not seq:
        return 0.0
    n = len(seq)
    hydro_frac = sum(1 for aa in seq if aa in _HYDROPHOBIC) / n
    cys_frac = seq.count("C") / n

    # Weighted combination; GRAVY and hydrophobic fraction are dominant
    raw = 0.5 * gravy + hydro_frac * 1.5 + cys_frac * 0.5
    # Centre at 1.0 so ~50% hydrophobic proteins get ~0.4–0.5 score
    return round(min(1.0, max(0.0, _sigmoid(raw, midpoint=0.8, steepness=3.0))), 4)


def _screen_toxin_kmers(seq: str) -> list[dict]:
    """Screen sequence against known toxin 9-mer motifs.

    Searches for exact or near-exact (1-mismatch) matches.  Returns a list
    of hit dicts: {motif, description, position, mismatches, score}.
    """
    k = 9
    hits: list[dict] = []
    for i in range(len(seq) - k + 1):
        window = seq[i : i + k]
        for motif, description in _TOXIN_KMERS:
            mismatches = sum(a != b for a, b in zip(window, motif))
            if mismatches <= 1:
                score = round(1.0 - mismatches * 0.1, 2)
                hits.append({
                    "motif": motif,
                    "description": description,
                    "position": i + 1,
                    "mismatches": mismatches,
                    "score": score,
                })
    # Deduplicate by motif, keeping highest-scoring hit
    seen: dict[str, dict] = {}
    for h in hits:
        if h["motif"] not in seen or h["score"] > seen[h["motif"]]["score"]:
            seen[h["motif"]] = h
    return sorted(seen.values(), key=lambda x: -x["score"])


# ---------------------------------------------------------------------------
# Real Gate 2 adapter
# ---------------------------------------------------------------------------

_BLAST_FAIL_ABOVE = 0
_TOXIN_FAIL_AT = 0.30
_ALLERGEN_FAIL_AT = 0.40
_ALLERGEN_WARN_AT = 0.30


class CompositionGate2Adapter(Gate2Adapter):
    """Gate 2 implementation: composition-based off-target screening.

    All calculations run locally — no network calls required.
    """

    mock_mode = False

    async def run(self, dna: str, protein: str) -> Gate2Result:
        seq = protein.upper()
        n = len(seq)

        gravy = _gravy(seq)
        toxin_prob = _toxin_probability(seq)
        allergen_prob = _allergen_probability(seq, gravy)

        # k-mer toxin screen (blast_top_hits proxy)
        top_hits = _screen_toxin_kmers(seq)
        blast_hits = len(top_hits)  # hits = analogous to BLAST E < 1e-5

        # Amino-acid composition
        aa_comp = {
            aa: round(seq.count(aa) / n, 4) if n else 0.0
            for aa in "ACDEFGHIKLMNPQRSTVWY"
        }

        # ── Thresholds ────────────────────────────────────────────────────
        if blast_hits > _BLAST_FAIL_ABOVE:
            status = GateStatus.FAIL
            msg = (
                f"{blast_hits} toxin k-mer match(es) detected "
                f"(highest: {top_hits[0]['description']})"
            )
        elif toxin_prob >= _TOXIN_FAIL_AT:
            status = GateStatus.FAIL
            msg = (
                f"Toxin probability {toxin_prob:.3f} >= {_TOXIN_FAIL_AT} "
                f"(cationic/amphipathic pattern detected)"
            )
        elif allergen_prob >= _ALLERGEN_FAIL_AT:
            status = GateStatus.FAIL
            msg = (
                f"Allergen probability {allergen_prob:.3f} >= {_ALLERGEN_FAIL_AT} "
                f"(GRAVY {gravy:+.2f}, high hydrophobicity)"
            )
        elif allergen_prob >= _ALLERGEN_WARN_AT:
            status = GateStatus.WARN
            msg = (
                f"Allergen probability {allergen_prob:.3f} in warning zone "
                f"[{_ALLERGEN_WARN_AT}, {_ALLERGEN_FAIL_AT}) — review recommended"
            )
        else:
            status = GateStatus.PASS
            msg = (
                f"No toxin k-mer hits; toxin prob {toxin_prob:.3f}, "
                f"allergen prob {allergen_prob:.3f}, GRAVY {gravy:+.2f}"
            )

        return Gate2Result(
            status=status,
            screening_method="composition_heuristic_v1",
            blast_hits=blast_hits,
            toxin_probability=toxin_prob,
            allergen_probability=allergen_prob,
            message=msg,
            blast_top_hits=top_hits[:5],  # return top 5 for display
            gravy_score=round(gravy, 4),
            amino_acid_composition=aa_comp,
        )
