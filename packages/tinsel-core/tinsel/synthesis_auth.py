"""ArtGene Synthesis Clearance Document (SCD) — spec version ArtGene-SCD-1.0.

Machine-readable synthesis clearance format for benchtop synthesizers.
Complies with US OSTP 2023 guidance (NIH DURC) and EU Directive 2000/54/EC.

The synthesizer firmware/software only needs to read:
    machine_instructions.proceed_with_synthesis  → bool
    machine_instructions.hold_for_review         → bool
    machine_instructions.reject                  → bool

All regulatory detail is included for audit trail purposes.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------

class USClearance(BaseModel):
    cleared: bool
    framework: str = "NIH-DURC-2012/OSTP-2023"
    select_agent_screened: bool
    functional_analogue_screened: bool
    epppc_concern: bool  # enhanced potential pandemic pathogen concern


class EUClearance(BaseModel):
    cleared: bool
    framework: str = "Dir.2000/54/EC+BSAVE"
    risk_group: str          # "1" | "2" | "4"
    containment_level: str   # "BSL-1" | "BSL-2" | "BSL-4"
    member_state_notification_required: bool


class RegulatoryPackage(BaseModel):
    US_DURC: USClearance
    EU_DUAL_USE: EUClearance


class ScreeningRecord(BaseModel):
    gates_run: list[int]
    overall_status: str
    databases_queried: list[dict]
    gate_mode: str
    fragment_assembly_checked: bool = True


class CryptographicProof(BaseModel):
    pq_algorithm: str
    pq_is_stub: bool
    watermark_tier: str | None
    watermark_id: str | None


class MachineInstructions(BaseModel):
    proceed_with_synthesis: bool
    hold_for_review: bool
    reject: bool
    log_for_regulatory_audit: bool
    special_handling_notes: str | None = None


class SynthesisAuthorization(BaseModel):
    authorized: bool
    authorization_level: str  # "FULL" | "CONDITIONAL" | "DENIED"
    decision: str             # "PROCEED" | "HOLD" | "REJECT"
    decision_reason: str
    requires_biosafety_officer_countersign: bool
    valid_from: str
    valid_until: str
    host_organism: str
    max_synthesis_length_bp: int | None = None


# ---------------------------------------------------------------------------
# Top-level document
# ---------------------------------------------------------------------------

_NOTICE = (
    "This Synthesis Clearance Document is issued by ArtGene Archive under "
    "ArtGene-SCD-1.0 specification. It constitutes a technical biosafety screening "
    "record and does not replace formal regulatory registration (CDC/USDA Select "
    "Agent Program, NIH IBC approval, or EU Directive 2000/54/EC national "
    "implementation). Synthesizers must retain this document for audit purposes."
)


class SynthesisAuthDocument(BaseModel):
    spec_version: str = "ArtGene-SCD-1.0"
    issued_by: str = "ArtGene Archive"
    issued_at: str
    registry_id: str
    sequence_hash: str
    certificate_hash: str
    synthesis_authorization: SynthesisAuthorization
    regulatory_clearance: RegulatoryPackage
    screening_record: ScreeningRecord
    cryptographic_proof: CryptographicProof
    machine_instructions: MachineInstructions
    notice: str = _NOTICE


# ---------------------------------------------------------------------------
# Builder
# ---------------------------------------------------------------------------

def _gate_summary(report: dict) -> dict[str, str]:
    return {
        f"gate_{n}": (report.get(f"gate{n}") or {}).get("status", "skip")
        for n in (1, 2, 3, 4)
    }


def build_synthesis_auth_document(cert: dict) -> SynthesisAuthDocument:
    """Build an ArtGene-SCD-1.0 Synthesis Clearance Document from a certificate data dict.

    ``cert`` must contain: registry_id, sequence_hash, certificate_hash,
    status, timestamp, host_organism, consequence_report, wots_public_key,
    watermark_metadata.
    """
    status = cert["status"]
    report: dict = cert.get("consequence_report") or {}
    pk: dict = cert.get("wots_public_key") or {}
    wm: dict = cert.get("watermark_metadata") or {}

    revoked = status == "REVOKED"
    certified = status == "CERTIFIED"
    warn_only = status == "CERTIFIED_WITH_WARNINGS"
    authorized = certified or warn_only

    # Decision
    if revoked:
        decision, auth_level = "REJECT", "DENIED"
        reason = "Certificate has been revoked. Do not synthesise."
    elif certified:
        decision, auth_level = "PROCEED", "FULL"
        reason = "All biosafety gates passed. Certificate CERTIFIED."
    elif warn_only:
        decision, auth_level = "HOLD", "CONDITIONAL"
        reason = (
            "Certificate CERTIFIED WITH WARNINGS. "
            "Manual biosafety review recommended before synthesis."
        )
    else:
        decision, auth_level = "REJECT", "DENIED"
        reason = f"Certificate status is {status}. Synthesis not authorised."

    # Validity window (12 months from certification)
    raw_ts = cert.get("timestamp", datetime.now(UTC).isoformat())
    try:
        from_dt = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
    except Exception:
        from_dt = datetime.now(UTC)
    until_dt = from_dt.replace(year=from_dt.year + 1)

    # Gate summary
    gs = _gate_summary(report)
    g2 = gs.get("gate_2", "skip")
    g4 = gs.get("gate_4", "skip")
    databases: list[dict] = (report.get("gate2") or {}).get("databases_queried") or []

    any_fail = any(v == "fail" for v in gs.values())
    any_warn = any(v == "warn" for v in gs.values())
    risk_group = "4" if any_fail else "2" if any_warn else "1"

    us = USClearance(
        cleared=authorized,
        select_agent_screened=any(
            db.get("name", "").startswith(("SecureDNA", "IBBIS", "BLAST"))
            for db in databases
        ),
        functional_analogue_screened=g4 != "skip",
        epppc_concern=g2 == "fail" or g4 == "fail",
    )

    eu = EUClearance(
        cleared=authorized,
        risk_group=risk_group,
        containment_level={"1": "BSL-1", "2": "BSL-2", "4": "BSL-4"}[risk_group],
        member_state_notification_required=any_fail,
    )

    config: dict = wm.get("config") or {}

    return SynthesisAuthDocument(
        issued_at=datetime.now(UTC).isoformat(),
        registry_id=cert["registry_id"],
        sequence_hash=cert["sequence_hash"],
        certificate_hash=cert["certificate_hash"],
        synthesis_authorization=SynthesisAuthorization(
            authorized=authorized,
            authorization_level=auth_level,
            decision=decision,
            decision_reason=reason,
            requires_biosafety_officer_countersign=warn_only,
            valid_from=from_dt.isoformat(),
            valid_until=until_dt.isoformat(),
            host_organism=cert.get("host_organism", "ECOLI"),
        ),
        regulatory_clearance=RegulatoryPackage(US_DURC=us, EU_DUAL_USE=eu),
        screening_record=ScreeningRecord(
            gates_run=list(report.get("run_gates") or []),
            overall_status=report.get("overall_status", "skip"),
            databases_queried=databases,
            gate_mode=report.get("gate_mode", "unknown"),
        ),
        cryptographic_proof=CryptographicProof(
            pq_algorithm=pk.get("algorithm_id", "stub_zero_v1"),
            pq_is_stub=pk.get("is_stub", True),
            watermark_tier=config.get("tier"),
            watermark_id=wm.get("watermark_id"),
        ),
        machine_instructions=MachineInstructions(
            proceed_with_synthesis=decision == "PROCEED",
            hold_for_review=decision == "HOLD",
            reject=decision == "REJECT",
            log_for_regulatory_audit=True,
            special_handling_notes=(
                "Biosafety officer countersign required before synthesis."
                if warn_only else
                "Certificate revoked — contact ArtGene support."
                if revoked else
                None
            ),
        ),
    )
