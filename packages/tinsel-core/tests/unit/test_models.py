"""Unit tests for tinsel.models (20 tests)."""

import pytest
from pydantic import ValidationError as PydanticValidationError
from tinsel.models import (
    BlastHit,
    BlastResult,
    ESMFoldResult,
    GateResult,
    GateStatus,
    PipelineResult,
    SequenceRecord,
    SequenceType,
    ToxinPredResult,
)

# ---------------------------------------------------------------------------
# SequenceType enum
# ---------------------------------------------------------------------------

def test_sequence_type_enum_values():
    assert SequenceType.DNA == "dna"
    assert SequenceType.RNA == "rna"
    assert SequenceType.PROTEIN == "protein"


# ---------------------------------------------------------------------------
# GateStatus enum
# ---------------------------------------------------------------------------

def test_gate_status_enum_values():
    assert GateStatus.PASS == "pass"
    assert GateStatus.FAIL == "fail"
    assert GateStatus.WARN == "warn"
    assert GateStatus.SKIP == "skip"


# ---------------------------------------------------------------------------
# SequenceRecord
# ---------------------------------------------------------------------------

def test_sequence_record_creation():
    rec = SequenceRecord(id="seq1", sequence="ATCG", seq_type=SequenceType.DNA)
    assert rec.id == "seq1"
    assert rec.seq_type == SequenceType.DNA


def test_sequence_record_sequence_uppercased():
    rec = SequenceRecord(id="seq2", sequence="atcg", seq_type=SequenceType.DNA)
    assert rec.sequence == "ATCG"


def test_sequence_record_empty_sequence_raises():
    with pytest.raises(PydanticValidationError):
        SequenceRecord(id="bad", sequence="   ", seq_type=SequenceType.DNA)


def test_sequence_record_default_metadata():
    rec = SequenceRecord(id="seq3", sequence="ACGT", seq_type=SequenceType.DNA)
    assert rec.metadata == {}
    assert rec.description is None


def test_sequence_record_with_metadata():
    rec = SequenceRecord(
        id="seq4",
        sequence="MAEQ",
        seq_type=SequenceType.PROTEIN,
        description="test protein",
        metadata={"organism": "E. coli"},
    )
    assert rec.metadata["organism"] == "E. coli"
    assert rec.description == "test protein"


# ---------------------------------------------------------------------------
# GateResult
# ---------------------------------------------------------------------------

def test_gate_result_creation():
    gr = GateResult(gate_name="test_gate", status=GateStatus.PASS, score=0.95)
    assert gr.gate_name == "test_gate"
    assert gr.status == GateStatus.PASS
    assert gr.score == pytest.approx(0.95)


# ---------------------------------------------------------------------------
# ESMFoldResult
# ---------------------------------------------------------------------------

def test_esmfold_result_default_gate_name():
    r = ESMFoldResult(status=GateStatus.PASS)
    assert r.gate_name == "esmfold"


def test_esmfold_result_valid_plddt():
    r = ESMFoldResult(status=GateStatus.PASS, plddt_mean=87.3)
    assert r.plddt_mean == pytest.approx(87.3)


def test_esmfold_result_plddt_boundary_values():
    r_low = ESMFoldResult(status=GateStatus.PASS, plddt_mean=0.0)
    r_high = ESMFoldResult(status=GateStatus.PASS, plddt_mean=100.0)
    assert r_low.plddt_mean == 0.0
    assert r_high.plddt_mean == 100.0


def test_esmfold_result_invalid_plddt_raises():
    with pytest.raises(PydanticValidationError):
        ESMFoldResult(status=GateStatus.FAIL, plddt_mean=101.0)


# ---------------------------------------------------------------------------
# BlastHit
# ---------------------------------------------------------------------------

def test_blast_hit_creation():
    hit = BlastHit(
        accession="NP_001234",
        description="hypothetical protein",
        score=550.0,
        evalue=1e-80,
        identity_pct=98.5,
        coverage_pct=100.0,
    )
    assert hit.accession == "NP_001234"
    assert hit.identity_pct == pytest.approx(98.5)


def test_blast_hit_invalid_identity_raises():
    with pytest.raises(PydanticValidationError):
        BlastHit(
            accession="X",
            description="bad",
            score=1.0,
            evalue=0.01,
            identity_pct=101.0,
            coverage_pct=50.0,
        )


def test_blast_hit_invalid_coverage_raises():
    with pytest.raises(PydanticValidationError):
        BlastHit(
            accession="X",
            description="bad",
            score=1.0,
            evalue=0.01,
            identity_pct=50.0,
            coverage_pct=-1.0,
        )


# ---------------------------------------------------------------------------
# BlastResult
# ---------------------------------------------------------------------------

def test_blast_result_default_gate_name():
    r = BlastResult(status=GateStatus.PASS)
    assert r.gate_name == "ncbi_blast"


def test_blast_result_empty_hits():
    r = BlastResult(status=GateStatus.SKIP)
    assert r.hits == []
    assert r.top_hit is None


# ---------------------------------------------------------------------------
# ToxinPredResult
# ---------------------------------------------------------------------------

def test_toxinpred_result_default_gate_name():
    r = ToxinPredResult(status=GateStatus.PASS)
    assert r.gate_name == "toxinpred"


def test_toxinpred_result_valid_score():
    r = ToxinPredResult(status=GateStatus.PASS, toxicity_score=0.12)
    assert r.toxicity_score == pytest.approx(0.12)


def test_toxinpred_result_invalid_score_raises():
    with pytest.raises(PydanticValidationError):
        ToxinPredResult(status=GateStatus.FAIL, toxicity_score=1.5)


# ---------------------------------------------------------------------------
# PipelineResult
# ---------------------------------------------------------------------------

def test_pipeline_result_compute_summary_all_pass():
    pr = PipelineResult(
        sequence_id="seq1",
        gates=[
            GateResult(gate_name="g1", status=GateStatus.PASS),
            GateResult(gate_name="g2", status=GateStatus.PASS),
        ],
    )
    pr.compute_summary()
    assert pr.passed_gates == 2
    assert pr.failed_gates == 0
    assert pr.overall_status == GateStatus.PASS


def test_pipeline_result_compute_summary_with_fail():
    pr = PipelineResult(
        sequence_id="seq2",
        gates=[
            GateResult(gate_name="g1", status=GateStatus.PASS),
            GateResult(gate_name="g2", status=GateStatus.FAIL),
            GateResult(gate_name="g3", status=GateStatus.WARN),
        ],
    )
    pr.compute_summary()
    assert pr.failed_gates == 1
    assert pr.warned_gates == 1
    assert pr.overall_status == GateStatus.FAIL
