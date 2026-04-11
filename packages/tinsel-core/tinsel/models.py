"""Pydantic models for tinsel-core: sequences, gate results, and pipeline outputs."""

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, field_validator


class SequenceType(StrEnum):
    DNA = "dna"
    RNA = "rna"
    PROTEIN = "protein"


class GateStatus(StrEnum):
    PASS = "pass"
    FAIL = "fail"
    WARN = "warn"
    SKIP = "skip"


class SequenceRecord(BaseModel):
    id: str
    sequence: str
    seq_type: SequenceType
    description: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("sequence")
    @classmethod
    def sequence_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Sequence cannot be empty")
        return v.upper()


class GateResult(BaseModel):
    gate_name: str
    status: GateStatus
    score: float | None = None
    message: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ESMFoldResult(GateResult):
    gate_name: str = "esmfold"
    plddt_mean: float | None = None
    plddt_scores: list[float] | None = None
    pdb_string: str | None = None

    @field_validator("plddt_mean")
    @classmethod
    def validate_plddt(cls, v: float | None) -> float | None:
        if v is not None and not (0.0 <= v <= 100.0):
            raise ValueError("pLDDT score must be between 0 and 100")
        return v


class BlastHit(BaseModel):
    accession: str
    description: str
    score: float
    evalue: float
    identity_pct: float
    coverage_pct: float

    @field_validator("identity_pct", "coverage_pct")
    @classmethod
    def validate_percentage(cls, v: float) -> float:
        if not (0.0 <= v <= 100.0):
            raise ValueError("Percentage must be between 0 and 100")
        return v


class BlastResult(GateResult):
    gate_name: str = "ncbi_blast"
    query_length: int | None = None
    hits: list[BlastHit] = Field(default_factory=list)
    top_hit: BlastHit | None = None


class ToxinPredResult(GateResult):
    gate_name: str = "toxinpred"
    is_toxic: bool | None = None
    toxicity_score: float | None = None
    svm_score: float | None = None

    @field_validator("toxicity_score")
    @classmethod
    def validate_toxicity_score(cls, v: float | None) -> float | None:
        if v is not None and not (0.0 <= v <= 1.0):
            raise ValueError("Toxicity score must be between 0 and 1")
        return v


class PipelineResult(BaseModel):
    sequence_id: str
    overall_status: GateStatus = GateStatus.PASS
    gates: list[GateResult] = Field(default_factory=list)
    passed_gates: int = 0
    failed_gates: int = 0
    warned_gates: int = 0

    def compute_summary(self) -> None:
        """Recompute pass/fail/warn counts and overall_status from gates list."""
        self.passed_gates = sum(1 for g in self.gates if g.status == GateStatus.PASS)
        self.failed_gates = sum(1 for g in self.gates if g.status == GateStatus.FAIL)
        self.warned_gates = sum(1 for g in self.gates if g.status == GateStatus.WARN)
        if self.failed_gates > 0:
            self.overall_status = GateStatus.FAIL
        elif self.warned_gates > 0:
            self.overall_status = GateStatus.WARN
        else:
            self.overall_status = GateStatus.PASS
