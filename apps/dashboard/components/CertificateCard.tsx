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
      : "badge-fail text-sm px-3 py-1";
  return <span className={cls}>{status}</span>;
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
// Gate failure detail
// ---------------------------------------------------------------------------

function FailureDetail({ report }: { report: ConsequenceReport }) {
  const failGate =
    report.gate1?.status === "fail"
      ? { label: "Gate 1: Structural Analysis", msg: report.gate1.message }
      : report.gate2?.status === "fail"
        ? { label: "Gate 2: Composition Heuristic Screen", msg: report.gate2.message }
        : report.gate3?.status === "fail"
          ? { label: "Gate 3: Ecological Risk", msg: report.gate3.message }
          : null;

  if (!failGate) return null;

  return (
    <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
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
  const { status, registry_id, tier, chi_squared, consequence_report, message } = response;

  // Extract watermark metadata from the consequence_report context
  // Note: RegistrationResponse doesn't return full watermark_metadata directly,
  // but we get tier + chi_squared. We show the gate-level data instead.
  const certified = status === "CERTIFIED";

  return (
    <div
      className={`card overflow-hidden border-2 ${
        certified
          ? "border-emerald-300 dark:border-emerald-700"
          : "border-red-300 dark:border-red-700"
      }`}
    >
      {/* Header */}
      <div
        className={`px-6 py-4 flex items-start justify-between ${
          certified
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
          {tier && <TierBadge tier={tier} />}
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Stub crypto notice — shown on every CERTIFIED certificate until Phase 7 */}
        {certified && (
          <div className="rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <span className="font-semibold">Notice:</span> Post-quantum signatures (WOTS+ / LWE)
            are reserved for Phase 7 and are not yet active. This certificate provides
            HMAC-SHA3-256 codon-watermark provenance only. It is not a legally binding instrument.
          </div>
        )}

        {/* Chi-squared + carrier info row */}
        {certified && chi_squared != null && (
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-slate-500 dark:text-slate-400">χ² </span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {chi_squared.toFixed(6)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Watermark tier </span>
              <span className="font-semibold text-slate-900 dark:text-white">{tier}</span>
            </div>
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
