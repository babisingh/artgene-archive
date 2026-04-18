"""Gate 2: Off-target checks (composition + SecureDNA DOPRF + IBBIS commec)."""

from tinsel_gates.adapters.gate2.chained import ChainedGate2Adapter
from tinsel_gates.adapters.gate2.composition import CompositionGate2Adapter
from tinsel_gates.adapters.gate2.mock import MockGate2Adapter

__all__ = ["MockGate2Adapter", "CompositionGate2Adapter", "ChainedGate2Adapter"]
