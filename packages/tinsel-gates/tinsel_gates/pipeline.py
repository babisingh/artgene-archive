"""Async three-gate biosafety consequence pipeline.

Execution order
---------------
1. Gate 1 (structural) runs first — cheapest, used as a fail-fast filter.
2. If gate 1 passes: gates 2 (off-target) and 3 (ecological) run concurrently.
3. If gate 1 fails: gates 2 and 3 are recorded in ``skipped_gates`` and
   the report is returned immediately.

Adapters are selected by ``env``:
    "test"        → all mock adapters (no network calls, deterministic)
    "development" → real adapters (ESMFold + composition + codon analysis)
    "production"  → real adapters (same as development)

Dependency injection
--------------------
Pass ``gate{n}_adapter`` kwargs to override the default adapter for a
specific gate.  This is the primary mechanism used in unit tests:

    report = await run_consequence_pipeline(
        protein="MAEQKLISEEDL",
        dna="ATGGCTGAGCAG",
        env="test",
        gate1_adapter=MockGate1Adapter(plddt_mean=40.0),  # force FAIL
    )
"""

from __future__ import annotations

import asyncio
import logging

from tinsel.consequence import ConsequenceReport, Gate1Result, Gate2Result, Gate3Result
from tinsel.models import GateStatus

from tinsel_gates.adapters.base import Gate1Adapter, Gate2Adapter, Gate3Adapter
from tinsel_gates.adapters.gate1 import ESMFoldGate1Adapter, MockGate1Adapter
from tinsel_gates.adapters.gate2 import CompositionGate2Adapter, MockGate2Adapter
from tinsel_gates.adapters.gate3 import MockGate3Adapter
from tinsel_gates.adapters.gate3.codon import make_codon_gate3_adapter

logger = logging.getLogger(__name__)

_REAL_ENVS = frozenset({"development", "production"})


def _build_gate1(env: str) -> Gate1Adapter:
    if env in _REAL_ENVS:
        logger.debug("Gate 1: using ESMFoldGate1Adapter (env=%s)", env)
        return ESMFoldGate1Adapter()
    return MockGate1Adapter()


def _build_gate2(env: str) -> Gate2Adapter:
    if env in _REAL_ENVS:
        logger.debug("Gate 2: using CompositionGate2Adapter (env=%s)", env)
        return CompositionGate2Adapter()
    return MockGate2Adapter()


def _build_gate3(env: str, host_organism: str = "ECOLI") -> Gate3Adapter:
    if env in _REAL_ENVS:
        logger.debug(
            "Gate 3: using CodonGate3Adapter (env=%s, host=%s)", env, host_organism
        )
        return make_codon_gate3_adapter(host_organism)
    return MockGate3Adapter()


async def run_consequence_pipeline(
    protein: str,
    dna: str,
    env: str = "test",
    run_gates: tuple[int, ...] = (1, 2, 3),
    host_organism: str = "ECOLI",
    *,
    gate1_adapter: Gate1Adapter | None = None,
    gate2_adapter: Gate2Adapter | None = None,
    gate3_adapter: Gate3Adapter | None = None,
) -> ConsequenceReport:
    """Run the three-gate biosafety consequence pipeline.

    Parameters
    ----------
    protein:
        Amino-acid sequence (single-letter, upper-case).
    dna:
        Coding DNA sequence (must translate to *protein*).
    env:
        Runtime environment — controls which adapter implementations are used.
        One of ``"test"``, ``"development"``, ``"production"``.
    run_gates:
        Tuple of gate numbers to execute.  Defaults to ``(1, 2, 3)``.
        Pass ``(1,)`` to run gate 1 only (e.g. for a quick structural pre-check).
    host_organism:
        Host expression system (e.g. ``"ECOLI"``, ``"HUMAN"``, ``"YEAST"``).
        Used by Gate 3 for host-specific codon adaptation scoring.
    gate1_adapter / gate2_adapter / gate3_adapter:
        Optional adapter overrides (keyword-only).  When ``None`` the
        default adapter for *env* is used.  Primarily used in tests.

    Returns
    -------
    ConsequenceReport
        Aggregated result with per-gate results and overall status.
    """
    g1: Gate1Adapter = gate1_adapter or _build_gate1(env)
    g2: Gate2Adapter = gate2_adapter or _build_gate2(env)
    g3: Gate3Adapter = gate3_adapter or _build_gate3(env, host_organism)

    gate1_result: Gate1Result | None = None
    gate2_result: Gate2Result | None = None
    gate3_result: Gate3Result | None = None
    skipped: list[int] = []

    # ── Gate 1 (fail-fast) ────────────────────────────────────────────────
    if 1 in run_gates:
        logger.debug("Running Gate 1 (structural)")
        gate1_result = await g1.run(dna, protein)
        logger.debug("Gate 1 status: %s", gate1_result.status)

        if gate1_result.status == GateStatus.FAIL:
            skipped = sorted(g for g in run_gates if g > 1)
            logger.info(
                "Gate 1 FAIL — skipping gates %s", skipped
            )
            return ConsequenceReport(
                gate1=gate1_result,
                gate2=None,
                gate3=None,
                overall_status=GateStatus.FAIL,
                skipped_gates=skipped,
                run_gates=run_gates,
            )

    # ── Gates 2 + 3 concurrently ─────────────────────────────────────────
    tasks: list[tuple[int, asyncio.Task]] = []  # type: ignore[type-arg]
    if 2 in run_gates:
        tasks.append((2, asyncio.create_task(g2.run(dna, protein))))
    if 3 in run_gates:
        tasks.append((3, asyncio.create_task(g3.run(dna, protein))))

    if tasks:
        results = await asyncio.gather(*(t for _, t in tasks))
        for (gate_num, _), result in zip(tasks, results):
            if gate_num == 2:
                gate2_result = result
            elif gate_num == 3:
                gate3_result = result
            logger.debug("Gate %d status: %s", gate_num, result.status)

    # ── Overall status ────────────────────────────────────────────────────
    all_results = [r for r in (gate1_result, gate2_result, gate3_result) if r is not None]
    if any(r.status == GateStatus.FAIL for r in all_results):
        overall = GateStatus.FAIL
    elif any(r.status == GateStatus.WARN for r in all_results):
        overall = GateStatus.WARN
    else:
        overall = GateStatus.PASS

    return ConsequenceReport(
        gate1=gate1_result,
        gate2=gate2_result,
        gate3=gate3_result,
        overall_status=overall,
        skipped_gates=skipped,
        run_gates=run_gates,
    )
