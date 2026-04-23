"use client";

import Link from "next/link";
import type { ConsequenceReport, RegistrationResponse, WatermarkMetadata } from "../lib/api";
import { CodonBiasChart } from "./CodonBiasChart";

// ---------------------------------------------------------------------------
// Status/tier helpers
// ---------------------------------------------------------------------------

function CertBadge({ status }: { status: string }) {
  const cls =
    status === "CERTIFIED"
      ? "badge-pass text-sm px-3 py-1"
      : status === "CERTIFIED_WITH_WARNINGS"
      ? "badge-warn text-sm px-3 py-1"
      : "badge-fail text-sm px-3 py-1";
  const label = status === "CERTIFIED_WITH_WARNINGS" ? "CERTIFIED (WARNINGS)" : status;
  return <span className={cls}>{label}</span>;
}

function TierBadge({ tier }: { tier: string }) {
  const cls = {
    FULL: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-400",
    STANDARD: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400",
    REDUCED: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400",
    MINIMAL: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
    REJECTED: "badge-fail",
  }[tier] ?? "badge-skip";
  return <span className={`badge text-sm px-3 py-1 ${cls}`}>{tier}</span>;
}

function GateBadge({ label, status }: { label: string; status: string }) {
  const cls = {
    pass: "badge-pass",
    fail: "badge-fail",
    warn: "badge-warn",
    skip: "badge-skip",
  }[status] ?? "badge-skip";
  return (
    <div className={`flex items-center gap-1.5 text-xs ${cls} rounded-lg px-3 py-2`}>
      <span className="font-semibold">{label}</span>
      <span className="ml-auto font-mono">{status.toUpperCase()}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Consequence summary
// ---------------------------------------------------------------------------

function ConsequenceSummary({ report }: { report: ConsequenceReport }) {
  return (
    <div className="space-y-1.5">
      {report.gate1 && (
        <GateBadge label="Gate 1: Structural" status={report.gate1.status} />
      )}
      {report.gate2 && (
        <div className="space-y-1">
          <GateBadge label="Gate 2: Composition Heuristic Screen" status={report.gate2.status} />
          {report.gate2.screening_method === "composition_heuristic_v1" && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 pl-3">
              Heuristic screen only. Full BLAST pathogen database screening is in development (Phase 3).
            </p>
          )}
        </div>
      )}
      {report.gate3 && (
        <GateBadge label="Gate 3: Ecological" status={report.gate3.status} />
      )}
      {report.skipped_gates.length > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Gates {report.skipped_gates.join(", ")} skipped (Gate 1 fail-fast)
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gate failure detail with actionable guidance
// ---------------------------------------------------------------------------

const GATE_FIX_HINTS: Record<string, string> = {
  gate1_plddt: "Gate 1 (pLDDT) fails when ESMFold cannot predict a stable 3D fold. " +
    "Fix: (1) Use sequences ≥ 60 AA — short peptides rarely fold. " +
    "(2) Confirm the sequence is a natural or de-novo designed globular protein, not an intrinsically disordered region. " +
    "(3) Add folding-promoting flanking sequences or a stable domain.",
  gate1_low_fraction: "Gate 1 (disordered fraction) fails when ≥ 20% of residues have pLDDT < 50. " +
    "Fix: Remove or redesign low-complexity / repeat regions. Consider truncating to a structured domain.",
  gate2_kmer: "Gate 2 fails because the sequence matches a known toxin/antimicrobial peptide motif. " +
    "Fix: Identify the flagged region and redesign those residues. Avoid poly-lysine/arginine stretches and membrane-disrupting amphipathic helices.",
  gate2_toxin: "Gate 2 fails due to high cationic/amphipathic probability (elevated K+R content or aromatic pattern). " +
    "Fix: Reduce lysine (K) and arginine (R) density — aim for < 10% combined K+R. " +
    "Check for membrane-active peptide patterns if the sequence has alternating hydrophobic/charged residues.",
  gate2_allergen: "Gate 2 fails due to high allergen probability (hydrophobic-rich sequence). " +
    "Fix: Reduce the fraction of highly hydrophobic residues (I, L, V, A, F, W, Y, M). " +
    "Consider codon-level redesign to reduce hydrophobic clustering without changing function.",
  gate3_hgt: "Gate 3 fails because the sequence has a codon usage pattern or GC content atypical for the selected host, " +
    "suggesting possible horizontal gene transfer (HGT) origin. " +
    "Fix: (1) Verify you selected the correct host organism. " +
    "(2) Codon-optimize the sequence for the target expression system using a host-specific codon table. " +
    "(3) If GC content is extreme (< 30% or > 70%), redesign synonymous codons.",
};

function _gate1Hint(msg: string | null): string {
  if (!msg) return GATE_FIX_HINTS.gate1_plddt;
  if (msg.includes("low-confidence fraction") || msg.includes("disordered")) return GATE_FIX_HINTS.gate1_low_fraction;
  return GATE_FIX_HINTS.gate1_plddt;
}

function _gate2Hint(msg: string | null): string {
  if (!msg) return GATE_FIX_HINTS.gate2_toxin;
  if (msg.includes("k-mer") || msg.includes("motif")) return GATE_FIX_HINTS.gate2_kmer;
  if (msg.includes("allergen")) return GATE_FIX_HINTS.gate2_allergen;
  return GATE_FIX_HINTS.gate2_toxin;
}

function FailureDetail({ report }: { report: ConsequenceReport }) {
  const failGate =
    report.gate1?.status === "fail"
      ? { label: "Gate 1: Structural Analysis", msg: report.gate1.message, hint: _gate1Hint(report.gate1.message) }
      : report.gate2?.status === "fail"
        ? { label: "Gate 2: Composition Heuristic Screen", msg: report.gate2.message, hint: _gate2Hint(report.gate2.message) }
        : report.gate3?.status === "fail"
          ? { label: "Gate 3: Ecological Risk", msg: report.gate3.message, hint: GATE_FIX_HINTS.gate3_hgt }
          : null;

  if (!failGate) return null;

  return (
    <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <span className="text-red-500 text-lg mt-0.5">✗</span>
        <div>
          <div className="font-semibold text-red-700 dark:text-red-400 text-sm">
            {failGate.label} failed
          </div>
          {failGate.msg && (
            <p className="text-xs text-red-600 dark:text-red-300 mt-1">{failGate.msg}</p>
          )}
        </div>
      </div>
      <div className="rounded border border-red-300 dark:border-red-700 bg-white/60 dark:bg-slate-900/40 px-3 py-2.5">
        <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">How to fix:</p>
        <p className="text-xs text-red-600 dark:text-red-300 leading-relaxed">{failGate.hint}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Warn detail
// ---------------------------------------------------------------------------

function WarnDetail({ report }: { report: ConsequenceReport }) {
  const warnGates = [
    report.gate1?.status === "warn" && { label: "Gate 1", msg: report.gate1.message },
    report.gate2?.status === "warn" && { label: "Gate 2", msg: report.gate2.message },
    report.gate3?.status === "warn" && { label: "Gate 3", msg: report.gate3.message },
  ].filter(Boolean) as { label: string; msg: string | null }[];

  if (warnGates.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
      <div className="font-semibold text-amber-700 dark:text-amber-400 text-sm mb-1">
        ⚠ Escalated review required
      </div>
      {warnGates.map(({ label, msg }) => (
        <p key={label} className="text-xs text-amber-600 dark:text-amber-300 mt-1">
          {label}: {msg}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main card
// ---------------------------------------------------------------------------

interface CertificateCardProps {
  response: RegistrationResponse;
}

export function CertificateCard({ response }: CertificateCardProps) {
  const { status, registry_id, consequence_report, message } = response;
  const certified = status === "CERTIFIED" || status === "CERTIFIED_WITH_WARNINGS";
  const certWithWarnings = status === "CERTIFIED_WITH_WARNINGS";

  return (
    <div
      className={`card overflow-hidden border-2 ${
        certWithWarnings
          ? "border-amber-300 dark:border-amber-600"
          : certified
          ? "border-emerald-300 dark:border-emerald-700"
          : "border-red-300 dark:border-red-700"
      }`}
    >
      {/* Header */}
      <div
        className={`px-6 py-4 flex items-start justify-between ${
          certWithWarnings
            ? "bg-amber-50 dark:bg-amber-900/20"
            : certified
            ? "bg-emerald-50 dark:bg-emerald-900/20"
            : "bg-red-50 dark:bg-red-900/20"
        }`}
      >
        <div>
          {registry_id ? (
            <div className="font-mono text-xl font-bold text-slate-900 dark:text-white">
              {registry_id}
            </div>
          ) : (
            <div className="text-lg font-bold text-red-700 dark:text-red-400">
              Registration Rejected
            </div>
          )}
          {message && (
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{message}</p>
          )}
        </div>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <CertBadge status={status} />
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Stub crypto notice — shown on every CERTIFIED certificate until Phase 7 */}
        {certified && (
          <div className="rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <span className="font-semibold">Notice:</span> Post-quantum signatures (WOTS+ / LWE)
            are reserved for Phase 7 and are not yet active. Provenance fingerprinting is available
            via the Provenance Tracing tab on the sequence detail page. This certificate is not a
            legally binding instrument.
          </div>
        )}

        {/* Gate results */}
        {consequence_report && (
          <>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Biosafety Gates
              </h3>
              <ConsequenceSummary report={consequence_report} />
            </div>
            {consequence_report.gate_mode === "mock" && (
              <div className="rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-xs text-red-800 dark:text-red-300 leading-relaxed">
                <span className="font-semibold">Warning:</span> Biosafety gates ran in mock mode.
                This certificate carries no real biosafety assurance. Do not use for regulatory or
                IP purposes.
              </div>
            )}
            {!certified && <FailureDetail report={consequence_report} />}
            {certified && consequence_report.overall_status === "warn" && (
              <WarnDetail report={consequence_report} />
            )}
          </>
        )}

        {/* View full certificate link */}
        {registry_id && (
          <div className="pt-1 border-t border-slate-100 dark:border-slate-700">
            <Link
              href={`/sequences/${registry_id}`}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              View full certificate →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant with watermark data (for /sequences/[id] detail page)
// ---------------------------------------------------------------------------

export function CertificateCardWithChart({
  response,
  watermark,
}: CertificateCardProps & { watermark: WatermarkMetadata | null }) {
  return (
    <div className="space-y-4">
      <CertificateCard response={response} />
      {watermark && (
        <div className="card p-5">
          <CodonBiasChart watermark={watermark} />
        </div>
      )}
    </div>
  );
}
