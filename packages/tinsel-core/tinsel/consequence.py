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

from typing import Optional

from pydantic import BaseModel, Field, field_validator

from tinsel.models import GateStatus


class Gate1Result(BaseModel):
    """Structural gate result (ESMFold pLDDT + LinearFold ΔMFE)."""

    status: GateStatus
    plddt_mean: Optional[float] = None
    plddt_low_fraction: Optional[float] = None  # fraction of residues with pLDDT < 50
    delta_mfe: Optional[float] = None           # kcal/mol
    message: Optional[str] = None

    @field_validator("plddt_mean")
    @classmethod
    def _plddt_range(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (0.0 <= v <= 100.0):
            raise ValueError("plddt_mean must be in [0, 100]")
        return v

    @field_validator("plddt_low_fraction")
    @classmethod
    def _fraction_range(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (0.0 <= v <= 1.0):
            raise ValueError("plddt_low_fraction must be in [0, 1]")
        return v


class Gate2Result(BaseModel):
    """Off-target gate result (BLAST + ToxinPred2 + AllerTop)."""

    status: GateStatus
    blast_hits: int = 0                           # human off-target hits (E < 1e-5)
    toxin_probability: Optional[float] = None     # ToxinPred2 score [0, 1]
    allergen_probability: Optional[float] = None  # AllerTop score [0, 1]
    message: Optional[str] = None

    @field_validator("toxin_probability", "allergen_probability")
    @classmethod
    def _prob_range(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (0.0 <= v <= 1.0):
            raise ValueError("Probability must be in [0, 1]")
        return v


class Gate3Result(BaseModel):
    """Ecological gate result (Pathogen + HGT + DriftRadar)."""

    status: GateStatus
    pathogen_hits: int = 0               # known pathogen matches
    hgt_score: Optional[float] = None   # horizontal gene transfer risk [0, 100]
    escape_probability: Optional[float] = None  # evolutionary escape probability [0, 1]
    message: Optional[str] = None

    @field_validator("escape_probability")
    @classmethod
    def _escape_range(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (0.0 <= v <= 1.0):
            raise ValueError("escape_probability must be in [0, 1]")
        return v


class ConsequenceReport(BaseModel):
    """Aggregated output of the three-gate biosafety consequence pipeline."""

    gate1: Optional[Gate1Result] = None
    gate2: Optional[Gate2Result] = None
    gate3: Optional[Gate3Result] = None
    overall_status: GateStatus
    # Gates present in run_gates that were skipped because gate 1 failed.
    skipped_gates: list[int] = Field(default_factory=list)
    # Which gate numbers were requested for this run.
    run_gates: tuple[int, ...] = (1, 2, 3)
