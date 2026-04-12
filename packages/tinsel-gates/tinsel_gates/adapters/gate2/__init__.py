"""Gate 2: Off-target checks (BLAST + ToxinPred2 + AllerTop)."""

from tinsel_gates.adapters.gate2.composition import CompositionGate2Adapter
from tinsel_gates.adapters.gate2.mock import MockGate2Adapter

__all__ = ["MockGate2Adapter", "CompositionGate2Adapter"]
