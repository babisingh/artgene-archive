"""Mock ESMFold adapter — returns deterministic synthetic pLDDT scores.

This adapter is used in development and CI where the real ESMFold service
(Meta's language model-based structure predictor) is unavailable.  It
produces plausible-looking output so that downstream pipeline logic can
be exercised without a GPU or network access.
"""

import hashlib
import random
from typing import Any

from tinsel.models import ESMFoldResult, GateStatus

from sentinel_gates.adapters.base import BaseGateAdapter


class MockESMFoldAdapter(BaseGateAdapter):
    """Deterministic mock adapter for ESMFold protein structure prediction.

    Configuration keys
    ------------------
    mean_plddt : float
        Baseline mean pLDDT injected into every result (default: 82.0).
    fail_on_length : int | None
        If set, sequences longer than this value receive a FAIL status.
    """

    gate_name = "esmfold"

    async def setup(self) -> None:
        # No real resources needed for the mock.
        pass

    async def run(self, sequence: str, **kwargs: Any) -> ESMFoldResult:
        """Return a synthetic ESMFoldResult for *sequence*."""
        mean_plddt: float = float(self.config.get("mean_plddt", 82.0))
        fail_on_length: int | None = self.config.get("fail_on_length")

        if fail_on_length is not None and len(sequence) > fail_on_length:
            return ESMFoldResult(
                status=GateStatus.FAIL,
                message=f"Sequence length {len(sequence)} exceeds mock limit {fail_on_length}",
            )

        # Derive per-residue pLDDT from a seeded RNG so results are
        # reproducible for the same sequence.
        seed = int(hashlib.md5(sequence.encode()).hexdigest()[:8], 16)
        rng = random.Random(seed)
        scores = [
            max(0.0, min(100.0, rng.gauss(mean_plddt, 8.0)))
            for _ in range(len(sequence))
        ]
        actual_mean = sum(scores) / len(scores) if scores else 0.0

        status = GateStatus.PASS if actual_mean >= 70.0 else GateStatus.WARN

        return ESMFoldResult(
            status=status,
            plddt_mean=round(actual_mean, 2),
            plddt_scores=scores,
            pdb_string=f"MOCK_PDB_FOR_{sequence[:6].upper()}",
            message=f"Mock ESMFold pLDDT mean: {actual_mean:.1f}",
        )

    async def teardown(self) -> None:
        pass
