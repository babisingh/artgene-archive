"""Gate 2 sub-adapter — IBBIS commec HMM-based biorisk screening.

Real IBBIS commec overview
--------------------------
IBBIS (International Biosecurity and Biosafety Initiative for Science) provides
`commec`, an open-source biorisk screening tool that uses HMMER3 profile
searches against curated databases of dangerous protein families.

Key parameters:
  - Minimum sequence length: 150 bp (50 AA) for reliable HMM scoring
  - Below 150 bp: HMM scoring unreliable; commec defers to other methods
  - E-value threshold: 1e-5 (standard HMMER significance cutoff)
  - Databases: NCBI NR, UniRef90, curated pathogen/toxin HMM profiles

This adapter checks protein sequences (not DNA) because HMM profiles are
built from protein alignments.

Mock implementation (this file)
---------------------------------
The mock simulates commec's HMM search by:
  1. Checking if the protein is long enough (≥ 50 AA → 150 bp coding DNA).
  2. Scoring the protein against 5 fictional dangerous family "profiles"
     using amino acid composition and subsequence signatures.
  3. Returning a result that mirrors commec's JSON output shape.

Demo trigger: proteins containing the motif "GIGKFLHSA" OR "KWKLFKKIP"
trigger IBBIS DEMO-HMM-002 (Pore-Forming Toxin Family, fictional).

These motifs overlap with the composition k-mer screen intentionally —
in a real scenario IBBIS would catch AI-designed variants that have
mutated away from exact k-mer matches while retaining function.  For
sequences that clear the composition k-mer screen with 1 mismatch, IBBIS
provides a second layer of HMM-based confirmation.

Production integration
----------------------
Install commec:  pip install ibbis-commec
Replace _screen_hmm_mock() with a subprocess call to commec:
  commec screen --db /path/to/ibbis_db --input input.fasta --output out.json
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from tinsel.consequence import Gate2Result
from tinsel.models import GateStatus

logger = logging.getLogger(__name__)

_MIN_LENGTH_AA = 50   # 150 bp minimum for reliable HMM scoring
_IBBIS_VERSION = "1.3.2-mock"
_IBBIS_DB_VERSION = "2025-12-commec-mock"

# ---------------------------------------------------------------------------
# Demo dangerous family profiles (FICTIONAL — NOT real pathogen sequences)
# Each profile has a name and a list of protein subsequence signatures.
# A hit requires ANY signature to be present (substring match).
# ---------------------------------------------------------------------------

_DEMO_HMM_FAMILIES: list[dict] = [
    {
        "family_id": "DEMO-HMM-001",
        "family_name": "Cationic Antimicrobial Peptide Scaffold (demo)",
        "hmm_accession": "PF_DEMO_001",
        "evalue": 2.1e-8,
        "signatures": ["KAAAKAAAK", "KALKLALKL"],
    },
    {
        "family_id": "DEMO-HMM-002",
        "family_name": "Pore-Forming Toxin Beta-Barrel (demo)",
        "hmm_accession": "PF_DEMO_002",
        "evalue": 5.4e-7,
        "signatures": ["GIGKFLHSA", "KWKLFKKIP", "LLPIVGNLL"],
    },
    {
        "family_id": "DEMO-HMM-003",
        "family_name": "Ribosome-Inactivating Protein A-Chain (demo)",
        "hmm_accession": "PF_DEMO_003",
        "evalue": 1.1e-9,
        "signatures": ["PIFSRIRHP", "RTFVLHINK"],
    },
    {
        "family_id": "DEMO-HMM-004",
        "family_name": "Cecropin-Class Membrane-Disrupting Peptide (demo)",
        "hmm_accession": "PF_DEMO_004",
        "evalue": 8.7e-6,
        "signatures": ["RLKDLGFHV", "RWGRFLRNI"],
    },
    {
        "family_id": "DEMO-HMM-005",
        "family_name": "Gram-Positive Lantibiotic Nisin-Type (demo)",
        "hmm_accession": "PF_DEMO_005",
        "evalue": 3.2e-7,
        "signatures": ["VLNIKGKLA", "GWKDWAKKA"],
    },
]


def _screen_hmm_mock(protein: str) -> tuple[list[dict], int, bool]:
    """Screen protein against demo HMM family profiles.

    Returns (hits, families_screened, length_sufficient).
    """
    seq = protein.upper()
    length_sufficient = len(seq) >= _MIN_LENGTH_AA

    if not length_sufficient:
        logger.debug(
            "IBBIS: sequence too short (%d AA < %d AA minimum) — screening skipped",
            len(seq), _MIN_LENGTH_AA,
        )
        return [], 0, False

    hits: list[dict] = []
    for family in _DEMO_HMM_FAMILIES:
        for sig in family["signatures"]:
            if sig in seq:
                hits.append({
                    "family_id": family["family_id"],
                    "family_name": family["family_name"],
                    "hmm_accession": family["hmm_accession"],
                    "evalue": family["evalue"],
                    "matched_signature": sig,
                    "hit_position": seq.index(sig) + 1,
                })
                break  # one hit per family is sufficient

    return hits, len(_DEMO_HMM_FAMILIES), True


async def run_ibbis_screen(protein: str, mock: bool = True) -> dict:
    """Run IBBIS commec HMM screening and return structured result dict.

    Parameters
    ----------
    protein:
        Amino-acid sequence (single-letter, upper-case).
    mock:
        If True, use the demo mock implementation.
        If False, call the real commec binary (requires installation).
    """
    queried_at = datetime.now(timezone.utc).isoformat()

    if mock:
        hits, families_screened, length_sufficient = _screen_hmm_mock(protein)

        if not length_sufficient:
            status = GateStatus.PASS
            db_entry = {
                "name": "IBBIS commec",
                "version": _IBBIS_VERSION,
                "db_version": _IBBIS_DB_VERSION,
                "method": "hmm_profile_mock",
                "families_screened": 0,
                "status": "pass",
                "note": f"Sequence < {_MIN_LENGTH_AA} AA — HMM scoring unreliable, skipped",
                "queried_at": queried_at,
            }
        else:
            status = GateStatus.FAIL if hits else GateStatus.PASS
            db_entry = {
                "name": "IBBIS commec",
                "version": _IBBIS_VERSION,
                "db_version": _IBBIS_DB_VERSION,
                "method": "hmm_profile_mock",
                "families_screened": families_screened,
                "status": status.value,
                "queried_at": queried_at,
            }

        return {
            "checked": True,
            "mock": True,
            "length_sufficient": length_sufficient,
            "families_screened": families_screened,
            "hits": hits,
            "status": status,
            "db_entry": db_entry,
        }

    # ── Production path (requires commec installation) ──────────────────────
    # Example integration (pseudocode):
    #   import subprocess, tempfile, json
    #   with tempfile.NamedTemporaryFile(suffix=".faa", mode="w") as f:
    #       f.write(f">query\n{protein}\n")
    #       result = subprocess.run(
    #           ["commec", "screen", "--db", settings.IBBIS_DB_PATH,
    #            "--input", f.name, "--json"],
    #           capture_output=True, text=True, check=True,
    #       )
    #   return json.loads(result.stdout)
    raise NotImplementedError(
        "Real IBBIS commec integration requires commec installation and "
        "the IBBIS database. Set IBBIS_DB_PATH in environment."
    )
