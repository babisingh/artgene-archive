"""Async gate pipeline orchestrator.

The ``GatePipeline`` runs a configurable list of gate adapters concurrently
(or sequentially with ``parallel=False``) and aggregates their results
into a ``PipelineResult``.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Sequence
from typing import Any

from tinsel.models import GateResult, GateStatus, PipelineResult

from sentinel_gates.adapters.base import BaseGateAdapter, GateAdapterError

logger = logging.getLogger(__name__)


class GatePipeline:
    """Orchestrate multiple gate adapters for a single sequence.

    Parameters
    ----------
    adapters:
        Ordered list of gate adapters to run.
    parallel:
        When ``True`` (default) all gates run concurrently via
        ``asyncio.gather``.  Set to ``False`` for sequential execution
        (useful for debugging or rate-limited backends).
    fail_fast:
        When ``True`` and running sequentially, abort after the first
        FAIL gate.  Ignored when ``parallel=True``.
    """

    def __init__(
        self,
        adapters: Sequence[BaseGateAdapter],
        *,
        parallel: bool = True,
        fail_fast: bool = False,
    ) -> None:
        self.adapters = list(adapters)
        self.parallel = parallel
        self.fail_fast = fail_fast

    async def setup_all(self) -> None:
        """Call ``setup()`` on all adapters."""
        await asyncio.gather(*(a.setup() for a in self.adapters))

    async def teardown_all(self) -> None:
        """Call ``teardown()`` on all adapters, suppressing individual errors."""
        results = await asyncio.gather(
            *(a.teardown() for a in self.adapters), return_exceptions=True
        )
        for adapter, result in zip(self.adapters, results):
            if isinstance(result, Exception):
                logger.warning("Teardown error in %r: %s", adapter, result)

    async def run(self, sequence_id: str, sequence: str, **kwargs: Any) -> PipelineResult:
        """Execute all gates and return an aggregated ``PipelineResult``.

        Parameters
        ----------
        sequence_id:
            Stable identifier for the sequence (used in the result).
        sequence:
            Biological sequence string passed to every gate adapter.
        **kwargs:
            Additional keyword arguments forwarded to each adapter's
            ``run()`` method.
        """
        pipeline_result = PipelineResult(
            sequence_id=sequence_id,
            overall_status=GateStatus.PASS,
        )

        if self.parallel:
            gate_results = await self._run_parallel(sequence, **kwargs)
        else:
            gate_results = await self._run_sequential(sequence, **kwargs)

        pipeline_result.gates = gate_results
        pipeline_result.compute_summary()
        return pipeline_result

    async def _run_parallel(self, sequence: str, **kwargs: Any) -> list[GateResult]:
        tasks = [self._safe_run(adapter, sequence, **kwargs) for adapter in self.adapters]
        return list(await asyncio.gather(*tasks))

    async def _run_sequential(self, sequence: str, **kwargs: Any) -> list[GateResult]:
        results: list[GateResult] = []
        for adapter in self.adapters:
            result = await self._safe_run(adapter, sequence, **kwargs)
            results.append(result)
            if self.fail_fast and result.status == GateStatus.FAIL:
                logger.info(
                    "fail_fast: aborting pipeline after gate %r returned FAIL",
                    adapter.gate_name,
                )
                break
        return results

    @staticmethod
    async def _safe_run(adapter: BaseGateAdapter, sequence: str, **kwargs: Any) -> GateResult:
        """Run a single adapter, catching errors and converting to FAIL results."""
        try:
            return await adapter.run(sequence, **kwargs)
        except GateAdapterError as exc:
            logger.error("Gate %r raised GateAdapterError: %s", adapter.gate_name, exc)
            return GateResult(
                gate_name=adapter.gate_name,
                status=GateStatus.FAIL,
                message=f"Adapter error: {exc}",
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Unexpected error in gate %r", adapter.gate_name)
            return GateResult(
                gate_name=adapter.gate_name,
                status=GateStatus.FAIL,
                message=f"Unexpected error: {type(exc).__name__}: {exc}",
            )

    async def __aenter__(self) -> GatePipeline:
        await self.setup_all()
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.teardown_all()
