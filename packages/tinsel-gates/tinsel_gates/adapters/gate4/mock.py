"""Mock Gate 4 adapter — configurable functional analogue gate for testing.

Inject specific values to trigger any desired outcome:

    MockGate4Adapter()                          # PASS (defaults: max_sim=0.32)
    MockGate4Adapter(max_similarity=0.75)       # WARN (≥ 0.70)
    MockGate4Adapter(max_similarity=0.92)       # FAIL (≥ 0.85)
    MockGate4Adapter(max_similarity=0.92,       # FAIL, specific family
                     top_family="Ricin A-chain (RIP type II)")
"""

from __future__ import annotations

from tinsel.consequence import Gate4Result
from tinsel.models import GateStatus

from tinsel_gates.adapters.base import Gate4Adapter

_DEFAULT_MAX_SIM = 0.32
_THRESHOLD_FAIL = 0.85
_THRESHOLD_WARN = 0.70
_MOCK_REFS = 5


class MockGate4Adapter(Gate4Adapter):
    """Deterministic, configurable mock for Gate 4 (functional analogue detection)."""

    mock_mode = True

    def __init__(
        self,
        max_similarity: float = _DEFAULT_MAX_SIM,
        top_family: str = "Ricin A-chain (RIP type II)",
        threshold_fail: float = _THRESHOLD_FAIL,
        threshold_warn: float = _THRESHOLD_WARN,
    ) -> None:
        self.max_similarity = max_similarity
        self.top_family = top_family
        self.threshold_fail = threshold_fail
        self.threshold_warn = threshold_warn

    async def run(self, dna: str, protein: str) -> Gate4Result:
        sim = self.max_similarity

        if sim >= self.threshold_fail:
            status = GateStatus.FAIL
            msg = (
                f"[mock] FUNCTIONAL ANALOGUE: '{self.top_family}' "
                f"(cosine {sim:.4f} ≥ fail threshold {self.threshold_fail})"
            )
        elif sim >= self.threshold_warn:
            status = GateStatus.WARN
            msg = (
                f"[mock] Moderate functional similarity to '{self.top_family}' "
                f"(cosine {sim:.4f} ≥ warn threshold {self.threshold_warn})"
            )
        else:
            status = GateStatus.PASS
            msg = f"[mock] No dangerous analogues (max cosine {sim:.4f})"

        top_hits = [
            {
                "family": self.top_family,
                "organism": "Mock organism",
                "uniprot": "P00000",
                "category": "Mock category",
                "similarity": sim,
                "threshold_fail": self.threshold_fail,
                "threshold_warn": self.threshold_warn,
                "status": status.value,
            }
        ]

        return Gate4Result(
            status=status,
            method="mock_v1",
            query_dimensions=420,
            references_screened=_MOCK_REFS,
            threshold_fail=self.threshold_fail,
            threshold_warn=self.threshold_warn,
            max_similarity=sim,
            top_hits=top_hits,
            message=msg,
            note="Mock Gate 4 adapter — for testing only",
        )
