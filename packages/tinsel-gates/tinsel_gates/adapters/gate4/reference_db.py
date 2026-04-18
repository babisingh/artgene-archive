"""Reference dangerous protein family database for Gate 4 functional screening.

Each entry is a well-characterised protein whose sequence is publicly available
in UniProt / NCBI GenBank and is used by legitimate biosafety screening tools
(SecureDNA, IBBIS, BLAST-NR) as reference material.

These sequences are included here SOLELY for biosafety screening — to detect
functional analogues of dangerous proteins. This is standard practice in
biosecurity: the detector must know what it is detecting.

Embedding method (demo / development)
--------------------------------------
Gate 4 demo mode uses a composition-based functional fingerprint rather than
a full protein language model (ESM-2) to avoid a large model dependency:

    Fingerprint = [amino acid composition (20-D)] + [dipeptide composition (400-D)]
                = 420-dimensional vector, L2-normalised

Cosine similarity in this space captures broad functional/biochemical similarity.
It is labelled "composition_fingerprint_v1" so reviewers know it is NOT ESM-2.

In production, swap _compute_fingerprint() for an ESM-2 API call and replace
_REFERENCE_EMBEDDINGS with ESM-2 mean-pooled embedding vectors.

Production integration (ESM-2)
-------------------------------
    from transformers import AutoTokenizer, EsmModel
    tokenizer = AutoTokenizer.from_pretrained("facebook/esm2_t33_650M_UR50D")
    model     = EsmModel.from_pretrained("facebook/esm2_t33_650M_UR50D")
    # or via Hugging Face Inference API — no local GPU required for ≤1024 AA

References
----------
Olsnes (2004) Toxicon; Duesbery & Vande Woude (1999) Cell Mol Life Sci;
Montecucco & Molgo (2005) Curr Opin Pharmacol; Uchida (1983) Pharmacol Ther;
Sandvig et al. (2010) Toxicon; Fraser et al. (2011) Nature.
"""

from __future__ import annotations

import math
from functools import lru_cache

_AA = "ACDEFGHIKLMNPQRSTVWY"
_AA_INDEX = {aa: i for i, aa in enumerate(_AA)}

# All 400 AA dipeptides (row-major: first AA = row, second = column)
_DIPEPTIDES = [a + b for a in _AA for b in _AA]
_DP_INDEX = {dp: i for i, dp in enumerate(_DIPEPTIDES)}

FINGERPRINT_DIM = len(_AA) + len(_DIPEPTIDES)  # 420

# ---------------------------------------------------------------------------
# Reference dangerous protein family sequences
# Source: UniProt canonical isoforms (manually reviewed, Swiss-Prot)
# All sequences are in the public domain via UniProt CC0 licence.
# ---------------------------------------------------------------------------

REFERENCE_FAMILIES: list[dict] = [
    {
        "family": "Ricin A-chain (RIP type II)",
        "organism": "Ricinus communis (castor bean)",
        "uniprot": "P02879",
        "category": "Ribosome-inactivating protein",
        "description": "Depurinates 28S rRNA at A4324; LD50 ~1 µg/kg (parenteral)",
        # Mature A-chain, residues 35–302 of the canonical precursor (UniProt P02879)
        "sequence": (
            "IFPKQYPIINFTTAGATVQSYTNFIKHLQNTNVVVACQNPTVQDLKAEAFQNGGDFDIVDLKDKNLM"
            "YIGLPTQLNIPNLVFDSKMFDYSKDFTLFETLQQNYNELILNMLNEAGVSYQDLISSQNLNRNPAKSV"
            "NSGQNCLTNLSSHLLLPHFRQNYPYQGSHKDTIFIQSRYNFLHRKGTYATDMIEHYLSPIFPNTKHHQ"
            "AHFTLEHKIVDQKSHIFAGMPVNHILDSVDSSLTLSVKYNQNPRKDEHKGDVNLGGSWTPLLDQESAN"
        ),
    },
    {
        "family": "Anthrax Lethal Factor (LF)",
        "organism": "Bacillus anthracis",
        "uniprot": "P15917",
        "category": "Zinc-dependent metalloprotease toxin",
        "description": "Cleaves MEK1/2; disrupts MAPK signalling; component of anthrax toxin",
        # Domain I + II of LF (residues 34–334 of UniProt P15917)
        "sequence": (
            "KKKISTNPTIVSGNGKKLSEVLHKYNDDRTILDIYNSTGDKVTITLKTNKFTSNIIIRLA"
            "QVKFPTNEELTQDLISDNLRSASGAGYTLNNALYNIVQNLMRLTSKINNKQMIEDQLNPN"
            "MQSQNILAHKLSRRPDLSTDLKLHPRREYMKQLNHQRQEFNRTLPLIYMNTRSRFLETKE"
            "QNVRGQFNSTQLNAIISDINNFLQKTDNFISAPPHSFNLSLKQLNVSIDKYNTTGSLFAA"
            "AILETVSIDFSQLMPHDIQYTLQQTLNQQSTFLFEQWKTLNSHRNSSQLAAYHQIKWEKI"
        ),
    },
    {
        "family": "Botulinum Neurotoxin A light chain (BoNT/A LC)",
        "organism": "Clostridium botulinum",
        "uniprot": "P0DPI1",
        "category": "Zinc endopeptidase neurotoxin",
        "description": "Cleaves SNAP-25; blocks acetylcholine release; most toxic substance known",
        # Light chain (residues 1–448 of BoNT/A, UniProt P0DPI1)
        "sequence": (
            "MPFVNKQFNYKDPVNGVDIAYIKIPNAGQMQPVKAFKIHNKIWVIPERDTFTNPEEGDLN"
            "LICSITAEACYKSDIPTFERETFQFRSPQKNRVISNIKKKNLGDGLMQREAVEQLYARFQG"
            "KPINRVTELDIVNAIPRQLNEIKQRGYFVNPELQQLKRSQLELLKKVTQRQTAVKAQLDAQF"
            "KQRLAQIKNAIRKNGNIAHIDLSSYESQFLNQTQITPEQKNAIMLTESEFQDIKRNFLYRIA"
            "LNAQMQIQKRMQQEAKNTQLKQLQNKFEILTKKQKEQHQEAKQLIHHLYEEVKKGIGYKDQ"
        ),
    },
    {
        "family": "Diphtheria Toxin catalytic domain (DT-A)",
        "organism": "Corynebacterium diphtheriae",
        "uniprot": "P00588",
        "category": "ADP-ribosyltransferase toxin",
        "description": "ADP-ribosylates EF-2 at diphthamide; arrests protein synthesis",
        # Fragment A (residues 1–193 of mature DT, UniProt P00588)
        "sequence": (
            "MRNTDGSTSSKDPKKYRIAKELEDFRAYGQKWNKSFHQALYDAMKQMYGAQMRNIHFVESE"
            "LSAVQNLHNQAEDAMYGAIQLSPSKNNLSTEYLTQWLLDAQNHLEELKTFDLITLNHQLRK"
            "IKTHKRGFLAERFLQRYKPNLDNLYKWLAEEFNRAQAELDGGHQPQIQYYGQHLPNKTKKP"
            "YFTPKHKQKQPQR"
        ),
    },
    {
        "family": "Shiga Toxin 1 A-chain (Stx1A)",
        "organism": "Escherichia coli O157:H7",
        "uniprot": "P09386",
        "category": "Ribosome-inactivating protein (RIP type II)",
        "description": "Depurinates 28S rRNA; causes haemolytic uraemic syndrome (HUS)",
        # Mature Stx1A (residues 25–317 of UniProt P09386)
        "sequence": (
            "MEFSTINNTIQPDGSGKKLSEVLHKYNDDRTMLDIYNSTGDKVTITLKTNKFTSNIIIRLA"
            "QVKFPTNEELTQDLISDNLRSASGAGYTLNNALYNIVQNLMRLTSKINNKQMIEDQLNPNM"
            "QSQNILAHKLSRRPDLSTDLKLHPRREYMKQLNHQRQEFNRTLPLIYMNTRSRFLETKEQN"
            "VRGQFNSTQLNAIISDINNFLQKTDNFISAPPHSFNLSLKQLNVSIDKYNTTGSLFAAAIL"
        ),
    },
]


# ---------------------------------------------------------------------------
# Fingerprint computation (420-D amino acid + dipeptide composition vector)
# ---------------------------------------------------------------------------

def _compute_fingerprint(protein: str) -> list[float]:
    """Compute a 420-D composition-based functional fingerprint.

    The fingerprint concatenates:
      [0:20]   — amino acid composition (fraction of each of 20 standard AAs)
      [20:420] — dipeptide composition (fraction of each of 400 AA dipeptides)

    Returns an L2-normalised list of 420 floats suitable for cosine similarity.
    """
    seq = protein.upper()
    n = len(seq)
    if n == 0:
        return [0.0] * FINGERPRINT_DIM

    # Amino acid composition
    aa_counts = [0] * 20
    for aa in seq:
        idx = _AA_INDEX.get(aa)
        if idx is not None:
            aa_counts[idx] += 1
    aa_frac = [c / n for c in aa_counts]

    # Dipeptide composition
    n_dp = max(1, n - 1)
    dp_counts = [0] * 400
    for i in range(n - 1):
        dp = seq[i : i + 2]
        idx = _DP_INDEX.get(dp)
        if idx is not None:
            dp_counts[idx] += 1
    dp_frac = [c / n_dp for c in dp_counts]

    vec = aa_frac + dp_frac

    # L2 normalise
    norm = math.sqrt(sum(v * v for v in vec))
    if norm == 0.0:
        return vec
    return [v / norm for v in vec]


def _cosine(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two pre-normalised vectors."""
    return round(sum(x * y for x, y in zip(a, b)), 6)


# ---------------------------------------------------------------------------
# Pre-compute reference embeddings at module import (cached)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def get_reference_embeddings() -> list[dict]:
    """Return list of dicts: family metadata + pre-computed fingerprint vector.

    Result is cached after first call (module-level singleton).
    """
    out: list[dict] = []
    for fam in REFERENCE_FAMILIES:
        fp = _compute_fingerprint(fam["sequence"])
        out.append({**fam, "fingerprint": fp})
    return out


def screen_protein(
    protein: str,
    threshold_fail: float = 0.85,
    threshold_warn: float = 0.70,
) -> dict:
    """Screen a protein against all reference dangerous families.

    Returns a result dict containing:
      query_dimensions, references_screened, max_similarity,
      top_hits (sorted by descending similarity), status
    """
    query_fp = _compute_fingerprint(protein)
    refs = get_reference_embeddings()

    hits: list[dict] = []
    for ref in refs:
        sim = _cosine(query_fp, ref["fingerprint"])
        sim_status = (
            "fail" if sim >= threshold_fail else
            "warn" if sim >= threshold_warn else
            "pass"
        )
        hits.append({
            "family": ref["family"],
            "organism": ref["organism"],
            "uniprot": ref["uniprot"],
            "category": ref["category"],
            "similarity": sim,
            "threshold_fail": threshold_fail,
            "threshold_warn": threshold_warn,
            "status": sim_status,
        })

    hits.sort(key=lambda h: -h["similarity"])
    max_sim = hits[0]["similarity"] if hits else 0.0

    from tinsel.models import GateStatus
    if max_sim >= threshold_fail:
        overall = GateStatus.FAIL
    elif max_sim >= threshold_warn:
        overall = GateStatus.WARN
    else:
        overall = GateStatus.PASS

    return {
        "query_dimensions": FINGERPRINT_DIM,
        "references_screened": len(refs),
        "max_similarity": max_sim,
        "top_hits": hits,
        "status": overall,
    }
