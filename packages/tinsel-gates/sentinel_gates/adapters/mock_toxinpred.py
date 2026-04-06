"""Mock ToxinPred adapter — synthetic toxicity scoring.

ToxinPred (IMTECH) predicts whether a peptide is toxic to humans based
on SVM classifiers trained on known toxins.  This mock reproduces the
output schema without contacting the real web service.

The mock classifies sequences as toxic if their GC/hydrophobic residue
ratio (a rough heuristic) exceeds a configurable threshold, making it
possible to write deterministic tests for pipeline branching logic.
"""

import hashlib
import random
from typing import Any

from tinsel.models import GateStatus, ToxinPredResult

from sentinel_gates.adapters.base import BaseGateAdapter

# Residues considered hydrophobic in simple toxin heuristic
_HYDROPHOBIC = frozenset("VILMFYWC")


def _hydrophobic_fraction(seq: str) -> float:
    seq = seq.upper()
    if not seq:
        return 0.0
    return sum(1 for aa in seq if aa in _HYDROPHOBIC) / len(seq)


class MockToxinPredAdapter(BaseGateAdapter):
    """Deterministic mock adapter for ToxinPred toxicity prediction.

    Configuration keys
    ------------------
    toxicity_threshold : float
        Sequences whose mock toxicity_score >= this value are classified
        as toxic and receive a FAIL status (default: 0.5).
    """

    gate_name = "toxinpred"

    async def setup(self) -> None:
        pass

    async def run(self, sequence: str, **kwargs: Any) -> ToxinPredResult:
        """Return a synthetic ToxinPredResult for *sequence*."""
        threshold: float = float(self.config.get("toxicity_threshold", 0.5))

        # Deterministic SVM-like score: blend hydrophobic fraction with
        # a small seeded random perturbation.
        seed = int(hashlib.md5(sequence.encode()).hexdigest()[:8], 16)
        rng = random.Random(seed)
        hydro = _hydrophobic_fraction(sequence)
        noise = rng.uniform(-0.1, 0.1)
        toxicity_score = max(0.0, min(1.0, hydro + noise))
        svm_score = toxicity_score * 2.0 - 1.0  # map [0,1] → [-1, 1]

        is_toxic = toxicity_score >= threshold
        status = GateStatus.FAIL if is_toxic else GateStatus.PASS
        message = (
            f"Mock ToxinPred: {'TOXIC' if is_toxic else 'NON-TOXIC'} "
            f"(score={toxicity_score:.3f}, threshold={threshold})"
        )

        return ToxinPredResult(
            status=status,
            is_toxic=is_toxic,
            toxicity_score=round(toxicity_score, 4),
            svm_score=round(svm_score, 4),
            message=message,
        )

    async def teardown(self) -> None:
        pass
