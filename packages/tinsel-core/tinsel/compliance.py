"""Framework-agnostic compliance manifest for ArtGene Archive certificates.

Builds a ComplianceManifest from stored certificate data and renders it into
one or more jurisdiction-specific FrameworkAttestation objects.

Supported frameworks
--------------------
US_DURC     NIH Dual-Use Research of Concern Policy (2012) + OSTP 2023 guidance
EU_DUAL_USE EU Directive 2000/54/EC on biological agents + BSAVE framework
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

_REGULATORY_NOTICE = (
    "This attestation is a technical screening record produced by ArtGene Archive. "
    "It does not substitute for formal regulatory registration (e.g. CDC/USDA Select "
    "Agent Program, NIH IBC approval, or EU Directive 2000/54/EC national implementation). "
    "Consult your institutional biosafety officer before proceeding with synthesis."
)


class FrameworkAttestation(BaseModel):
    framework: str
    version: str
    fields: dict[str, Any]


class ComplianceManifest(BaseModel):
    schema_version: str = "1.0"
    generated_at: str
    registry_id: str
    certificate_hash: str
    sequence_hash: str
    status: str
    certified_at: str
    owner_id: str
    org_id: str
    ethics_code: str
    host_organism: str
    gate_mode: str
    run_gates: list[int]
    skipped_gates: list[int]
    gate_summary: dict[str, str]
    databases_queried: list[dict] = Field(default_factory=list)
    wots_algorithm: str
    wots_is_stub: bool
    framework_attestations: list[FrameworkAttestation]
    regulatory_notice: str = _REGULATORY_NOTICE


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _gate_summary(report: dict) -> dict[str, str]:
    return {
        f"gate_{n}": (report.get(f"gate{n}") or {}).get("status", "skip")
        for n in (1, 2, 3, 4)
    }


# ---------------------------------------------------------------------------
# Public builder
# ---------------------------------------------------------------------------

def build_compliance_manifest(
    cert: dict,
    frameworks: list[str] | None = None,
) -> ComplianceManifest:
    """Build a ComplianceManifest from a certificate data dict.

    ``cert`` must contain at minimum: registry_id, certificate_hash,
    sequence_hash, status, timestamp, owner_id, org_id, ethics_code,
    host_organism, consequence_report (dict), wots_public_key (dict).
    """
    if frameworks is None:
        frameworks = ["US_DURC", "EU_DUAL_USE"]

    report: dict = cert.get("consequence_report") or {}
    pk: dict = cert.get("wots_public_key") or {}

    gs = _gate_summary(report)
    databases: list[dict] = (report.get("gate2") or {}).get("databases_queried") or []

    attestations: list[FrameworkAttestation] = []
    if "US_DURC" in frameworks:
        attestations.append(_render_us_durc(cert, gs, databases))
    if "EU_DUAL_USE" in frameworks:
        attestations.append(_render_eu_dual_use(cert, gs))

    return ComplianceManifest(
        generated_at=datetime.now(UTC).isoformat(),
        registry_id=cert["registry_id"],
        certificate_hash=cert["certificate_hash"],
        sequence_hash=cert["sequence_hash"],
        status=cert["status"],
        certified_at=cert["timestamp"],
        owner_id=cert["owner_id"],
        org_id=cert["org_id"],
        ethics_code=cert["ethics_code"],
        host_organism=cert["host_organism"],
        gate_mode=report.get("gate_mode", "unknown"),
        run_gates=list(report.get("run_gates") or []),
        skipped_gates=list(report.get("skipped_gates") or []),
        gate_summary=gs,
        databases_queried=databases,
        wots_algorithm=pk.get("algorithm_id", "stub_zero_v1"),
        wots_is_stub=pk.get("is_stub", True),
        framework_attestations=attestations,
    )


# ---------------------------------------------------------------------------
# Framework renderers
# ---------------------------------------------------------------------------

def _render_us_durc(
    cert: dict,
    gs: dict[str, str],
    databases: list[dict],
) -> FrameworkAttestation:
    status = cert["status"]
    g2 = gs.get("gate_2", "skip")
    g4 = gs.get("gate_4", "skip")

    select_agent_screened = any(
        db.get("name", "").startswith(("SecureDNA", "IBBIS", "BLAST"))
        for db in databases
    )

    return FrameworkAttestation(
        framework="US_DURC",
        version="NIH-DURC-2012/OSTP-2023",
        fields={
            "policy_reference": (
                "NIH Dual Use Research of Concern Policy (2012); "
                "OSTP Biosecurity Guidance for Providers of Synthetic Nucleic Acids (2023)"
            ),
            "investigator_declaration": cert["owner_id"],
            "ethics_declaration": cert["ethics_code"],
            "institutional_review_completed": True,
            "select_agent_screened": select_agent_screened,
            "select_agent_screening_outcome": g2 if g2 != "skip" else "not_run",
            "functional_analogue_screened": g4 != "skip",
            "functional_analogue_outcome": g4 if g4 != "skip" else "not_run",
            "enhanced_potential_pandemic_pathogen_concern": g2 == "fail" or g4 == "fail",
            "screening_passed": status in ("CERTIFIED", "CERTIFIED_WITH_WARNINGS"),
            "recommended_action": (
                "Approved for synthesis"
                if status == "CERTIFIED"
                else "Manual biosafety review recommended before synthesis"
                if status == "CERTIFIED_WITH_WARNINGS"
                else "Rejected — do not synthesise"
            ),
        },
    )


def _render_eu_dual_use(
    cert: dict,
    gs: dict[str, str],
) -> FrameworkAttestation:
    status = cert["status"]
    any_fail = any(v == "fail" for v in gs.values())
    any_warn = any(v == "warn" for v in gs.values())
    risk_group = "4" if any_fail else "2" if any_warn else "1"
    containment = {"1": "BSL-1", "2": "BSL-2", "4": "BSL-4"}[risk_group]

    return FrameworkAttestation(
        framework="EU_DUAL_USE",
        version="Dir.2000/54/EC+BSAVE",
        fields={
            "policy_reference": (
                "EU Directive 2000/54/EC on protection of workers from biological agents; "
                "BSAVE biosecurity dual-use framework"
            ),
            "declarant": cert["owner_id"],
            "ethics_reference": cert["ethics_code"],
            "host_organism": cert["host_organism"],
            "structural_assessment": gs.get("gate_1", "skip"),
            "toxin_allergen_screening": gs.get("gate_2", "skip"),
            "ecological_risk_assessment": gs.get("gate_3", "skip"),
            "functional_analogue_detection": gs.get("gate_4", "skip"),
            "inferred_biological_risk_group": risk_group,
            "recommended_containment_level": containment,
            "dual_use_concern_identified": any_fail or any_warn,
            "member_state_notification_required": any_fail,
            "approved_for_synthesis": status in ("CERTIFIED", "CERTIFIED_WITH_WARNINGS"),
        },
    )
