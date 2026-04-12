"""Consequence pipeline result models.

These models represent the output of each biosafety gate and the
aggregated ConsequenceReport returned by run_consequence_pipeline().

Gate hierarchy:
    Gate 1 (Structural)  — ESMFold pLDDT + LinearFold ΔMFE
    Gate 2 (Off-target)  — NCBI BLAST + ToxinPred2 + AllerTop
    Gate 3 (Ecological)  — Pathogen screen + HGT score + DriftRadar

Rule: Gate 1 runs first.  If it FAILs, gates 2 and 3 are skipped.
      If gate 1 passes, gates 2 and 3 execute concurrently.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from tinsel.models import GateStatus


class Gate1Result(BaseModel):
    """Structural gate result (ESMFold pLDDT + LinearFold ΔMFE)."""

    status: GateStatus
    plddt_mean: float | None = None
    plddt_low_fraction: float | None = None  # fraction of residues with pLDDT < 50
    delta_mfe: float | None = None           # kcal/mol
    message: str | None = None
    # Rich visualization fields
    plddt_per_residue: list[float] | None = None   # per-residue pLDDT from ESMFold
    instability_index: float | None = None          # Guruprasad 1990; >40 = unstable
    sequence_length: int | None = None              # amino acid count

    @field_validator("plddt_mean")
    @classmethod
    def _plddt_range(cls, v: float | None) -> float | None:
        if v is not None and not (0.0 <= v <= 100.0):
            raise ValueError("plddt_mean must be in [0, 100]")
        return v

    @field_validator("plddt_low_fraction")
    @classmethod
    def _fraction_range(cls, v: float | None) -> float | None:
        if v is not None and not (0.0 <= v <= 1.0):
            raise ValueError("plddt_low_fraction must be in [0, 1]")
        return v


class Gate2Result(BaseModel):
    """Off-target gate result (BLAST + ToxinPred2 + AllerTop)."""

    status: GateStatus
    blast_hits: int = 0                           # human off-target hits (E < 1e-5)
    toxin_probability: float | None = None     # ToxinPred2 score [0, 1]
    allergen_probability: float | None = None  # AllerTop score [0, 1]
    message: str | None = None
    # Rich visualization fields
    blast_top_hits: list[dict] | None = None        # top k-mer matches with scores
    gravy_score: float | None = None                # Kyte-Doolittle grand avg hydropathy
    amino_acid_composition: dict | None = None      # {AA: fraction} for 20 amino acids

    @field_validator("toxin_probability", "allergen_probability")
    @classmethod
    def _prob_range(cls, v: float | None) -> float | None:
        if v is not None and not (0.0 <= v <= 1.0):
            raise ValueError("Probability must be in [0, 1]")
        return v


class Gate3Result(BaseModel):
    """Ecological gate result (Pathogen + HGT + DriftRadar)."""

    status: GateStatus
    pathogen_hits: int = 0               # known pathogen matches
    hgt_score: float | None = None   # horizontal gene transfer risk [0, 100]
    escape_probability: float | None = None  # evolutionary escape probability [0, 1]
    message: str | None = None
    # Rich visualization fields
    gc_content: float | None = None              # GC fraction of coding DNA [0, 1]
    codon_adaptation_index: float | None = None  # CAI vs host organism [0, 1]
    hgt_risk_factors: list[str] | None = None    # human-readable risk explanations

    @field_validator("escape_probability")
    @classmethod
    def _escape_range(cls, v: float | None) -> float | None:
        if v is not None and not (0.0 <= v <= 1.0):
            raise ValueError("escape_probability must be in [0, 1]")
        return v


class ConsequenceReport(BaseModel):
    """Aggregated output of the three-gate biosafety consequence pipeline."""

    gate1: Gate1Result | None = None
    gate2: Gate2Result | None = None
    gate3: Gate3Result | None = None
    overall_status: GateStatus
    # Gates present in run_gates that were skipped because gate 1 failed.
    skipped_gates: list[int] = Field(default_factory=list)
    # Which gate numbers were requested for this run.
    run_gates: tuple[int, ...] = (1, 2, 3)
