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
import { CodonBiasChart } from "../../../components/CodonBiasChart";
import { useApiKey } from "../../../lib/providers";
import type {
  BlastHit,
  Gate1Result,
  Gate2Result,
  Gate3Result,
  GateStatus,
  WatermarkMetadata,
} from "../../../lib/api";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function statusColor(s: GateStatus) {
  return { pass: "#10b981", fail: "#ef4444", warn: "#f59e0b", skip: "#94a3b8" }[s];
}

function StatusBadge({ status }: { status: GateStatus }) {
  const cls = { pass: "badge-pass", fail: "badge-fail", warn: "badge-warn", skip: "badge-skip" }[status];
  return <span className={cls}>{status.toUpperCase()}</span>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-slate-500 dark:text-slate-400 shrink-0 w-44">{label}</span>
      <span className="text-slate-900 dark:text-slate-100 font-mono break-all">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gate accordion wrapper
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
    <Disclosure defaultOpen>
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
// Stat card — reusable metric tile
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="card p-3 text-center">
      <div className={`text-2xl font-bold ${color ?? "text-slate-900 dark:text-white"}`}>
        {value}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gate 1 — per-residue pLDDT strip chart
// ---------------------------------------------------------------------------

function PlddtResidueStrip({ scores }: { scores: number[] }) {
  const bucketSize = Math.max(1, Math.ceil(scores.length / 120));
  const bucketed: number[] = [];
  for (let i = 0; i < scores.length; i += bucketSize) {
    const slice = scores.slice(i, i + bucketSize);
    bucketed.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }

  function barColor(v: number) {
    if (v >= 90) return "#2563eb"; // blue — very high
    if (v >= 70) return "#06b6d4"; // cyan — confident
    if (v >= 50) return "#f59e0b"; // amber — low
    return "#ef4444";              // red — very low
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-2">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-blue-600 inline-block" /> ≥90 Very high
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-cyan-500 inline-block" /> 70–90 Confident
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> 50–70 Low
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> &lt;50 Very low
        </span>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart
          data={bucketed.map((v, i) => ({ i: i * bucketSize + 1, v }))}
          margin={{ top: 4, right: 4, bottom: 4, left: 24 }}
          barCategoryGap={1}
        >
          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={22} />
          <XAxis dataKey="i" tick={{ fontSize: 9 }} interval={Math.ceil(bucketed.length / 8)} />
          <Tooltip
            formatter={(v: number) => [`${v.toFixed(1)}`, "pLDDT"]}
            labelFormatter={(l) => `Residue ~${l}`}
            contentStyle={{ fontSize: 11, background: "#1e293b", border: "none", borderRadius: 6, color: "#f8fafc" }}
          />
          <Bar dataKey="v" radius={[2, 2, 0, 0]}>
            {bucketed.map((v, i) => (
              <Cell key={i} fill={barColor(v)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-400 text-right">{scores.length} residues total</p>
    </div>
  );
}

function Gate1Panel({ gate1 }: { gate1: Gate1Result }) {
  const ii = gate1.instability_index;
  const iiColor =
    ii == null ? "" : ii > 40 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="space-y-4">
      {gate1.message && (
        <p className="text-sm text-slate-600 dark:text-slate-300">{gate1.message}</p>
      )}

      {/* Core metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {gate1.plddt_mean != null && (
          <StatCard
            label="pLDDT mean"
            value={gate1.plddt_mean.toFixed(1)}
            sub="0–100; ≥70 = pass"
            color={gate1.plddt_mean >= 70 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}
          />
        )}
        {gate1.plddt_low_fraction != null && (
          <StatCard
            label="Low-confidence residues"
            value={`${(gate1.plddt_low_fraction * 100).toFixed(1)}%`}
            sub="pLDDT < 50; ≥20% = fail"
            color={gate1.plddt_low_fraction >= 0.2 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}
          />
        )}
        {gate1.sequence_length != null && (
          <StatCard label="Length" value={`${gate1.sequence_length} AA`} />
        )}
        {ii != null && (
          <StatCard
            label="Instability index"
            value={ii.toFixed(1)}
            sub=">40 = unstable"
            color={iiColor}
          />
        )}
      </div>

      {/* Per-residue pLDDT strip */}
      {gate1.plddt_per_residue && gate1.plddt_per_residue.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Per-residue pLDDT (ESMFold)
          </h4>
          <PlddtResidueStrip scores={gate1.plddt_per_residue} />
        </div>
      )}

      {/* Instability index explanation */}
      {ii != null && (
        <div className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-3">
          <strong>Instability index</strong> (Guruprasad 1990): &gt;40 predicts the protein
          will be unstable in vivo. Score is computed from dipeptide DIWV weights across the full sequence.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gate 2 — off-target / toxicity panel
// ---------------------------------------------------------------------------

function GaugeBar({ label, value, max = 1, failAt, warnAt, fmt }: {
  label: string;
  value: number;
  max?: number;
  failAt?: number;
  warnAt?: number;
  fmt?: (v: number) => string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const color =
    failAt != null && value >= failAt ? "bg-red-500" :
    warnAt != null && value >= warnAt ? "bg-amber-400" :
    "bg-emerald-500";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600 dark:text-slate-300">{label}</span>
        <span className="font-mono font-semibold text-slate-900 dark:text-white">
          {fmt ? fmt(value) : value.toFixed(3)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function AminoAcidCompositionChart({ comp }: { comp: Record<string, number> }) {
  const sorted = Object.entries(comp)
    .sort(([, a], [, b]) => b - a)
    .map(([aa, frac]) => ({ aa, pct: frac * 100 }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={sorted} margin={{ top: 4, right: 4, bottom: 4, left: 24 }}>
        <XAxis dataKey="aa" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} width={28} unit="%" />
        <Tooltip
          formatter={(v: number) => [`${v.toFixed(2)}%`, "Fraction"]}
          contentStyle={{ fontSize: 11, background: "#1e293b", border: "none", borderRadius: 6, color: "#f8fafc" }}
        />
        <Bar dataKey="pct" fill="#6366f1" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Gate2Panel({ gate2 }: { gate2: Gate2Result }) {
  return (
    <div className="space-y-4">
      {gate2.message && (
        <p className="text-sm text-slate-600 dark:text-slate-300">{gate2.message}</p>
      )}

      {/* Gauge bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-3">
          {gate2.toxin_probability != null && (
            <GaugeBar
              label="Toxin probability"
              value={gate2.toxin_probability}
              failAt={0.30}
              fmt={(v) => `${(v * 100).toFixed(1)}%`}
            />
          )}
          {gate2.allergen_probability != null && (
            <GaugeBar
              label="Allergen probability"
              value={gate2.allergen_probability}
              failAt={0.40}
              warnAt={0.30}
              fmt={(v) => `${(v * 100).toFixed(1)}%`}
            />
          )}
          {gate2.gravy_score != null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">GRAVY score</span>
                <span className={`font-mono font-semibold ${gate2.gravy_score > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {gate2.gravy_score > 0 ? "+" : ""}{gate2.gravy_score.toFixed(3)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 relative overflow-hidden">
                {/* Centre line at 50% */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-400/50" />
                <div
                  className={`h-full absolute ${gate2.gravy_score >= 0 ? "left-1/2 bg-amber-400" : "right-1/2 bg-blue-400"}`}
                  style={{ width: `${Math.min(50, Math.abs(gate2.gravy_score) * 11)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">Kyte-Doolittle; &gt;0 = hydrophobic</p>
            </div>
          )}
        </div>

        {/* Toxin k-mer hits */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Toxin motif matches ({gate2.blast_hits ?? 0})
          </h4>
          {gate2.blast_top_hits && gate2.blast_top_hits.length > 0 ? (
            <div className="space-y-1">
              {gate2.blast_top_hits.map((hit: BlastHit) => (
                <div
                  key={`${hit.motif}-${hit.position}`}
                  className="flex items-start gap-2 text-xs p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                >
                  <span className="font-mono text-red-700 dark:text-red-400 shrink-0">{hit.motif}</span>
                  <span className="text-slate-600 dark:text-slate-300 truncate">{hit.description}</span>
                  <span className="ml-auto font-mono text-slate-500 shrink-0">pos.{hit.position}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              No toxin motif matches detected
            </p>
          )}
        </div>
      </div>

      {/* Amino acid composition chart */}
      {gate2.amino_acid_composition && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Amino acid composition
          </h4>
          <AminoAcidCompositionChart comp={gate2.amino_acid_composition} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gate 3 — ecological / HGT panel
// ---------------------------------------------------------------------------

function HgtScoreGauge({ score }: { score: number }) {
  const pct = Math.min(100, score);
  const color = score >= 50 ? "bg-red-500" : score >= 25 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600 dark:text-slate-300">HGT risk score</span>
        <span className={`font-mono font-semibold ${score >= 50 ? "text-red-500" : score >= 25 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
          {score.toFixed(1)} / 100
        </span>
      </div>
      <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>Safe</span>
        <span className="text-amber-500">Warn</span>
        <span className="text-red-500">Fail ≥50</span>
      </div>
    </div>
  );
}

function Gate3Panel({ gate3 }: { gate3: Gate3Result }) {
  const cai = gate3.codon_adaptation_index;
  const gc = gate3.gc_content;

  return (
    <div className="space-y-4">
      {gate3.message && (
        <p className="text-sm text-slate-600 dark:text-slate-300">{gate3.message}</p>
      )}

      {/* Core metric grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {gate3.pathogen_hits != null && (
          <StatCard
            label="Pathogen hits"
            value={String(gate3.pathogen_hits)}
            sub="0 = safe"
            color={gate3.pathogen_hits > 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}
          />
        )}
        {gc != null && (
          <StatCard
            label="GC content"
            value={`${(gc * 100).toFixed(1)}%`}
            sub="Typical 40–55%"
            color={gc < 0.30 || gc > 0.70 ? "text-amber-600 dark:text-amber-400" : undefined}
          />
        )}
        {cai != null && (
          <StatCard
            label="CAI vs host"
            value={cai.toFixed(3)}
            sub="0–1; ≥0.7 = well adapted"
            color={cai < 0.5 ? "text-red-500" : cai < 0.7 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}
          />
        )}
        {gate3.escape_probability != null && (
          <StatCard
            label="Escape probability"
            value={`${(gate3.escape_probability * 100).toFixed(1)}%`}
            sub="≥15% = warn"
            color={gate3.escape_probability >= 0.15 ? "text-amber-600 dark:text-amber-400" : undefined}
          />
        )}
      </div>

      {/* HGT score gauge */}
      {gate3.hgt_score != null && <HgtScoreGauge score={gate3.hgt_score} />}

      {/* Risk factors */}
      {gate3.hgt_risk_factors && gate3.hgt_risk_factors.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            HGT Risk Factors
          </h4>
          <ul className="space-y-1">
            {gate3.hgt_risk_factors.map((f, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
              >
                <span className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">⚠</span>
                <span className="text-slate-700 dark:text-slate-200">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CAI explanation */}
      {cai != null && (
        <div className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-3">
          <strong>Codon Adaptation Index (CAI)</strong>: Measures how well the coding sequence
          matches the host organism&apos;s preferred codon usage. Low CAI (&lt;0.5) indicates the
          sequence uses codons that are rare in the host, a classic signature of foreign DNA
          that may have been acquired by horizontal gene transfer.
        </div>
      )}
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
  const { client, apiKey } = useApiKey();

  const { data: cert, isLoading, isError, error } = useQuery({
    queryKey: ["certificate", id],
    queryFn: () => client.getCertificate(id),
    enabled: Boolean(id && apiKey),
  });

  if (!apiKey) {
    return (
      <div className="card p-8 text-center text-amber-600 dark:text-amber-400 text-sm">
        ⚠ No API key set — click <strong>Set API Key</strong> in the navigation bar.
      </div>
    );
  }

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
            <span className={`badge ${cert.status === "CERTIFIED" ? "badge-pass" : "badge-fail"} text-sm px-3 py-1`}>
              {cert.status}
            </span>
            <span
              className={`badge text-sm px-3 py-1 ${{
                FULL: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-400",
                STANDARD: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400",
                REDUCED: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400",
                MINIMAL: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
                REJECTED: "badge-fail",
              }[cert.tier] ?? "badge-skip"}`}
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
            value={<span className="text-xs">{cert.certificate_hash.slice(0, 32)}…</span>}
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

          {report.gate1 && (
            <GateItem title="Gate 1: Structural Analysis (ESMFold pLDDT)" status={report.gate1.status}>
              <Gate1Panel gate1={report.gate1 as Gate1Result} />
            </GateItem>
          )}

          {report.gate2 && (
            <GateItem title="Gate 2: Off-Target Screening (Toxin / Allergen)" status={report.gate2.status}>
              <Gate2Panel gate2={report.gate2 as Gate2Result} />
            </GateItem>
          )}

          {report.gate3 && (
            <GateItem title="Gate 3: Ecological Risk (HGT / Codon Adaptation)" status={report.gate3.status}>
              <Gate3Panel gate3={report.gate3 as Gate3Result} />
            </GateItem>
          )}

          {report.skipped_gates.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gates {report.skipped_gates.join(", ")} were skipped (Gate 1 fail-fast).
            </p>
          )}
        </div>
      ) : (
        <div className="card p-6 text-slate-500 dark:text-slate-400 text-sm">
          No biosafety report available.
        </div>
      )}

      {/* Watermark codon bias */}
      {cert.watermark_metadata && (
        <div className="card p-6">
          <CodonBiasChart watermark={cert.watermark_metadata as WatermarkMetadata} />
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
