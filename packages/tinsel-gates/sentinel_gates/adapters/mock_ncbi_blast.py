"""Mock NCBI BLAST adapter — returns canned similarity hits.

Used in development and CI when network access to NCBI E-utilities /
BLAST+ is unavailable.  The mock selects from a small library of
plausible-looking hits, seeded by the query sequence, so results are
stable across test runs.
"""

import hashlib
import random
from typing import Any

from tinsel.models import BlastHit, BlastResult, GateStatus

from sentinel_gates.adapters.base import BaseGateAdapter

_MOCK_HIT_POOL: list[dict] = [
    {
        "accession": "NP_001123456.1",
        "description": "hypothetical protein [Homo sapiens]",
        "score": 620.0,
        "evalue": 1e-95,
        "identity_pct": 99.1,
        "coverage_pct": 100.0,
    },
    {
        "accession": "XP_003814752.1",
        "description": "predicted protein [Mus musculus]",
        "score": 580.0,
        "evalue": 3e-88,
        "identity_pct": 87.4,
        "coverage_pct": 98.0,
    },
    {
        "accession": "WP_010293847.1",
        "description": "ABC transporter substrate-binding protein [E. coli]",
        "score": 210.0,
        "evalue": 6e-32,
        "identity_pct": 41.2,
        "coverage_pct": 76.5,
    },
    {
        "accession": "YP_009724390.1",
        "description": "surface glycoprotein [SARS-CoV-2]",
        "score": 88.0,
        "evalue": 2e-12,
        "identity_pct": 28.9,
        "coverage_pct": 55.0,
    },
]


class MockNCBIBlastAdapter(BaseGateAdapter):
    """Deterministic mock adapter for NCBI BLAST sequence similarity search.

    Configuration keys
    ------------------
    num_hits : int
        Number of hits to return (default: 3, capped at pool size).
    evalue_threshold : float
        Hits with e-value above this threshold cause a WARN (default: 1e-5).
    """

    gate_name = "ncbi_blast"

    async def setup(self) -> None:
        pass

    async def run(self, sequence: str, **kwargs: Any) -> BlastResult:
        """Return synthetic BLAST hits for *sequence*."""
        num_hits: int = int(self.config.get("num_hits", 3))
        evalue_threshold: float = float(self.config.get("evalue_threshold", 1e-5))

        seed = int(hashlib.md5(sequence.encode()).hexdigest()[:8], 16)
        rng = random.Random(seed)

        pool = list(_MOCK_HIT_POOL)
        rng.shuffle(pool)
        selected = pool[: min(num_hits, len(pool))]

        hits = [BlastHit(**h) for h in selected]
        top_hit = hits[0] if hits else None

        worst_evalue = max((h.evalue for h in hits), default=0.0)
        if not hits:
            status = GateStatus.WARN
            message = "No BLAST hits found"
        elif worst_evalue > evalue_threshold:
            status = GateStatus.WARN
            message = (
                f"Top hit e-value {top_hit.evalue:.2e} "
                f"exceeds threshold {evalue_threshold:.2e}"
            )
        else:
            status = GateStatus.PASS
            message = f"Found {len(hits)} hit(s); top hit identity {top_hit.identity_pct:.1f}%"

        return BlastResult(
            status=status,
            query_length=len(sequence),
            hits=hits,
            top_hit=top_hit,
            message=message,
        )

    async def teardown(self) -> None:
        pass
