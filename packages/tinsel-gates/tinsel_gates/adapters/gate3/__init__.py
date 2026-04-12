"""Gate 3: Ecological checks (Pathogen + HGT score + DriftRadar)."""

from tinsel_gates.adapters.gate3.codon import CodonGate3Adapter, make_codon_gate3_adapter
from tinsel_gates.adapters.gate3.mock import MockGate3Adapter

__all__ = ["MockGate3Adapter", "CodonGate3Adapter", "make_codon_gate3_adapter"]
