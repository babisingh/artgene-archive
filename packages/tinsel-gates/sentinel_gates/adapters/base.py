"""Abstract base class for all sentinel gate adapters."""

from abc import ABC, abstractmethod
from typing import Any, Dict


class GateAdapterError(RuntimeError):
    """Raised when a gate adapter encounters an unrecoverable error."""


class BaseGateAdapter(ABC):
    """Abstract base class that every gate adapter must implement.

    A gate adapter wraps a single external analysis tool (e.g. ESMFold,
    NCBI BLAST, ToxinPred) and exposes a uniform async interface so the
    pipeline can orchestrate multiple gates without coupling to any
    specific backend.

    Lifecycle
    ---------
    1. Instantiate the adapter with tool-specific configuration.
    2. ``await adapter.setup()`` — perform any async initialisation
       (e.g. loading model weights, opening a DB connection).
    3. ``result = await adapter.run(sequence, **kwargs)`` — execute the
       gate for a given amino-acid or nucleotide sequence.
    4. ``await adapter.teardown()`` — release resources.

    Subclasses **must** implement ``setup``, ``run``, and ``teardown``.
    They may also override ``gate_name`` (class attribute) to provide a
    canonical identifier used in ``GateResult.gate_name``.
    """

    #: Override in subclasses with a stable, lower-case identifier.
    gate_name: str = "base"

    def __init__(self, config: Dict[str, Any] | None = None) -> None:
        self.config: Dict[str, Any] = config or {}

    @abstractmethod
    async def setup(self) -> None:
        """Initialise the adapter (load models, open connections, etc.)."""

    @abstractmethod
    async def run(self, sequence: str, **kwargs: Any) -> Any:
        """Execute the gate for *sequence* and return a ``GateResult``-compatible object.

        Parameters
        ----------
        sequence:
            The biological sequence string to analyse.
        **kwargs:
            Gate-specific parameters (e.g. ``database`` for BLAST).

        Returns
        -------
        Any
            A populated ``GateResult`` subclass instance.

        Raises
        ------
        GateAdapterError
            If the gate cannot complete analysis (e.g. network failure,
            invalid input rejected by the backend).
        """

    @abstractmethod
    async def teardown(self) -> None:
        """Release resources held by the adapter."""

    async def __aenter__(self) -> "BaseGateAdapter":
        await self.setup()
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.teardown()

    def __repr__(self) -> str:
        return f"{type(self).__name__}(gate_name={self.gate_name!r})"
