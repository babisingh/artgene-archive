"""Abstract base classes for the three consequence gate adapters.

Every gate has two implementations:
    Real{Gate}Adapter   — makes actual HTTP/API calls (Phase 2+)
    Mock{Gate}Adapter   — deterministic, configurable, no network

Selection is controlled by the ``env`` parameter to
``run_consequence_pipeline()``: "test" always uses mocks.
"""

from abc import ABC, abstractmethod

from tinsel.consequence import Gate1Result, Gate2Result, Gate3Result


class Gate1Adapter(ABC):
    """Structural gate — ESMFold pLDDT + LinearFold ΔMFE."""

    mock_mode: bool = False

    @abstractmethod
    async def run(self, dna: str, protein: str) -> Gate1Result:
        """Analyse protein structure confidence and RNA secondary structure."""


class Gate2Adapter(ABC):
    """Off-target gate — NCBI BLAST + ToxinPred2 + AllerTop."""

    mock_mode: bool = False

    @abstractmethod
    async def run(self, dna: str, protein: str) -> Gate2Result:
        """Screen for human off-target hits, toxicity, and allergenicity."""


class Gate3Adapter(ABC):
    """Ecological gate — pathogen screen + HGT risk + drift radar."""

    mock_mode: bool = False

    @abstractmethod
    async def run(self, dna: str, protein: str) -> Gate3Result:
        """Assess ecological risk: pathogens, horizontal gene transfer, drift."""
