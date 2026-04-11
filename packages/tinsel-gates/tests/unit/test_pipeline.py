"""Unit tests for run_consequence_pipeline() — 8 test cases.

All tests run in mock mode (env="test") so no network calls are made.
Adapter behaviour is controlled via dependency injection: pass a
configured Mock{Gate}Adapter to force the desired outcome.

Test matrix
-----------
1. All gates pass         — default mock adapters, everything green
2. Gate 1 FAIL            — gates 2+3 skipped (fail-fast)
3. Gate 2 FAIL (toxin)    — ToxinPred2 probability above threshold
4. Gate 2 FAIL (BLAST)    — off-target human protein hits detected
5. Gate 3 FAIL (HGT)      — horizontal gene transfer score above threshold
6. Gate 3 FAIL (pathogen) — known pathogen sequence match
7. run_gates=(1,)         — gate 1 only; gates 2+3 are None, not skipped
8. ConsequenceReport fields fully populated — every field non-None
"""

import pytest
from tinsel.consequence import ConsequenceReport
from tinsel.models import GateStatus
from tinsel_gates.adapters.gate1 import MockGate1Adapter
from tinsel_gates.adapters.gate2 import MockGate2Adapter
from tinsel_gates.adapters.gate3 import MockGate3Adapter
from tinsel_gates.pipeline import run_consequence_pipeline

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

# NB-GLP1-047 (39 aa, all gates PASS with default mocks)
PROTEIN = "HAEGTFTSDVSSYLEGQAAKEFIAWLVKGRCEGVLGDTFR"
DNA = "CATGCTGAAGGAACTTTTACGTCAGACGTTAGCAGTTACCTTGAGGGACAAGCTAAAGAGTTTATCGCTTGGCTTGTCAAAGGTCGCTGTGAAGGAGTCCTTGGTGATACCTTTCGT"  # noqa: E501


# ---------------------------------------------------------------------------
# Test 1 — All gates PASS (default mock mode)
# ---------------------------------------------------------------------------

async def test_all_gates_pass() -> None:
    report = await run_consequence_pipeline(protein=PROTEIN, dna=DNA, env="test")

    assert isinstance(report, ConsequenceReport)
    assert report.gate1 is not None
    assert report.gate2 is not None
    assert report.gate3 is not None
    assert report.gate1.status == GateStatus.PASS
    assert report.gate2.status == GateStatus.PASS
    assert report.gate3.status == GateStatus.PASS
    assert report.overall_status == GateStatus.PASS
    assert report.skipped_gates == []


# ---------------------------------------------------------------------------
# Test 2 — Gate 1 FAIL → gates 2+3 skipped
# ---------------------------------------------------------------------------

async def test_gate1_fail_skips_downstream() -> None:
    failing_g1 = MockGate1Adapter(plddt_mean=40.0)  # 40 < 70 → FAIL

    report = await run_consequence_pipeline(
        protein=PROTEIN,
        dna=DNA,
        env="test",
        gate1_adapter=failing_g1,
    )

    assert report.gate1.status == GateStatus.FAIL
    assert report.gate2 is None, "Gate 2 should be skipped when gate 1 fails"
    assert report.gate3 is None, "Gate 3 should be skipped when gate 1 fails"
    assert report.overall_status == GateStatus.FAIL
    assert 2 in report.skipped_gates
    assert 3 in report.skipped_gates


# ---------------------------------------------------------------------------
# Test 3 — Gate 2 FAIL via toxin probability
# ---------------------------------------------------------------------------

async def test_gate2_fail_toxin_probability() -> None:
    toxic_g2 = MockGate2Adapter(toxin_probability=0.75)  # 0.75 >= 0.30 → FAIL

    report = await run_consequence_pipeline(
        protein=PROTEIN,
        dna=DNA,
        env="test",
        gate2_adapter=toxic_g2,
    )

    assert report.gate1.status == GateStatus.PASS
    assert report.gate2 is not None
    assert report.gate2.status == GateStatus.FAIL
    assert report.gate2.toxin_probability == pytest.approx(0.75)
    assert report.overall_status == GateStatus.FAIL
    assert report.skipped_gates == []  # gate 3 still ran


# ---------------------------------------------------------------------------
# Test 4 — Gate 2 FAIL via BLAST off-target hits
# ---------------------------------------------------------------------------

async def test_gate2_fail_blast_hits() -> None:
    offtarget_g2 = MockGate2Adapter(blast_hits=3)  # 3 > 0 → FAIL

    report = await run_consequence_pipeline(
        protein=PROTEIN,
        dna=DNA,
        env="test",
        gate2_adapter=offtarget_g2,
    )

    assert report.gate1.status == GateStatus.PASS
    assert report.gate2 is not None
    assert report.gate2.status == GateStatus.FAIL
    assert report.gate2.blast_hits == 3
    assert report.overall_status == GateStatus.FAIL


# ---------------------------------------------------------------------------
# Test 5 — Gate 3 FAIL via HGT score
# ---------------------------------------------------------------------------

async def test_gate3_fail_hgt_score() -> None:
    hgt_g3 = MockGate3Adapter(hgt_score=75.0)  # 75.0 >= 50.0 → FAIL

    report = await run_consequence_pipeline(
        protein=PROTEIN,
        dna=DNA,
        env="test",
        gate3_adapter=hgt_g3,
    )

    assert report.gate1.status == GateStatus.PASS
    assert report.gate2.status == GateStatus.PASS
    assert report.gate3 is not None
    assert report.gate3.status == GateStatus.FAIL
    assert report.gate3.hgt_score == pytest.approx(75.0)
    assert report.overall_status == GateStatus.FAIL


# ---------------------------------------------------------------------------
# Test 6 — Gate 3 FAIL via pathogen hit
# ---------------------------------------------------------------------------

async def test_gate3_fail_pathogen_hit() -> None:
    pathogen_g3 = MockGate3Adapter(pathogen_hits=1)  # 1 > 0 → FAIL

    report = await run_consequence_pipeline(
        protein=PROTEIN,
        dna=DNA,
        env="test",
        gate3_adapter=pathogen_g3,
    )

    assert report.gate1.status == GateStatus.PASS
    assert report.gate2.status == GateStatus.PASS
    assert report.gate3 is not None
    assert report.gate3.status == GateStatus.FAIL
    assert report.gate3.pathogen_hits == 1
    assert report.overall_status == GateStatus.FAIL


# ---------------------------------------------------------------------------
# Test 7 — run_gates=(1,): gate 1 only
# ---------------------------------------------------------------------------

async def test_run_gate1_only() -> None:
    report = await run_consequence_pipeline(
        protein=PROTEIN,
        dna=DNA,
        env="test",
        run_gates=(1,),
    )

    assert report.gate1 is not None
    assert report.gate1.status == GateStatus.PASS
    assert report.gate2 is None, "Gate 2 was not requested"
    assert report.gate3 is None, "Gate 3 was not requested"
    # Not skipped — simply not requested
    assert report.skipped_gates == []
    assert report.overall_status == GateStatus.PASS


# ---------------------------------------------------------------------------
# Test 8 — ConsequenceReport fields fully populated
# ---------------------------------------------------------------------------

async def test_consequence_report_fully_populated() -> None:
    report = await run_consequence_pipeline(protein=PROTEIN, dna=DNA, env="test")

    # Gate 1 structural fields
    assert report.gate1 is not None
    assert report.gate1.plddt_mean is not None
    assert report.gate1.plddt_low_fraction is not None
    assert report.gate1.delta_mfe is not None
    assert report.gate1.message is not None

    # Gate 2 off-target fields
    assert report.gate2 is not None
    assert report.gate2.blast_hits is not None
    assert report.gate2.toxin_probability is not None
    assert report.gate2.allergen_probability is not None
    assert report.gate2.message is not None

    # Gate 3 ecological fields
    assert report.gate3 is not None
    assert report.gate3.pathogen_hits is not None
    assert report.gate3.hgt_score is not None
    assert report.gate3.escape_probability is not None
    assert report.gate3.message is not None

    # Top-level report fields
    assert report.overall_status is not None
    assert isinstance(report.skipped_gates, list)
    assert isinstance(report.run_gates, tuple)
    assert set(report.run_gates) == {1, 2, 3}
