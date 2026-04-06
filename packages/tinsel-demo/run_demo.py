#!/usr/bin/env python3
"""TINSEL six-sequence demonstration.

Covers every system state:
  01  GLP-1 agonist        → all 3 gates PASS  →  CERTIFIED / STANDARD
  02  Misfolded variant     → Gate 1 FAIL        →  REJECTED (no cert)
  03  Toxin homolog         → Gate 2 FAIL        →  REJECTED (no cert)
  04  IS element            → Gate 3 FAIL        →  REJECTED (no cert)
  05  Near-threshold        → Gate 3 WARN        →  CERTIFIED / REDUCED (escalated review)
  06  CRISPR sgRNA          → all 3 gates PASS   →  CERTIFIED (non-protein DNA input)

Usage
-----
  # Generate golden files on first run:
  python run_demo.py --generate

  # Verify pipeline output matches golden files (CI):
  python run_demo.py

  # Show full diff on mismatch:
  python run_demo.py --verbose
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

from tinsel.consequence import ConsequenceReport
from tinsel.models import GateStatus
from tinsel.registry import CertificateStatus, WatermarkTier
from tinsel.sequence.fasta import normalise
from tinsel.watermark.tinsel_encoder import TINSELEncoder
from tinsel_gates.adapters.gate1.mock import MockGate1Adapter
from tinsel_gates.adapters.gate2.mock import MockGate2Adapter
from tinsel_gates.adapters.gate3.mock import MockGate3Adapter
from tinsel_gates.pipeline import run_consequence_pipeline

# ---------------------------------------------------------------------------
# Demo constants — deterministic across runs
# ---------------------------------------------------------------------------

DEMO_KEY = bytes.fromhex("aa" * 32)          # fixed demo spreading key
DEMO_KEY_ID = "demo-key-v1"

HERE = Path(__file__).parent
SEQ_DIR = HERE / "sequences"
GOLDEN_DIR = HERE / "golden"

# ---------------------------------------------------------------------------
# Sequence manifest
# Each entry drives one full pipeline run.
# ---------------------------------------------------------------------------

MANIFEST: list[dict[str, Any]] = [
    {
        "seq_id": "01",
        "label": "GLP-1 agonist variant — all gates PASS",
        "fasta": "01_glp1_pass.fasta",
        "watermark_id": "DEMO-01-GLP1-PASS",
        # Default adapters → all PASS
        "gate1": MockGate1Adapter(),
        "gate2": MockGate2Adapter(),
        "gate3": MockGate3Adapter(),
        "expected_overall": GateStatus.PASS,
        "expected_cert": CertificateStatus.CERTIFIED,
    },
    {
        "seq_id": "02",
        "label": "Misfolded variant — Gate 1 FAIL (pLDDT 42)",
        "fasta": "02_misfolded_gate1_fail.fasta",
        "watermark_id": "DEMO-02-MISFOLD-FAIL",
        "gate1": MockGate1Adapter(plddt_mean=42.0, plddt_low_fraction=0.65, delta_mfe=4.1),
        "gate2": MockGate2Adapter(),
        "gate3": MockGate3Adapter(),
        "expected_overall": GateStatus.FAIL,
        "expected_cert": CertificateStatus.FAILED,
    },
    {
        "seq_id": "03",
        "label": "Toxin homolog — Gate 2 FAIL (toxin_prob 0.87)",
        "fasta": "03_toxin_gate2_fail.fasta",
        "watermark_id": "DEMO-03-TOXIN-FAIL",
        "gate1": MockGate1Adapter(),                            # passes
        "gate2": MockGate2Adapter(toxin_probability=0.87),      # FAIL
        "gate3": MockGate3Adapter(),
        "expected_overall": GateStatus.FAIL,
        "expected_cert": CertificateStatus.FAILED,
    },
    {
        "seq_id": "04",
        "label": "IS element — Gate 3 FAIL (HGT score 74)",
        "fasta": "04_is_element_gate3_fail.fasta",
        "watermark_id": "DEMO-04-ISELEMENT-FAIL",
        "gate1": MockGate1Adapter(),                            # passes
        "gate2": MockGate2Adapter(),                            # passes
        "gate3": MockGate3Adapter(hgt_score=74.0),              # FAIL
        "expected_overall": GateStatus.FAIL,
        "expected_cert": CertificateStatus.FAILED,
    },
    {
        "seq_id": "05",
        "label": "Near-threshold — Gate 3 WARN → ESCALATED",
        "fasta": "05_near_threshold_warn.fasta",
        "watermark_id": "DEMO-05-NEARTHRESH-WARN",
        "gate1": MockGate1Adapter(),                            # passes
        "gate2": MockGate2Adapter(),                            # passes
        "gate3": MockGate3Adapter(escape_probability=0.18),     # WARN
        "expected_overall": GateStatus.WARN,
        "expected_cert": CertificateStatus.CERTIFIED,           # WARN → still certified
    },
    {
        "seq_id": "06",
        "label": "CRISPR sgRNA — all gates PASS (non-protein DNA input)",
        "fasta": "06_sgrna_pass.fasta",
        "watermark_id": "DEMO-06-SGRNA-PASS",
        # Default adapters → all PASS
        "gate1": MockGate1Adapter(),
        "gate2": MockGate2Adapter(),
        "gate3": MockGate3Adapter(),
        "expected_overall": GateStatus.PASS,
        "expected_cert": CertificateStatus.CERTIFIED,
    },
]

# ---------------------------------------------------------------------------
# Pipeline runner
# ---------------------------------------------------------------------------

async def run_sequence(entry: dict[str, Any]) -> dict[str, Any]:
    """Run the full TINSEL pipeline for one sequence and return a result dict."""
    fasta_path = SEQ_DIR / entry["fasta"]
    fasta_text = fasta_path.read_text()
    header, sequence, seq_type = normalise(fasta_text)

    # ── Consequence pipeline ───────────────────────────────────────────────
    report: ConsequenceReport = await run_consequence_pipeline(
        protein=sequence,
        dna=sequence if seq_type.value == "dna" else "",
        env="test",
        gate1_adapter=entry["gate1"],
        gate2_adapter=entry["gate2"],
        gate3_adapter=entry["gate3"],
    )

    # ── Certificate status ────────────────────────────────────────────────
    cert_status = (
        CertificateStatus.FAILED
        if report.overall_status == GateStatus.FAIL
        else CertificateStatus.CERTIFIED
    )

    # ── Watermark encoding (only when pipeline passes or warns) ───────────
    watermark: dict[str, Any] | None = None
    if cert_status == CertificateStatus.CERTIFIED:
        encoder = TINSELEncoder(DEMO_KEY, DEMO_KEY_ID)
        encode_result = encoder.encode(sequence, entry["watermark_id"])
        seq_hash = encoder.sequence_hash(sequence)
        watermark = {
            "tier": encode_result.tier.value,
            "carrier_positions": encode_result.carrier_positions,
            "chi_squared": encode_result.chi_squared,
            "sequence_hash": seq_hash,
            "watermark_id": entry["watermark_id"],
        }

    return {
        "meta": {
            "seq_id": entry["seq_id"],
            "label": entry["label"],
            "fasta": entry["fasta"],
            "seq_type": seq_type.value,
            "header": header,
        },
        "pipeline": {
            "overall_status": report.overall_status.value,
            "gate1": _gate1_dict(report),
            "gate2": _gate2_dict(report),
            "gate3": _gate3_dict(report),
            "skipped_gates": list(report.skipped_gates),
            "run_gates": list(report.run_gates),
        },
        "certificate": {
            "status": cert_status.value,
        },
        "watermark": watermark,
    }


def _gate1_dict(report: ConsequenceReport) -> dict[str, Any] | None:
    if report.gate1 is None:
        return None
    g = report.gate1
    return {
        "status": g.status.value,
        "plddt_mean": g.plddt_mean,
        "plddt_low_fraction": g.plddt_low_fraction,
        "delta_mfe": g.delta_mfe,
        "message": g.message,
    }


def _gate2_dict(report: ConsequenceReport) -> dict[str, Any] | None:
    if report.gate2 is None:
        return None
    g = report.gate2
    return {
        "status": g.status.value,
        "blast_hits": g.blast_hits,
        "toxin_probability": g.toxin_probability,
        "allergen_probability": g.allergen_probability,
        "message": g.message,
    }


def _gate3_dict(report: ConsequenceReport) -> dict[str, Any] | None:
    if report.gate3 is None:
        return None
    g = report.gate3
    return {
        "status": g.status.value,
        "pathogen_hits": g.pathogen_hits,
        "hgt_score": g.hgt_score,
        "escape_probability": g.escape_probability,
        "message": g.message,
    }

# ---------------------------------------------------------------------------
# Golden-file helpers
# ---------------------------------------------------------------------------

def _golden_path(entry: dict[str, Any]) -> Path:
    return GOLDEN_DIR / f"{entry['seq_id']}_{entry['fasta'].split('_', 1)[1].replace('.fasta', '')}.json"


def _compare(actual: dict[str, Any], golden: dict[str, Any]) -> list[str]:
    """Return list of diff strings; empty list means exact match."""
    diffs: list[str] = []
    _diff_recursive(actual, golden, "", diffs)
    return diffs


def _diff_recursive(actual: Any, golden: Any, path: str, diffs: list[str]) -> None:
    if isinstance(golden, dict) and isinstance(actual, dict):
        for key in golden:
            child = f"{path}.{key}" if path else key
            if key not in actual:
                diffs.append(f"  MISSING key {child!r}")
            else:
                _diff_recursive(actual[key], golden[key], child, diffs)
        for key in actual:
            if key not in golden:
                diffs.append(f"  EXTRA key {path + '.' + key if path else key!r}")
    elif isinstance(golden, float) and isinstance(actual, float):
        # Compare floats to 6 decimal places
        if round(actual, 6) != round(golden, 6):
            diffs.append(f"  {path}: expected {golden!r}, got {actual!r}")
    else:
        if actual != golden:
            diffs.append(f"  {path}: expected {golden!r}, got {actual!r}")

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main(generate: bool, verbose: bool) -> int:
    GOLDEN_DIR.mkdir(exist_ok=True)

    passed = 0
    failed = 0

    print(f"\n{'─' * 70}")
    print(" TINSEL Demo — six-sequence pipeline verification")
    print(f"{'─' * 70}\n")

    for entry in MANIFEST:
        label = f"[{entry['seq_id']}] {entry['label']}"
        result = await run_sequence(entry)

        # ── Assertion check (always) ──────────────────────────────────────
        actual_overall = result["pipeline"]["overall_status"]
        actual_cert = result["certificate"]["status"]
        expected_overall = entry["expected_overall"].value
        expected_cert = entry["expected_cert"].value

        assertion_ok = (actual_overall == expected_overall) and (actual_cert == expected_cert)
        assertion_msg = ""
        if not assertion_ok:
            assertion_msg = (
                f" [expected overall={expected_overall!r} cert={expected_cert!r},"
                f" got overall={actual_overall!r} cert={actual_cert!r}]"
            )

        if generate:
            # Write / overwrite golden file
            golden_path = _golden_path(entry)
            golden_path.write_text(
                json.dumps(result, indent=2, ensure_ascii=False) + "\n"
            )
            tier = result["watermark"]["tier"] if result["watermark"] else "—"
            print(f"  GENERATED  {label}")
            print(f"             overall={actual_overall}  cert={actual_cert}  tier={tier}")
            if not assertion_ok:
                print(f"  ⚠ ASSERTION FAILED{assertion_msg}", file=sys.stderr)
                failed += 1
            else:
                passed += 1
        else:
            # Read golden file and compare
            golden_path = _golden_path(entry)
            if not golden_path.exists():
                print(f"  MISSING    {label}")
                print(f"             Golden file not found: {golden_path}")
                print(f"             Run with --generate to create golden files.")
                failed += 1
                continue

            golden = json.loads(golden_path.read_text())
            diffs = _compare(result, golden)

            if diffs or not assertion_ok:
                print(f"  FAIL       {label}")
                if not assertion_ok:
                    print(f"             Assertion:{assertion_msg}")
                if diffs:
                    print(f"             {len(diffs)} diff(s) from golden file:")
                    for d in diffs[:10 if not verbose else len(diffs)]:
                        print(f"             {d}")
                    if not verbose and len(diffs) > 10:
                        print(f"             ... and {len(diffs) - 10} more (use --verbose)")
                failed += 1
            else:
                tier = result["watermark"]["tier"] if result["watermark"] else "—"
                print(f"  PASS       {label}")
                print(
                    f"             overall={actual_overall}"
                    f"  cert={actual_cert}"
                    f"  tier={tier}"
                )
                passed += 1

    total = passed + failed
    print(f"\n{'─' * 70}")
    if generate:
        print(f" Generated {total} golden files ({failed} assertion failures)")
    else:
        print(f" {passed}/{total} sequences match golden files")
    print(f"{'─' * 70}\n")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TINSEL six-sequence demo")
    parser.add_argument(
        "--generate",
        action="store_true",
        help="(Re)generate golden JSON files from the current pipeline output",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show all diffs, not just the first 10",
    )
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args.generate, args.verbose)))
