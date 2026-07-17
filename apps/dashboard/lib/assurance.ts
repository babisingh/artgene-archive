/**
 * Honest trust-signal helpers.
 *
 * The backend reports a single `gate_mode` ("real" | "mock") for the whole
 * screen, but "real" only means production adapters were *invoked* — several
 * layers still fall back to heuristics or are not wired to their external
 * database (see the GATE-01..GATE-08 findings). Badging every "real" run as
 * fully LIVE overstates the assurance. Until the backend exposes a truthful
 * per-layer signal (GATE-08), we derive one client-side from the fields the
 * report already carries, so the UI can tell the truth about what actually ran.
 */

import type { ConsequenceReport } from "./api";

export type AssuranceLevel = "live" | "partial" | "mock" | "unknown";

export interface GateAssurance {
  level: AssuranceLevel;
  /** Short badge text, e.g. "● LIVE", "◐ PARTIAL", "○ MOCK". */
  label: string;
  /** One-sentence human explanation suitable for a caption. */
  detail: string;
  /** External screens/databases that genuinely executed. */
  ranLayers: string[];
  /** Layers that were heuristic, mock, or not run — the honesty caveats. */
  caveats: string[];
}

/**
 * Derive an honest assurance level from a consequence report.
 *
 * - "mock"    → gates ran in mock mode; no biosafety assurance at all.
 * - "partial" → production mode, but one or more layers were heuristic / not
 *               wired to their real external database.
 * - "live"    → production mode and every screened layer used its real method.
 * - "unknown" → no report available.
 */
export function gateAssurance(
  report: ConsequenceReport | null | undefined,
): GateAssurance {
  if (!report) {
    return {
      level: "unknown",
      label: "— NO DATA",
      detail: "No biosafety screening report is attached to this record.",
      ranLayers: [],
      caveats: [],
    };
  }

  const ranLayers: string[] = [];
  const caveats: string[] = [];

  // Gate 1 — structural (ESMFold). A degraded run reports null pLDDT + WARN.
  if (report.gate1) {
    if (report.gate1.plddt_mean !== null) {
      ranLayers.push("ESMFold structure prediction");
    } else if (report.gate1.status !== "skip") {
      caveats.push("ESMFold did not return a structure (Gate 1 degraded)");
    }
  }

  // Gate 2 — composition / off-target. The real value is in the sub-screens.
  if (report.gate2) {
    if (report.gate2.screening_method === "composition_heuristic_v1") {
      caveats.push("Gate 2 used a composition heuristic (no BLAST / pathogen DB)");
    }
    if (report.gate2.secureDNA_checked) {
      ranLayers.push("SecureDNA hazard screen");
    } else {
      caveats.push("SecureDNA hazard screen did not run");
    }
    if (report.gate2.ibbis_checked) {
      ranLayers.push("IBBIS commec HMM screen");
    } else {
      caveats.push("IBBIS commec HMM screen did not run");
    }
  }

  // Gate 4 — functional embedding similarity.
  if (report.gate4) {
    if (report.gate4.method === "esm2_cosine_v1") {
      ranLayers.push("ESM-2 embedding similarity");
    } else if (report.gate4.method === "mock_v1") {
      caveats.push("Gate 4 embedding screen ran in mock mode");
    } else {
      caveats.push("Gate 4 used a composition fingerprint (not ESM-2 embeddings)");
    }
  }

  if (report.gate_mode === "mock") {
    return {
      level: "mock",
      label: "○ MOCK",
      detail:
        "Biosafety gates ran in mock mode. This record carries no real " +
        "biosafety assurance — do not rely on it for regulatory or IP purposes.",
      ranLayers,
      caveats: caveats.length ? caveats : ["All gates were mocked"],
    };
  }

  if (caveats.length > 0) {
    return {
      level: "partial",
      label: "◐ PARTIAL",
      detail:
        "Production screening ran, but some layers used heuristics or were " +
        "not wired to their external database. Assurance is partial.",
      ranLayers,
      caveats,
    };
  }

  return {
    level: "live",
    label: "● LIVE",
    detail: "Production screening ran with every screened layer using its real method.",
    ranLayers,
    caveats,
  };
}

/**
 * Whether a certificate's post-quantum signature is a placeholder stub rather
 * than a real WOTS+ signature. When true the UI must not imply cryptographic
 * assurance ("signed", "anchored", "immutable ledger entry").
 */
export function isStubSignature(cert: { pq_is_stub: boolean }): boolean {
  return cert.pq_is_stub;
}
