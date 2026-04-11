"""Mock Gate 3 adapter — configurable ecological gate for testing.

Gate 3 checks are MOCKED in the MVP (no real API calls).
Real IslandViewer, mobileOG-db, and DriftRadar integration is Phase 2.

Thresholds:
    pathogen_hits > 0        → FAIL  (any known pathogen match)
    hgt_score >= 50.0        → FAIL  (high horizontal gene transfer risk)
    escape_probability >= 0.15 → WARN
    otherwise                → PASS

Default mock values (all PASS):
    pathogen_hits      = 0
    hgt_score          = 3.2   (out of 100 — per Phase 2 spec)
    escape_probability = 0.04

Inject specific values to trigger any desired outcome:

    MockGate3Adapter(pathogen_hits=1)        # FAIL — pathogen match
    MockGate3Adapter(hgt_score=75.0)         # FAIL — high HGT risk
    MockGate3Adapter(escape_probability=0.2) # WARN — elevated drift
    MockGate3Adapter()                       # PASS (defaults)
"""

from tinsel.consequence import Gate3Result
from tinsel.models import GateStatus

from tinsel_gates.adapters.base import Gate3Adapter

_DEFAULT_PATHOGEN_HITS: int = 0
_DEFAULT_HGT_SCORE: float = 3.2
_DEFAULT_ESCAPE_PROB: float = 0.04

_PATHOGEN_FAIL_ABOVE: int = 0
_HGT_FAIL_AT: float = 50.0
_ESCAPE_WARN_AT: float = 0.15


class MockGate3Adapter(Gate3Adapter):
    """Deterministic, configurable mock for Gate 3 (ecological checks)."""

    mock_mode = True

    def __init__(
        self,
        pathogen_hits: int = _DEFAULT_PATHOGEN_HITS,
        hgt_score: float = _DEFAULT_HGT_SCORE,
        escape_probability: float = _DEFAULT_ESCAPE_PROB,
    ) -> None:
        self.pathogen_hits = pathogen_hits
        self.hgt_score = hgt_score
        self.escape_probability = escape_probability

    async def run(self, dna: str, protein: str) -> Gate3Result:
        if self.pathogen_hits > _PATHOGEN_FAIL_ABOVE:
            status = GateStatus.FAIL
            msg = f"{self.pathogen_hits} known pathogen match(es) detected"
        elif self.hgt_score >= _HGT_FAIL_AT:
            status = GateStatus.FAIL
            msg = (
                f"HGT score {self.hgt_score:.1f}/100 "
                f">= {_HGT_FAIL_AT} threshold (MOCK)"
            )
        elif self.escape_probability >= _ESCAPE_WARN_AT:
            status = GateStatus.WARN
            msg = (
                f"Evolutionary escape probability {self.escape_probability:.3f} "
                f">= {_ESCAPE_WARN_AT} (WARN, MOCK)"
            )
        else:
            status = GateStatus.PASS
            msg = (
                f"Pathogen hits {self.pathogen_hits}, "
                f"HGT score {self.hgt_score:.1f}/100, "
                f"escape {self.escape_probability:.3f} (MOCK)"
            )

        return Gate3Result(
            status=status,
            pathogen_hits=self.pathogen_hits,
            hgt_score=self.hgt_score,
            escape_probability=self.escape_probability,
            message=msg,
        )
