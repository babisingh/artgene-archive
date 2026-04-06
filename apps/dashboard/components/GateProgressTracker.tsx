"use client";

import type { ConsequenceReport, GateStatus } from "../lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RunPhase =
  | "idle"
  | "gate1"
  | "gates23"
  | "done";

interface GateStepProps {
  number: number | string;
  label: string;
  sublabel?: string;
  status: "pending" | "running" | GateStatus;
}

// ---------------------------------------------------------------------------
// Single step indicator
// ---------------------------------------------------------------------------

function StepIcon({ status }: { status: GateStepProps["status"] }) {
  if (status === "running") {
    return (
      <span className="flex h-7 w-7 items-center justify-center">
        <svg
          className="animate-spin h-5 w-5 text-blue-500"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4l3-3-3-3V4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"
          />
        </svg>
      </span>
    );
  }
  if (status === "pass" || status === "warn") {
    const color = status === "pass" ? "text-emerald-500" : "text-amber-500";
    return (
      <span className={`flex h-7 w-7 items-center justify-center text-lg ${color}`}>
        {status === "pass" ? "✓" : "⚠"}
      </span>
    );
  }
  if (status === "fail") {
    return (
      <span className="flex h-7 w-7 items-center justify-center text-lg text-red-500">
        ✗
      </span>
    );
  }
  if (status === "skip") {
    return (
      <span className="flex h-7 w-7 items-center justify-center text-lg text-slate-400">
        –
      </span>
    );
  }
  // pending
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-300 dark:border-slate-600 text-xs font-medium text-slate-400" />
  );
}

function GateStep({ number, label, sublabel, status }: GateStepProps) {
  const active = status === "running";
  const done = status !== "pending" && status !== "running";

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
        active
          ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
          : done
            ? "bg-slate-50 dark:bg-slate-800/50"
            : "opacity-50"
      }`}
    >
      <StepIcon status={status} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Gate {number}
          </span>
          {status !== "pending" && status !== "running" && (
            <span
              className={`badge text-xs ${
                status === "pass"
                  ? "badge-pass"
                  : status === "fail"
                    ? "badge-fail"
                    : status === "warn"
                      ? "badge-warn"
                      : "badge-skip"
              }`}
            >
              {status.toUpperCase()}
            </span>
          )}
          {status === "running" && (
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
              Running…
            </span>
          )}
        </div>
        <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
          {label}
        </div>
        {sublabel && (
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main tracker
// ---------------------------------------------------------------------------

interface GateProgressTrackerProps {
  phase: RunPhase;
  report: ConsequenceReport | null;
}

export function GateProgressTracker({ phase, report }: GateProgressTrackerProps) {
  function g1Status(): GateStepProps["status"] {
    if (phase === "idle") return "pending";
    if (phase === "gate1") return "running";
    return report?.gate1?.status ?? "pending";
  }

  function g2Status(): GateStepProps["status"] {
    if (phase === "idle" || phase === "gate1") return "pending";
    if (phase === "gates23") return "running";
    if (report?.skipped_gates?.includes(2)) return "skip";
    return report?.gate2?.status ?? "pending";
  }

  function g3Status(): GateStepProps["status"] {
    if (phase === "idle" || phase === "gate1") return "pending";
    if (phase === "gates23") return "running";
    if (report?.skipped_gates?.includes(3)) return "skip";
    return report?.gate3?.status ?? "pending";
  }

  return (
    <div className="space-y-2">
      <GateStep
        number={1}
        label="Structural Analysis"
        sublabel="ESMFold pLDDT · LinearFold ΔMFE"
        status={g1Status()}
      />
      <GateStep
        number="2 + 3"
        label="Off-Target & Ecological"
        sublabel="BLAST · ToxinPred2 · AllerTop · HGT · DriftRadar"
        status={
          // Show the worse of gate 2/3 if done
          phase === "done" && report
            ? ([g2Status(), g3Status()] as GateStepProps["status"][]).reduce(
                (worst, cur) => {
                  const rank: Record<string, number> = {
                    skip: 0, pending: 0, pass: 1, warn: 2, fail: 3, running: 1,
                  };
                  return (rank[cur] ?? 0) > (rank[worst] ?? 0) ? cur : worst;
                },
                "pass" as GateStepProps["status"]
              )
            : g2Status() === "running" || g3Status() === "running"
              ? "running"
              : g2Status() === "pending"
                ? "pending"
                : "pass"
        }
      />
    </div>
  );
}
