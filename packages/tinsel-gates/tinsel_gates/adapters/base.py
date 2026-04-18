"""Abstract base classes for the four consequence gate adapters.

Every gate has two implementations:
    Real{Gate}Adapter   — makes actual HTTP/API calls (Phase 2+)
    Mock{Gate}Adapter   — deterministic, configurable, no network

Selection is controlled by the ``env`` parameter to
``run_consequence_pipeline()``: "test" always uses mocks.
"""

from abc import ABC, abstractmethod

from tinsel.consequence import Gate1Result, Gate2Result, Gate3Result, Gate4Result


class Gate1Adapter(ABC):
    """Structural gate — ESMFold pLDDT + LinearFold ΔMFE."""

    mock_mode: bool = False

    @abstractmethod
    async def run(self, dna: str, protein: str) -> Gate1Result:
        """Analyse protein structure confidence and RNA secondary structure."""


class Gate2Adapter(ABC):
    """Off-target gate — composition + SecureDNA DOPRF + IBBIS commec."""

    mock_mode: bool = False

    @abstractmethod
    async def run(self, dna: str, protein: str) -> Gate2Result:
        """Screen for off-target hits, toxicity, allergenicity via chained databases."""


class Gate3Adapter(ABC):
    """Ecological gate — pathogen screen + HGT risk + drift radar."""

    mock_mode: bool = False

    @abstractmethod
    async def run(self, dna: str, protein: str) -> Gate3Result:
        """Assess ecological risk: pathogens, horizontal gene transfer, drift."""


class Gate4Adapter(ABC):
    """Functional analogue gate — protein language model embedding similarity.

    Detects AI-designed variants that have diverged from known dangerous sequences
    yet retain dangerous function.  Operates in embedding space, not sequence space.
    """

    mock_mode: bool = False

    @abstractmethod
    async def run(self, dna: str, protein: str) -> Gate4Result:
        """Compute embedding similarity to known dangerous protein families."""
