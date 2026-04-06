"""Mock Gate 2 adapter — configurable off-target gate for testing.

Thresholds (mirrors real gate logic):
    blast_hits > 0                 → FAIL  (any human off-target hit E < 1e-5)
    toxin_probability >= 0.30      → FAIL
    allergen_probability >= 0.40   → FAIL
    allergen_probability >= 0.30   → WARN  (below FAIL threshold)
    otherwise                      → PASS

Inject specific values to trigger any desired outcome:

    MockGate2Adapter(blast_hits=2)              # FAIL — off-target hits
    MockGate2Adapter(toxin_probability=0.75)    # FAIL — toxic
    MockGate2Adapter(allergen_probability=0.35) # WARN — near-threshold allergen
    MockGate2Adapter()                          # PASS (defaults)
"""

from tinsel.consequence import Gate2Result
from tinsel.models import GateStatus
from tinsel_gates.adapters.base import Gate2Adapter

_DEFAULT_BLAST_HITS: int = 0
_DEFAULT_TOXIN_PROB: float = 0.07
_DEFAULT_ALLERGEN_PROB: float = 0.12

_BLAST_FAIL_ABOVE: int = 0          # > 0 hits → FAIL
_TOXIN_FAIL_AT: float = 0.30
_ALLERGEN_FAIL_AT: float = 0.40
_ALLERGEN_WARN_AT: float = 0.30


class MockGate2Adapter(Gate2Adapter):
    """Deterministic, configurable mock for Gate 2 (off-target checks)."""

    mock_mode = True

    def __init__(
        self,
        blast_hits: int = _DEFAULT_BLAST_HITS,
        toxin_probability: float = _DEFAULT_TOXIN_PROB,
        allergen_probability: float = _DEFAULT_ALLERGEN_PROB,
    ) -> None:
        self.blast_hits = blast_hits
        self.toxin_probability = toxin_probability
        self.allergen_probability = allergen_probability

    async def run(self, dna: str, protein: str) -> Gate2Result:
        if self.blast_hits > _BLAST_FAIL_ABOVE:
            status = GateStatus.FAIL
            msg = f"{self.blast_hits} human off-target BLAST hit(s) detected (E < 1e-5)"
        elif self.toxin_probability >= _TOXIN_FAIL_AT:
            status = GateStatus.FAIL
            msg = (
                f"ToxinPred2 probability {self.toxin_probability:.3f} "
                f">= {_TOXIN_FAIL_AT} threshold"
            )
        elif self.allergen_probability >= _ALLERGEN_FAIL_AT:
            status = GateStatus.FAIL
            msg = (
                f"AllerTop probability {self.allergen_probability:.3f} "
                f">= {_ALLERGEN_FAIL_AT} threshold"
            )
        elif self.allergen_probability >= _ALLERGEN_WARN_AT:
            status = GateStatus.WARN
            msg = (
                f"AllerTop probability {self.allergen_probability:.3f} "
                f"in warn zone [{_ALLERGEN_WARN_AT}, {_ALLERGEN_FAIL_AT})"
            )
        else:
            status = GateStatus.PASS
            msg = (
                f"BLAST hits {self.blast_hits}, "
                f"toxin {self.toxin_probability:.3f}, "
                f"allergen {self.allergen_probability:.3f}"
            )

        return Gate2Result(
            status=status,
            blast_hits=self.blast_hits,
            toxin_probability=self.toxin_probability,
            allergen_probability=self.allergen_probability,
            message=msg,
        )
