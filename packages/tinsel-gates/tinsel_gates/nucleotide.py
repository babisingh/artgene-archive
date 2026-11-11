"""Screening a nucleotide sequence that has no single protein product.

A designed genome, a plasmid, a promoter or a multi-gene construct cannot be
folded, so gate alpha does not apply. It can still be screened, and refusing to
look would be the worse answer: the hazard in a nucleotide sequence is usually
a protein it encodes somewhere, in one of six frames on either strand, whether
or not the submitter meant it to be expressed.

So the open reading frames are extracted and the protein-level gates are run
over them, while gate gamma runs on the nucleotide sequence itself, where it
already belonged. Any one failing frame fails the whole submission.

This is the same method synthetic DNA screening services use, applied with the
adapters this project has. It is not a substitute for one of those services,
and the report says what it covered so the difference stays visible.
"""

from __future__ import annotations

import asyncio
import logging

from tinsel.consequence import (
    ConsequenceReport,
    Gate2Result,
    Gate3Result,
    Gate4Result,
    OrfScreenSummary,
)
from tinsel.models import GateStatus
from tinsel.sequence.translate import (
    MIN_ORF_RESIDUES,
    OpenReadingFrame,
    six_frame_orfs,
)

from tinsel_gates.adapters.base import Gate2Adapter, Gate3Adapter, Gate4Adapter
from tinsel_gates.pipeline import _build_gate2, _build_gate3, _build_gate4

logger = logging.getLogger(__name__)

#: How many reading frames are screened, longest first. Each one costs a
#: homology lookup, so an unbounded genome would be an unbounded number of
#: external calls. When frames are left over the report is marked incomplete
#: rather than silently truncated.
MAX_ORFS_SCREENED = 24

#: Concurrent gate calls. Bounded out of courtesy to the external services the
#: adapters depend on, rather than firing fifty lookups at once.
_MAX_CONCURRENCY = 4

_SEVERITY = {
    GateStatus.PASS: 0,
    GateStatus.SKIP: 0,
    GateStatus.WARN: 1,
    GateStatus.FAIL: 2,
}


def _worse[R: Gate2Result | Gate4Result](left: R | None, right: R | None) -> R | None:
    """Return whichever result is more severe, preferring the first on a tie."""
    if left is None:
        return right
    if right is None:
        return left
    return right if _SEVERITY[right.status] > _SEVERITY[left.status] else left


async def run_nucleotide_pipeline(
    dna: str,
    *,
    env: str,
    host_organism: str = "ECOLI",
    min_orf_residues: int = MIN_ORF_RESIDUES,
    max_orfs: int = MAX_ORFS_SCREENED,
    gate2_adapter: Gate2Adapter | None = None,
    gate3_adapter: Gate3Adapter | None = None,
    gate4_adapter: Gate4Adapter | None = None,
) -> ConsequenceReport:
    """Screen *dna* by running the protein gates over its reading frames."""
    orfs = six_frame_orfs(dna, min_residues=min_orf_residues)
    screened = orfs[:max_orfs]
    complete = len(screened) == len(orfs)

    g2 = gate2_adapter or _build_gate2(env)
    g3 = gate3_adapter or _build_gate3(env, host_organism)
    g4 = gate4_adapter or _build_gate4(env)

    # Gate gamma reads codon usage and GC content, so it takes the nucleotide
    # sequence directly. It is the one gate that was always in the right place.
    gate3_result: Gate3Result = await g3.run(dna, "")

    gate2_result: Gate2Result | None = None
    gate4_result: Gate4Result | None = None
    worst_orf: OpenReadingFrame | None = None

    if screened:
        semaphore = asyncio.Semaphore(_MAX_CONCURRENCY)

        async def screen(
            orf: OpenReadingFrame,
        ) -> tuple[OpenReadingFrame, Gate2Result, Gate4Result]:
            # Sequential inside the semaphore: concurrency across frames is
            # what matters, and two awaits type cleanly where a gather of
            # differently typed coroutines does not.
            async with semaphore:
                two = await g2.run("", orf.protein)
                four = await g4.run("", orf.protein)
                return orf, two, four

        for orf, two, four in await asyncio.gather(
            *(screen(orf) for orf in screened)
        ):
            previous = gate2_result
            gate2_result = _worse(gate2_result, two)
            gate4_result = _worse(gate4_result, four)
            # Attribute the worst finding to a frame, so a failure says where.
            if gate2_result is not previous or worst_orf is None:
                worst_orf = orf

        for result, label in ((gate2_result, "beta"), (gate4_result, "delta")):
            if result is not None and result.message and worst_orf is not None:
                result.message = (
                    f"{result.message} [worst reading frame {worst_orf.label}, "
                    f"{len(worst_orf.protein)} residues]"
                )
                logger.debug("Gate %s worst frame %s", label, worst_orf.label)

    results = [r for r in (gate2_result, gate3_result, gate4_result) if r is not None]
    if any(r.status == GateStatus.FAIL for r in results):
        overall = GateStatus.FAIL
    elif any(r.status == GateStatus.WARN for r in results):
        overall = GateStatus.WARN
    else:
        overall = GateStatus.PASS

    # An incomplete screen cannot be a clean pass. A failure stands: finding a
    # hazard in the frames that were checked is a finding regardless.
    if not complete and overall == GateStatus.PASS:
        overall = GateStatus.WARN

    if not orfs:
        note = (
            f"No reading frame of {min_orf_residues} residues or more, so there "
            "is no encoded protein to screen. Codon and composition checks ran "
            "on the nucleotide sequence."
        )
    elif complete:
        note = (
            f"All {len(orfs)} reading frames of {min_orf_residues} residues or "
            "more were screened."
        )
    else:
        note = (
            f"{len(orfs)} reading frames found, the longest {len(screened)} "
            "screened. The rest were not, so this is a partial screen and "
            "cannot be certified clean."
        )

    run_gates: tuple[int, ...] = (2, 3, 4) if screened else (3,)

    return ConsequenceReport(
        gate1=None,
        gate2=gate2_result,
        gate3=gate3_result,
        gate4=gate4_result,
        overall_status=overall,
        skipped_gates=[],
        run_gates=run_gates,
        gate_mode="mock" if env == "test" else "real",
        orf_screen=OrfScreenSummary(
            orfs_found=len(orfs),
            orfs_screened=len(screened),
            min_residues=min_orf_residues,
            complete=complete,
            worst_orf=worst_orf.label if worst_orf else None,
            note=note,
        ),
    )
