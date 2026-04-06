"""Mock Gate 1 adapter — configurable structural gate for testing.

Thresholds (mirrors real gate logic):
    pLDDT mean < 70.0          → FAIL
    pLDDT low fraction >= 0.20 → FAIL  (fraction of residues with pLDDT < 50)
    ΔMFE >= 2.0 kcal/mol       → WARN
    otherwise                  → PASS

Inject specific values via the constructor to trigger any desired outcome:

    MockGate1Adapter(plddt_mean=40.0)          # FAIL — low confidence
    MockGate1Adapter(plddt_low_fraction=0.25)  # FAIL — too many disordered residues
    MockGate1Adapter(delta_mfe=3.5)            # WARN — unstable RNA fold
    MockGate1Adapter()                         # PASS (defaults)
"""

from tinsel.consequence import Gate1Result
from tinsel.models import GateStatus
from tinsel_gates.adapters.base import Gate1Adapter

# Default values that produce a PASS result
_DEFAULT_PLDDT_MEAN: float = 87.3
_DEFAULT_LOW_FRACTION: float = 0.05
_DEFAULT_DELTA_MFE: float = 0.4

# Decision thresholds
_PLDDT_FAIL_BELOW: float = 70.0
_LOW_FRAC_FAIL_AT: float = 0.20
_MFE_WARN_AT: float = 2.0


class MockGate1Adapter(Gate1Adapter):
    """Deterministic, configurable mock for Gate 1 (structural checks)."""

    mock_mode = True

    def __init__(
        self,
        plddt_mean: float = _DEFAULT_PLDDT_MEAN,
        plddt_low_fraction: float = _DEFAULT_LOW_FRACTION,
        delta_mfe: float = _DEFAULT_DELTA_MFE,
    ) -> None:
        self.plddt_mean = plddt_mean
        self.plddt_low_fraction = plddt_low_fraction
        self.delta_mfe = delta_mfe

    async def run(self, dna: str, protein: str) -> Gate1Result:
        if self.plddt_mean < _PLDDT_FAIL_BELOW:
            status = GateStatus.FAIL
            msg = (
                f"pLDDT mean {self.plddt_mean:.1f} < {_PLDDT_FAIL_BELOW} threshold"
            )
        elif self.plddt_low_fraction >= _LOW_FRAC_FAIL_AT:
            status = GateStatus.FAIL
            msg = (
                f"pLDDT low-confidence fraction {self.plddt_low_fraction:.2f} "
                f">= {_LOW_FRAC_FAIL_AT} threshold"
            )
        elif self.delta_mfe >= _MFE_WARN_AT:
            status = GateStatus.WARN
            msg = f"ΔMFE {self.delta_mfe:.2f} kcal/mol >= {_MFE_WARN_AT} (WARN)"
        else:
            status = GateStatus.PASS
            msg = (
                f"pLDDT mean {self.plddt_mean:.1f}, "
                f"low fraction {self.plddt_low_fraction:.2f}, "
                f"ΔMFE {self.delta_mfe:.2f} kcal/mol"
            )

        return Gate1Result(
            status=status,
            plddt_mean=self.plddt_mean,
            plddt_low_fraction=self.plddt_low_fraction,
            delta_mfe=self.delta_mfe,
            message=msg,
        )
