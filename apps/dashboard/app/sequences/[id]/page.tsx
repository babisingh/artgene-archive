"use client";

import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApiKey } from "../../../lib/providers";
import type { Gate1Result, Gate2Result, Gate3Result, GateStatus } from "../../../lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(s: GateStatus) {
  return {
    pass: "#10b981",
    fail: "#ef4444",
    warn: "#f59e0b",
    skip: "#94a3b8",
  }[s];
}

function StatusBadge({ status }: { status: GateStatus }) {
  const cls = {
    pass: "badge-pass",
    fail: "badge-fail",
    warn: "badge-warn",
    skip: "badge-skip",
  }[status];
  return <span className={cls}>{status.toUpperCase()}</span>;
}

// ---------------------------------------------------------------------------
// pLDDT sparkline — bar chart for gate1 scores
// ---------------------------------------------------------------------------

function Gate1Chart({ gate1 }: { gate1: Gate1Result }) {
  const data = [
    { name: "pLDDT mean", value: gate1.plddt_mean ?? 0, max: 100 },
    {
      name: "Low fraction",
      value: Math.round((gate1.plddt_low_fraction ?? 0) * 100),
      max: 100,
    },
    { name: "ΔMFE", value: Math.abs(gate1.delta_mfe ?? 0), max: 10 },
  ];

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={30} />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            background: "var(--tooltip-bg, #1e293b)",
            border: "none",
            borderRadius: 6,
            color: "#f8fafc",
          }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={statusColor(gate1.status)}
              fillOpacity={0.8}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Gate accordion item
// ---------------------------------------------------------------------------

function GateItem({
  title,
  status,
  children,
}: {
  title: string;
  status: GateStatus;
  children: React.ReactNode;
}) {
  return (
    <Disclosure>
      {({ open }) => (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <DisclosureButton className="flex w-full items-center justify-between px-4 py-3 text-left bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            <div className="flex items-center gap-3">
              <StatusBadge status={status} />
              <span className="font-medium text-slate-900 dark:text-white">{title}</span>
            </div>
            <span className="text-slate-400 text-sm">{open ? "▲" : "▼"}</span>
          </DisclosureButton>
          <DisclosurePanel className="px-4 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700">
            {children}
          </DisclosurePanel>
        </div>
      )}
    </Disclosure>
  );
}

// ---------------------------------------------------------------------------
// Field row helper
// ---------------------------------------------------------------------------

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-slate-500 dark:text-slate-400 shrink-0 w-44">{label}</span>
      <span className="text-slate-900 dark:text-slate-100 font-mono break-all">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { client } = useApiKey();

  const { data: cert, isLoading, isError, error } = useQuery({
    queryKey: ["certificate", id],
    queryFn: () => client.getCertificate(id),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 dark:text-slate-400">
        Loading certificate…
      </div>
    );
  }

  if (isError || !cert) {
    return (
      <div className="card p-8 text-center">
        <p className="text-red-500 mb-4">
          {error instanceof Error ? error.message : "Certificate not found"}
        </p>
        <Link href="/sequences" className="btn-secondary">
          ← Back to registry
        </Link>
      </div>
    );
  }

  const report = cert.consequence_report;
  const overallStatus: GateStatus = report?.overall_status ?? "skip";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
        <Link href="/sequences" className="hover:text-blue-600 dark:hover:text-blue-400">
          Sequences
        </Link>
        <span>/</span>
        <span className="font-mono text-slate-900 dark:text-white">{cert.registry_id}</span>
      </nav>

      {/* Summary card */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {cert.registry_id}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Registered {new Date(cert.timestamp).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`badge ${
                cert.status === "CERTIFIED" ? "badge-pass" : "badge-fail"
              } text-sm px-3 py-1`}
            >
              {cert.status}
            </span>
            <span
              className={`badge text-sm px-3 py-1 ${
                {
                  FULL: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-400",
                  STANDARD: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400",
                  REDUCED: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400",
                  MINIMAL: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
                  REJECTED: "badge-fail",
                }[cert.tier] ?? "badge-skip"
              }`}
            >
              {cert.tier}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Owner" value={cert.owner_id} />
          <Field label="Ethics Code" value={cert.ethics_code} />
          <Field label="Sequence Type" value={cert.sequence_type.toUpperCase()} />
          <Field label="Host Organism" value={cert.host_organism} />
          {cert.chi_squared != null && (
            <Field label="χ² (watermark)" value={cert.chi_squared.toFixed(6)} />
          )}
          <Field
            label="Cert Hash (SHA3-512)"
            value={
              <span className="text-xs">{cert.certificate_hash.slice(0, 32)}…</span>
            }
          />
        </div>
      </div>

      {/* Consequence report */}
      {report ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Biosafety Gates
            </h2>
            <StatusBadge status={overallStatus} />
          </div>

          {/* Gate 1 — Structural */}
          {report.gate1 && (
            <GateItem title="Gate 1 — Structural Analysis" status={report.gate1.status}>
              <div className="space-y-3">
                {report.gate1.message && (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {report.gate1.message}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  {report.gate1.plddt_mean != null && (
                    <div className="card p-3 text-center">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {report.gate1.plddt_mean.toFixed(1)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        pLDDT mean
                      </div>
                    </div>
                  )}
                  {report.gate1.plddt_low_fraction != null && (
                    <div className="card p-3 text-center">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {(report.gate1.plddt_low_fraction * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Low confidence residues
                      </div>
                    </div>
                  )}
                  {report.gate1.delta_mfe != null && (
                    <div className="card p-3 text-center">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {report.gate1.delta_mfe.toFixed(2)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        ΔMFE (kcal/mol)
                      </div>
                    </div>
                  )}
                </div>
                <Gate1Chart gate1={report.gate1 as Gate1Result} />
              </div>
            </GateItem>
          )}

          {/* Gate 2 — Off-target */}
          {report.gate2 && (
            <GateItem title="Gate 2 — Off-Target Screening" status={report.gate2.status}>
              <div className="space-y-2">
                {report.gate2.message && (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {report.gate2.message}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  {report.gate2.blast_hits != null && (
                    <div className="card p-3 text-center">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {report.gate2.blast_hits}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        BLAST hits
                      </div>
                    </div>
                  )}
                  {report.gate2.toxin_probability != null && (
                    <div className="card p-3 text-center">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {(report.gate2.toxin_probability * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Toxin probability
                      </div>
                    </div>
                  )}
                  {report.gate2.allergen_probability != null && (
                    <div className="card p-3 text-center">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {(report.gate2.allergen_probability * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Allergen probability
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </GateItem>
          )}

          {/* Gate 3 — Ecological */}
          {report.gate3 && (
            <GateItem title="Gate 3 — Ecological Risk Assessment" status={report.gate3.status}>
              <div className="space-y-2">
                {report.gate3.message && (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {report.gate3.message}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  {report.gate3.pathogen_hits != null && (
                    <div className="card p-3 text-center">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {report.gate3.pathogen_hits}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Pathogen hits
                      </div>
                    </div>
                  )}
                  {report.gate3.hgt_score != null && (
                    <div className="card p-3 text-center">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {report.gate3.hgt_score.toFixed(1)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        HGT score
                      </div>
                    </div>
                  )}
                  {report.gate3.escape_probability != null && (
                    <div className="card p-3 text-center">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {(report.gate3.escape_probability * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Escape probability
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </GateItem>
          )}

          {/* Skipped gates note */}
          {report.skipped_gates.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gates {report.skipped_gates.join(", ")} were skipped (gate 1 fail-fast).
            </p>
          )}
        </div>
      ) : (
        <div className="card p-6 text-slate-500 dark:text-slate-400 text-sm">
          No biosafety report available.
        </div>
      )}

      <div className="pt-2">
        <Link href="/sequences" className="btn-secondary">
          ← Back to registry
        </Link>
      </div>
    </div>
  );
}
