"use client";

import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import React, { use, useState } from "react";
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
import { CertSeal } from "../../../components/design/CertSeal";
import { CodonGrid } from "../../../components/design/CodonGrid";
import type {
  ApiClient,
  BlastHit,
  Certificate,
  ComplianceManifest,
  DatabaseQueried,
  DistributionSummary,
  Gate1Result,
  Gate2Result,
  Gate3Result,
  Gate4Hit,
  Gate4Result,
  GateStatus,
  IBBISHit,
  IssueDistributionRequest,
  SecureDNAHit,
  SynthesisAuthDocument,
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

// ---------------------------------------------------------------------------
// Gate 2 — databases queried summary strip
// ---------------------------------------------------------------------------

function DbStatusPill({ db }: { db: DatabaseQueried }) {
  const color =
    db.status === "fail" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-700" :
    db.status === "warn" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-700" :
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700";
  const icon = db.status === "fail" ? "✗" : db.status === "warn" ? "⚠" : "✓";
  return (
    <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border ${color}`}>
      <span className="font-bold">{icon}</span>
      <span className="font-medium">{db.name}</span>
      {db.version && <span className="opacity-60">v{db.version}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gate 2 — SecureDNA DOPRF panel
// ---------------------------------------------------------------------------

function SecureDNAPanel({ gate2 }: { gate2: Gate2Result }) {
  if (!gate2.secureDNA_checked) return null;
  const status = gate2.secureDNA_status;
  const hits = gate2.secureDNA_hits ?? [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          SecureDNA DOPRF
        </h4>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>{gate2.secureDNA_windows_screened} × 30-bp windows</span>
          {status && <StatusBadge status={status} />}
        </div>
      </div>

      {hits.length > 0 ? (
        <div className="space-y-1">
          {hits.map((h: SecureDNAHit, i: number) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
            >
              <span className="font-bold text-red-600 dark:text-red-400 shrink-0">HAZARD</span>
              <span className="text-slate-700 dark:text-slate-200 flex-1">{h.hazard_label}</span>
              <span className="font-mono text-slate-400 shrink-0">pos.{h.position}</span>
              <span className="font-mono text-slate-400 shrink-0 text-[10px]">token:{h.doprf_token}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          No hazardous 30-mer windows detected across {gate2.secureDNA_windows_screened} windows
        </p>
      )}

      <p className="text-xs text-slate-400">
        Cryptographic DOPRF protocol — query sequence is never revealed to the hazard database server.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gate 2 — IBBIS commec HMM panel
// ---------------------------------------------------------------------------

function IBBISPanel({ gate2 }: { gate2: Gate2Result }) {
  if (!gate2.ibbis_checked) return null;
  const status = gate2.ibbis_status;
  const hits = gate2.ibbis_hits ?? [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          IBBIS commec HMM Profiles
        </h4>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>{gate2.ibbis_families_screened} families</span>
          {status && <StatusBadge status={status} />}
        </div>
      </div>

      {gate2.ibbis_families_screened === 0 ? (
        <p className="text-xs text-slate-400 italic">
          Sequence too short for HMM scoring (&lt;50 AA / 150 bp minimum)
        </p>
      ) : hits.length > 0 ? (
        <div className="space-y-1">
          {hits.map((h: IBBISHit, i: number) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
            >
              <div className="flex-1 space-y-0.5">
                <div className="font-medium text-red-700 dark:text-red-400">{h.family_name}</div>
                <div className="text-slate-500 dark:text-slate-400">
                  {h.hmm_accession} · E-value: {h.evalue.toExponential(1)} · sig: <span className="font-mono">{h.matched_signature}</span>
                </div>
              </div>
              <span className="font-mono text-slate-400 shrink-0">pos.{h.hit_position}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          No dangerous protein family homology detected across {gate2.ibbis_families_screened} HMM profiles
        </p>
      )}

      <p className="text-xs text-slate-400">
        HMM profile search detects functional homology to dangerous protein families — catches AI-designed
        variants that evade sequence-based screening.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gate 2 — main panel (composition + SecureDNA + IBBIS)
// ---------------------------------------------------------------------------

function Gate2Panel({ gate2 }: { gate2: Gate2Result }) {
  const isChained = gate2.screening_method === "chained_v1";

  return (
    <div className="space-y-5">
      {/* Databases queried strip */}
      {isChained && gate2.databases_queried && gate2.databases_queried.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Databases Queried
          </h4>
          <div className="flex flex-wrap gap-2">
            {gate2.databases_queried.map((db: DatabaseQueried, i: number) => (
              <DbStatusPill key={i} db={db} />
            ))}
          </div>
        </div>
      )}

      {/* Composition layer */}
      <div className="space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Composition Heuristic
        </h4>

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
      </div>

      {/* SecureDNA layer */}
      {isChained && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
          <SecureDNAPanel gate2={gate2} />
        </div>
      )}

      {/* IBBIS layer */}
      {isChained && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
          <IBBISPanel gate2={gate2} />
        </div>
      )}

      {/* Amino acid composition chart */}
      {gate2.amino_acid_composition && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
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
// Gate 4 — functional analogue detection (embedding cosine similarity)
// ---------------------------------------------------------------------------

function SimilarityBar({
  value,
  thresholdFail,
  thresholdWarn,
}: {
  value: number;
  thresholdFail: number;
  thresholdWarn: number;
}) {
  const pct = Math.round(value * 100);
  const failPct = Math.round(thresholdFail * 100);
  const warnPct = Math.round(thresholdWarn * 100);
  const barColor =
    value >= thresholdFail ? "bg-red-500" :
    value >= thresholdWarn ? "bg-amber-400" :
    "bg-emerald-500";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600 dark:text-slate-300">Max cosine similarity</span>
        <span className={`font-mono font-bold ${value >= thresholdFail ? "text-red-500" : value >= thresholdWarn ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
          {value.toFixed(4)}
        </span>
      </div>
      <div className="relative h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        {/* Threshold markers */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-amber-500/70"
          style={{ left: `${warnPct}%` }}
          title={`WARN threshold: ${thresholdWarn}`}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500/70"
          style={{ left: `${failPct}%` }}
          title={`FAIL threshold: ${thresholdFail}`}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>0.0</span>
        <span className="text-amber-500">WARN ≥{thresholdWarn}</span>
        <span className="text-red-500">FAIL ≥{thresholdFail}</span>
        <span>1.0</span>
      </div>
    </div>
  );
}

function Gate4Panel({ gate4 }: { gate4: Gate4Result }) {
  const isProd = gate4.method === "esm2_cosine_v1";
  const maxSim = gate4.max_similarity ?? 0;

  return (
    <div className="space-y-5">
      {/* Method badge + note */}
      <div className="flex items-start gap-3">
        <span className={`text-xs px-2 py-1 rounded border font-mono shrink-0 ${isProd ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-700" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700"}`}>
          {gate4.method}
        </span>
        <div className="text-xs text-slate-500 dark:text-slate-400 flex-1">
          {gate4.note && <p className="italic">{gate4.note}</p>}
        </div>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="References screened"
          value={String(gate4.references_screened)}
          sub="dangerous families"
        />
        <StatCard
          label="Embedding dimensions"
          value={String(gate4.query_dimensions)}
          sub={isProd ? "ESM-2 mean-pool" : "AA + dipeptide"}
        />
        <StatCard
          label="Max similarity"
          value={maxSim.toFixed(4)}
          sub={`FAIL ≥ ${gate4.threshold_fail}`}
          color={
            maxSim >= gate4.threshold_fail ? "text-red-500" :
            maxSim >= gate4.threshold_warn ? "text-amber-600 dark:text-amber-400" :
            "text-emerald-600 dark:text-emerald-400"
          }
        />
      </div>

      {/* Cosine similarity gauge with threshold markers */}
      <SimilarityBar
        value={maxSim}
        thresholdFail={gate4.threshold_fail}
        thresholdWarn={gate4.threshold_warn}
      />

      {/* Per-family similarity table */}
      {gate4.top_hits.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Reference Family Similarity Scores
          </h4>
          <div className="space-y-2">
            {gate4.top_hits.map((hit: Gate4Hit, i: number) => {
              const hitColor =
                hit.status === "fail" ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20" :
                hit.status === "warn" ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20" :
                "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800";
              const simColor =
                hit.status === "fail" ? "text-red-600 dark:text-red-400" :
                hit.status === "warn" ? "text-amber-600 dark:text-amber-400" :
                "text-emerald-600 dark:text-emerald-400";

              return (
                <div key={i} className={`flex items-center gap-3 p-2.5 rounded border text-xs ${hitColor}`}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 dark:text-slate-200 truncate">{hit.family}</div>
                    <div className="text-slate-500 dark:text-slate-400">{hit.organism} · {hit.category}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-mono font-bold text-sm ${simColor}`}>{hit.similarity.toFixed(4)}</div>
                    <div className="text-slate-400 text-[10px]">UniProt: {hit.uniprot}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scientific context */}
      <div className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-3 space-y-1">
        <p>
          <strong>Gate 4</strong> detects AI-designed protein variants that retain dangerous biological function
          but have diverged from known sequences (the Microsoft/Science 2025 challenge). It operates in
          embedding space — not sequence space — so it catches variants that evade Gates 1–3.
        </p>
        <p>
          Cosine similarity ≥ <span className="text-red-500 font-mono">{gate4.threshold_fail}</span> → FAIL &nbsp;|&nbsp;
          ≥ <span className="text-amber-500 font-mono">{gate4.threshold_warn}</span> → WARN &nbsp;|&nbsp;
          &lt; <span className="text-emerald-500 font-mono">{gate4.threshold_warn}</span> → PASS
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compliance tab — pretty JSON viewer + framework selector + downloads
// ---------------------------------------------------------------------------

function _syntaxHighlight(json: string): string {
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            return `<span class="text-slate-600 dark:text-slate-300 font-semibold">${match}</span>`;
          }
          return `<span class="text-emerald-700 dark:text-emerald-400">${match}</span>`;
        }
        if (/true|false/.test(match)) {
          return `<span class="text-purple-600 dark:text-purple-400">${match}</span>`;
        }
        if (/null/.test(match)) {
          return `<span class="text-slate-400">${match}</span>`;
        }
        return `<span class="text-blue-600 dark:text-blue-400">${match}</span>`;
      }
    );
}

function ComplianceTab({ id, client }: { id: string; client: ApiClient }) {
  const [frameworks, setFrameworks] = useState<"both" | "US_DURC" | "EU_DUAL_USE">("both");
  const fwParam = frameworks === "both" ? "US_DURC,EU_DUAL_USE" : frameworks;

  const { data: manifest, isLoading, isError, error } = useQuery({
    queryKey: ["compliance", id, fwParam],
    queryFn: () => client.getCompliance(id, fwParam),
  });

  function downloadFile(ext: "json" | "txt") {
    if (!manifest) return;
    const content = JSON.stringify(manifest, null, 2);
    const blob = new Blob([content], {
      type: ext === "json" ? "application/json" : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${id}-compliance.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <div className="card p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
        Loading compliance manifest…
      </div>
    );
  }
  if (isError || !manifest) {
    return (
      <div className="card p-6 text-red-500 dark:text-red-400 text-sm">
        {error instanceof Error ? error.message : "Failed to load compliance manifest"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Framework selector */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-500 dark:text-slate-400 shrink-0">Framework:</span>
        <div className="flex gap-1.5 flex-wrap">
          {(["both", "US_DURC", "EU_DUAL_USE"] as const).map((fw) => (
            <button
              key={fw}
              onClick={() => setFrameworks(fw)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                frameworks === fw
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {fw === "both" ? "Both frameworks" : fw}
            </button>
          ))}
        </div>
      </div>

      {/* Attestation status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {manifest.framework_attestations.map((att) => {
          const passed =
            (att.fields.screening_passed as boolean | undefined) ??
            (att.fields.approved_for_synthesis as boolean | undefined) ??
            false;
          return (
            <div key={att.framework} className="card p-3 text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400">{att.framework}</div>
              <div className="text-xs font-mono mt-1 text-slate-500 dark:text-slate-400">
                {att.version}
              </div>
              <div
                className={`text-sm font-bold mt-2 ${
                  passed
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-500 dark:text-red-400"
                }`}
              >
                {passed ? "ATTESTED" : "REJECTED"}
              </div>
            </div>
          );
        })}
        <div className="card p-3 text-center">
          <div className="text-xs text-slate-500 dark:text-slate-400">Databases Screened</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {manifest.databases_queried.length}
          </div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-xs text-slate-500 dark:text-slate-400">PQ Signing</div>
          <div
            className={`text-xs font-mono mt-2 font-medium ${
              manifest.wots_is_stub
                ? "text-slate-400 dark:text-slate-500"
                : "text-teal-600 dark:text-teal-400"
            }`}
          >
            {manifest.wots_is_stub ? "stub" : "WOTS+"}
          </div>
        </div>
      </div>

      {/* Regulatory notice */}
      <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 p-3 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
        ⚠ {manifest.regulatory_notice}
      </div>

      {/* Download buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => downloadFile("json")}
          className="btn-secondary text-sm flex items-center gap-1.5"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download .json
        </button>
        <button
          onClick={() => downloadFile("txt")}
          className="btn-secondary text-sm flex items-center gap-1.5"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download .txt
        </button>
      </div>

      {/* Pretty JSON viewer */}
      <div>
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
          Full manifest
        </div>
        <pre
          className="text-xs font-mono overflow-auto max-h-[560px] p-4 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700 leading-relaxed"
          // Safe: content is API-returned JSON serialised by us; HTML is escaped before highlighting
          dangerouslySetInnerHTML={{
            __html: _syntaxHighlight(JSON.stringify(manifest, null, 2)),
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provenance Tracing tab — issue per-recipient fingerprinted copies
// ---------------------------------------------------------------------------

const PURPOSE_LABELS: Record<string, string> = {
  cmo: "CMO Production",
  collaboration: "Research Collaboration",
  validation: "Independent Validation",
  other: "Other",
};

function DistributeModal({
  sequenceId,
  client,
  onClose,
  onIssued,
}: {
  sequenceId: string;
  client: ApiClient;
  onClose: () => void;
  onIssued: () => void;
}) {
  const [form, setForm] = useState<IssueDistributionRequest>({
    recipient_name: "",
    recipient_org: "",
    recipient_email: "",
    purpose: "other",
    host_organism: "ECOLI",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const blob = await client.issueDistribution(sequenceId, form);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sequenceId}-provenance-copy.fasta`;
      a.click();
      URL.revokeObjectURL(url);
      onIssued();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to issue copy");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Issue Distribution Copy</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Each recipient gets a unique codon fingerprint embedded in their FASTA copy.
          If the copy leaks, use <strong>Verify Source</strong> to identify the recipient.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="recip-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Recipient Name *
            </label>
            <input
              id="recip-name"
              required
              value={form.recipient_name}
              onChange={e => setForm(f => ({ ...f, recipient_name: e.target.value }))}
              className="input w-full"
              placeholder="Dr. Jane Smith"
            />
          </div>
          <div>
            <label htmlFor="recip-org" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Organisation *
            </label>
            <input
              id="recip-org"
              required
              value={form.recipient_org}
              onChange={e => setForm(f => ({ ...f, recipient_org: e.target.value }))}
              className="input w-full"
              placeholder="BioFactory GmbH"
            />
          </div>
          <div>
            <label htmlFor="recip-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email (optional)
            </label>
            <input
              id="recip-email"
              type="email"
              value={form.recipient_email ?? ""}
              onChange={e => setForm(f => ({ ...f, recipient_email: e.target.value }))}
              className="input w-full"
              placeholder="recipient@example.com"
            />
          </div>
          <div>
            <label htmlFor="recip-purpose" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Purpose
            </label>
            <select
              id="recip-purpose"
              value={form.purpose}
              onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
              className="input w-full"
            >
              <option value="cmo">CMO Production</option>
              <option value="collaboration">Research Collaboration</option>
              <option value="validation">Independent Validation</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="recip-host" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Host Organism (for codon optimisation)
            </label>
            <select
              id="recip-host"
              value={form.host_organism}
              onChange={e => setForm(f => ({ ...f, host_organism: e.target.value }))}
              className="input w-full"
            >
              {["ECOLI", "HUMAN", "YEAST", "CHO", "INSECT", "PLANT"].map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-red-500" role="alert">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={busy} aria-busy={busy} className="btn-primary flex-1">
              {busy ? "Generating…" : "Generate & Download"}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DistributionSection({
  sequenceId,
  client,
  showModal,
  onOpenModal,
  onCloseModal,
}: {
  sequenceId: string;
  client: ApiClient;
  showModal: boolean;
  onOpenModal: () => void;
  onCloseModal: () => void;
}) {
  const [refetchKey, setRefetchKey] = useState(0);
  const { data: distributions, isLoading } = useQuery({
    queryKey: ["distributions", sequenceId, refetchKey],
    queryFn: () => client.listDistributions(sequenceId),
  });

  function handleIssued() {
    setRefetchKey(k => k + 1);
  }

  return (
    <div className="space-y-4">
      {showModal && (
        <DistributeModal
          sequenceId={sequenceId}
          client={client}
          onClose={onCloseModal}
          onIssued={handleIssued}
        />
      )}

      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Distribution Copies</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Each copy has a unique codon fingerprint. If a copy leaks, paste it on the{" "}
              <a href="/verify" className="text-blue-600 dark:text-blue-400 underline">Verify Source</a>{" "}
              page to identify the recipient.
            </p>
          </div>
          <button onClick={onOpenModal} className="btn-primary text-sm shrink-0">
            Issue Copy
          </button>
        </div>

        {isLoading && (
          <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>
        )}
        {!isLoading && (!distributions || distributions.length === 0) && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No copies issued yet. Click <strong>Issue Copy</strong> to generate the first fingerprinted copy.
          </p>
        )}
        {distributions && distributions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 pr-4 font-medium text-slate-600 dark:text-slate-400">Recipient</th>
                  <th className="text-left py-2 pr-4 font-medium text-slate-600 dark:text-slate-400">Organisation</th>
                  <th className="text-left py-2 pr-4 font-medium text-slate-600 dark:text-slate-400">Purpose</th>
                  <th className="text-left py-2 pr-4 font-medium text-slate-600 dark:text-slate-400">Issued</th>
                  <th className="text-left py-2 font-medium text-slate-600 dark:text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {distributions.map((d: DistributionSummary) => (
                  <tr key={d.id}>
                    <td className="py-2 pr-4 text-slate-900 dark:text-slate-100">{d.recipient_name}</td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-400">{d.recipient_org}</td>
                    <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">
                      {PURPOSE_LABELS[d.purpose] ?? d.purpose}
                    </td>
                    <td className="py-2 pr-4 text-slate-500 dark:text-slate-400 font-mono text-xs">
                      {new Date(d.issued_at).toLocaleDateString()}
                    </td>
                    <td className="py-2">
                      {d.revoked_at ? (
                        <span className="badge-fail text-xs">Revoked</span>
                      ) : (
                        <span className="badge-pass text-xs">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provenance & Watermark tab — 3c-5: watermark visual + distribution section
// ---------------------------------------------------------------------------

function ProvenanceTab({
  cert,
  sequenceId,
  client,
  showModal,
  onOpenModal,
  onCloseModal,
}: {
  cert: Certificate;
  sequenceId: string;
  client: ApiClient;
  showModal: boolean;
  onOpenModal: () => void;
  onCloseModal: () => void;
}) {
  const [copiedJson, setCopiedJson] = useState(false);
  const wm = cert.watermark_metadata;

  const highlights = wm?.anchor_map?.carrier_indices ?? null;

  // Build a minimal 2-event chain from cert timestamps
  const custodyEvents = [
    {
      t: "Deposited",
      when: new Date(cert.timestamp).toISOString().slice(0, 16).replace("T", " ") + " UTC",
      who: cert.owner_id,
      detail: `Full metadata submitted. Host: ${cert.host_organism}. Ethics: ${cert.ethics_code}.`,
      highlight: false,
    },
    {
      t: "Certified",
      when: new Date(cert.timestamp).toISOString().slice(0, 16).replace("T", " ") + " UTC",
      who: "ArtGene automated pipeline",
      detail: `Certificate hash ${cert.certificate_hash.slice(0, 16)}… anchored. Tier ${cert.tier}.`,
      highlight: true,
    },
  ];

  const certJson = JSON.stringify({
    accession:    cert.registry_id,
    version:      "1.0",
    hash_sha3_512: cert.certificate_hash.slice(0, 16) + "…",
    pq_algorithm: cert.pq_algorithm,
    pq_is_stub:   cert.pq_is_stub,
    issued_by:    "artgene-archive.org",
    issued_at:    cert.timestamp,
    depositor:    { id: cert.owner_id, org: cert.org_id || "—" },
    biosafety: {
      tier:   cert.tier,
      status: cert.status,
    },
    watermark: wm
      ? {
          id:               wm.watermark_id,
          carrier_positions: wm.carrier_positions,
          signature_hex:    wm.signature_hex,
        }
      : null,
  }, null, 2);

  function handleCopyJson() {
    navigator.clipboard.writeText(certJson);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 1800);
  }

  return (
    <div className="grid-12" style={{ gap: 48 }}>

      {/* ── Left column ── */}
      <div style={{ gridColumn: "span 7" }}>

        {/* Watermark fingerprint */}
        <div className="eyebrow mb-16">§ Watermark fingerprint</div>
        {wm ? (
          <div
            style={{
              background: "var(--paper-2)",
              border: "0.5px solid var(--rule)",
              borderRadius: 6,
              padding: 28,
              marginBottom: 28,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {(wm.config?.sig_bytes ?? 16) * 8}-bit signature · {cert.org_id || cert.owner_id}
              </div>
              <span className="badge badge-verify badge-dot">Watermark present</span>
            </div>
            <div style={{ aspectRatio: "2/1", marginBottom: 12 }}>
              <CodonGrid rows={8} cols={16} highlights={highlights} />
            </div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)", letterSpacing: "0.04em" }}>
              HEX · {wm.signature_hex ? `0x${wm.signature_hex}` : "—"}
            </div>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 4 }}>
              {wm.carrier_positions} carrier positions ·{" "}
              χ² {wm.codon_bias_metrics?.chi_squared?.toFixed(3) ?? "—"} ·{" "}
              covert: {wm.codon_bias_metrics?.is_covert ? "yes" : "no"}
            </div>
          </div>
        ) : (
          <div
            style={{
              background: "var(--paper-2)",
              border: "0.5px solid var(--rule)",
              borderRadius: 6,
              padding: 24,
              marginBottom: 28,
              color: "var(--ink-4)",
              fontSize: 13,
            }}
          >
            Watermark metadata not available for this record.
          </div>
        )}

        {/* Chain of custody */}
        <div className="eyebrow mb-16">§ Chain of custody</div>
        <div style={{ position: "relative", paddingLeft: 28 }}>
          <div style={{ position: "absolute", left: 10, top: 8, bottom: 8, width: "0.5px", background: "var(--rule)" }} />
          {custodyEvents.map((e, i) => (
            <div key={i} style={{ position: "relative", paddingBottom: 24 }}>
              <div
                style={{
                  position: "absolute", left: -24, top: 4,
                  width: 14, height: 14, borderRadius: "50%",
                  border: "0.5px solid var(--ink)",
                  background: e.highlight ? "var(--accent)" : "var(--paper)",
                }}
              />
              <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.06em" }}>{e.when}</div>
              <div style={{ fontSize: 18, margin: "2px 0 4px", color: "var(--ink)" }}>
                {e.t}{" "}
                <span style={{ color: "var(--ink-3)", fontStyle: "italic", fontSize: 14 }}>— {e.who}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55 }}>{e.detail}</div>
            </div>
          ))}
          <p style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 8 }}>
            Full event log (generation, wet-lab, redesign) will be available once the backend exposes
            a custody event endpoint.
          </p>
        </div>

        {/* Distribution section */}
        <div className="eyebrow mt-48 mb-16">§ Distribution copies</div>
        <DistributionSection
          sequenceId={sequenceId}
          client={client}
          showModal={showModal}
          onOpenModal={onOpenModal}
          onCloseModal={onCloseModal}
        />
      </div>

      {/* ── Right column ── */}
      <aside style={{ gridColumn: "span 5" }}>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Certificate JSON
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleCopyJson}>
              {copiedJson ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <pre
            className="mono"
            style={{
              margin: 0, fontSize: 11, lineHeight: 1.7, color: "var(--ink-2)",
              whiteSpace: "pre-wrap", background: "var(--paper)", padding: 16,
              border: "0.5px solid var(--rule)", borderRadius: 3, overflow: "auto",
              maxHeight: 380,
            }}
          >
            {certJson}
          </pre>
          <button
            className="btn btn-ghost btn-sm mt-16"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => {
              const blob = new Blob([certJson], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${cert.registry_id}-certificate.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            ↓ Download Certificate JSON
          </button>
        </div>

        {wm && (
          <div className="card mt-16" style={{ padding: 20 }}>
            <div className="mono mb-8" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Verify offline
            </div>
            <p style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.55, margin: "0 0 12px" }}>
              Verify this record&apos;s certificate hash using the ArtGene CLI:
            </p>
            <pre
              className="mono"
              style={{
                fontSize: 11, background: "var(--paper)", padding: "10px 14px",
                border: "0.5px solid var(--rule)", borderRadius: 3,
                color: "var(--ink-2)", lineHeight: 1.6,
              }}
            >
              {`artgene verify ${cert.registry_id}`}
            </pre>
          </div>
        )}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Synthesizer tab — SCD document viewer + revocation
// ---------------------------------------------------------------------------

function SadDecisionBanner({ sad }: { sad: SynthesisAuthDocument }) {
  const mi = sad.machine_instructions;
  const sa = sad.synthesis_authorization;

  const color = mi.proceed_with_synthesis
    ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/40 text-emerald-800 dark:text-emerald-300"
    : mi.hold_for_review
    ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40 text-amber-800 dark:text-amber-300"
    : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/40 text-red-800 dark:text-red-300";

  const icon = mi.proceed_with_synthesis ? "✓" : mi.hold_for_review ? "⚠" : "✗";

  return (
    <div className={`rounded-lg border p-4 space-y-2 ${color}`}>
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold">{icon}</span>
        <div>
          <div className="font-bold text-base">
            {sa.decision} — {sa.authorization_level}
          </div>
          <div className="text-sm">{sa.decision_reason}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
        <div className="card p-2 text-center">
          <div className="text-slate-500 dark:text-slate-400">Valid from</div>
          <div className="font-mono font-medium text-slate-900 dark:text-white mt-0.5">
            {new Date(sa.valid_from).toLocaleDateString()}
          </div>
        </div>
        <div className="card p-2 text-center">
          <div className="text-slate-500 dark:text-slate-400">Valid until</div>
          <div className="font-mono font-medium text-slate-900 dark:text-white mt-0.5">
            {new Date(sa.valid_until).toLocaleDateString()}
          </div>
        </div>
        <div className="card p-2 text-center">
          <div className="text-slate-500 dark:text-slate-400">Host</div>
          <div className="font-medium text-slate-900 dark:text-white mt-0.5">{sa.host_organism}</div>
        </div>
        <div className="card p-2 text-center">
          <div className="text-slate-500 dark:text-slate-400">BSO required</div>
          <div className={`font-bold mt-0.5 ${sa.requires_biosafety_officer_countersign ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
            {sa.requires_biosafety_officer_countersign ? "YES" : "No"}
          </div>
        </div>
      </div>
      {mi.special_handling_notes && (
        <p className="text-xs font-medium border-t border-current/20 pt-2">{mi.special_handling_notes}</p>
      )}
    </div>
  );
}

function SynthesizerTab({
  id,
  client,
  onRevoked,
}: {
  id: string;
  client: ApiClient;
  onRevoked: () => void;
}) {
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);

  const { data: sad, isLoading, isError, error } = useQuery({
    queryKey: ["synthesis-auth", id],
    queryFn: () => client.getSynthesisAuth(id),
  });

  async function handleRevoke() {
    if (!confirm(`Revoke certificate ${id}? This is permanent and cannot be undone.`)) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      await client.revokeCertificate(id);
      setRevoked(true);
      onRevoked();
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : String(err));
    } finally {
      setRevoking(false);
    }
  }

  function downloadSad() {
    if (!sad) return;
    const blob = new Blob([JSON.stringify(sad, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${id}-synthesis-auth.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <div className="card p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
        Loading synthesis authorization…
      </div>
    );
  }
  if (isError || !sad) {
    return (
      <div className="card p-6 text-red-500 dark:text-red-400 text-sm">
        {error instanceof Error ? error.message : "Failed to load synthesis authorization document"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Spec version + issuer */}
      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
          {sad.spec_version}
        </span>
        <span>issued by {sad.issued_by}</span>
        <span>at {new Date(sad.issued_at).toLocaleString()}</span>
      </div>

      {/* Decision banner */}
      <SadDecisionBanner sad={sad} />

      {/* Machine instructions summary */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
          Machine Instructions
          <span className="ml-2 text-xs font-normal text-slate-400">(synthesizer firmware reads these fields)</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {(
            [
              { key: "proceed_with_synthesis", label: "Proceed" },
              { key: "hold_for_review", label: "Hold" },
              { key: "reject", label: "Reject" },
              { key: "log_for_regulatory_audit", label: "Log audit" },
            ] as const
          ).map(({ key, label }) => {
            const val = sad.machine_instructions[key];
            return (
              <div key={key} className="card p-2 text-center">
                <div className="text-slate-500 dark:text-slate-400">{label}</div>
                <div className={`font-bold text-sm mt-1 font-mono ${val ? (key === "reject" ? "text-red-500" : key === "hold_for_review" ? "text-amber-500" : "text-emerald-600 dark:text-emerald-400") : "text-slate-400"}`}>
                  {String(val)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={downloadSad} className="btn-secondary text-sm flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download SCD (.json)
        </button>
        {!revoked && (
          <button
            onClick={handleRevoke}
            disabled={revoking}
            className="px-3 py-1.5 text-sm rounded border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          >
            {revoking ? "Revoking…" : "Revoke Certificate"}
          </button>
        )}
        {revoked && (
          <span className="text-sm text-red-500 dark:text-red-400 font-medium">Certificate revoked</span>
        )}
      </div>
      {revokeError && (
        <p className="text-xs text-red-500 dark:text-red-400">{revokeError}</p>
      )}

      {/* Regulatory notice */}
      <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 p-3 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
        ⚠ {sad.notice}
      </div>

      {/* Full SCD JSON viewer */}
      <div>
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
          Full ArtGene-SCD-1.0 document
        </div>
        <pre
          className="text-xs font-mono overflow-auto max-h-[560px] p-4 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700 leading-relaxed"
          dangerouslySetInnerHTML={{
            __html: _syntaxHighlight(JSON.stringify(sad, null, 2)),
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 3c — stubs filled in 3c-2 through 3c-6
// ---------------------------------------------------------------------------

function AbstractTab({ cert }: { cert: Certificate }) {
  const wm = cert.watermark_metadata;
  const aaLength = wm?.original_protein?.length ?? null;
  const bpLength = wm?.dna_sequence?.length ?? null;

  const tierMap: Record<string, string> = {
    FULL: "Tier 1 — Unrestricted",
    STANDARD: "Tier 2 — Conditional",
    REDUCED: "Tier 3 — Restricted",
    MINIMAL: "Tier 4 — Minimal",
    REJECTED: "Rejected",
  };

  const metaRows: [string, React.ReactNode][] = [
    ["Accession",       cert.registry_id],
    ["Molecule type",   cert.sequence_type.toUpperCase()],
    ["Expression host", cert.host_organism || "—"],
    ["Ethics code",     cert.ethics_code],
    ["Length",          [aaLength ? `${aaLength} aa` : null, bpLength ? `${bpLength} bp` : null].filter(Boolean).join(" · ") || "—"],
    ["Watermark ID",    wm?.watermark_id ?? "—"],
    ["Tier",            tierMap[cert.tier] ?? cert.tier],
    ["Deposited",       new Date(cert.timestamp).toISOString().slice(0, 10)],
    ["Organisation",    cert.org_id || "—"],
    ["Generating model","— (not yet in API)"],
    ["Design method",   "— (not yet in API)"],
    ["License",         "— (not yet in API)"],
    ["Citation",        `ArtGene Archive, ${cert.registry_id}`],
  ];

  return (
    <div className="grid-12" style={{ gap: 48 }}>

      {/* ── Main column ── */}
      <div style={{ gridColumn: "span 8" }}>
        <div className="eyebrow mb-16">§ Abstract</div>

        {/* Empty-state for abstract text (backend not yet exposing this field) */}
        <div
          style={{
            background: "var(--paper-2)",
            border: "0.5px solid var(--rule)",
            borderRadius: 6,
            padding: "24px 28px",
            marginBottom: 28,
            color: "var(--ink-3)",
            fontSize: 14,
            lineHeight: 1.7,
          }}
        >
          <p style={{ marginBottom: 10 }}>
            Abstract text is not yet exposed by the API. This field will be populated once the
            backend supports the <code className="mono" style={{ fontSize: 12 }}>abstract</code> metadata field on{" "}
            <code className="mono" style={{ fontSize: 12 }}>Certificate</code>.
          </p>
          <p>
            Record: <span className="mono" style={{ color: "var(--accent)", fontSize: 13 }}>{cert.registry_id}</span>
            {" · "}{cert.sequence_type} · deposited {new Date(cert.timestamp).toISOString().slice(0, 10)}
          </p>
        </div>

        {/* Keywords */}
        <div className="mt-40 mb-16 eyebrow">§ Keywords</div>
        <div style={{ color: "var(--ink-4)", fontSize: 13, marginBottom: 32 }}>
          Keywords not yet available in API response.
        </div>

        {/* Authors */}
        <div className="mt-40 mb-16 eyebrow">§ Authors &amp; contributors</div>
        <div style={{ borderTop: "0.5px solid var(--rule)" }}>
          <div
            style={{
              padding: "14px 0",
              borderBottom: "0.5px solid var(--rule-2)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 14, color: "var(--ink)" }}>{cert.owner_id}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.04em", marginTop: 2 }}>
                ORCID — (not yet in API)
              </div>
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Depositor
            </div>
          </div>
          <div style={{ padding: "12px 0", color: "var(--ink-4)", fontSize: 13 }}>
            Additional authors/ORCID fields not yet available in API response.
          </div>
        </div>
      </div>

      {/* ── Sidebar ── */}
      <aside style={{ gridColumn: "span 4" }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "0.5px solid var(--rule)", background: "var(--paper-3)" }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Record metadata
            </div>
          </div>
          <dl style={{ margin: 0, padding: "8px 20px" }}>
            {metaRows.map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: "0.5px solid var(--rule-2)",
                  gap: 16,
                }}
              >
                <dt className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0, paddingTop: 2 }}>
                  {k}
                </dt>
                <dd style={{ margin: 0, fontSize: 12.5, color: "var(--ink-2)", textAlign: "right", wordBreak: "break-all" }}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="card mt-16" style={{ padding: 20 }}>
          <div className="mono mb-8" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Cite this record
          </div>
          <div
            className="mono"
            style={{
              fontSize: 11.5,
              background: "var(--paper)",
              padding: 12,
              borderRadius: 3,
              border: "0.5px solid var(--rule)",
              lineHeight: 1.6,
              color: "var(--ink-2)",
            }}
          >
            {cert.owner_id} ({new Date(cert.timestamp).getFullYear()}).{" "}
            {cert.sequence_type} sequence. <em>ArtGene Archive</em>{" "}
            <span style={{ color: "var(--accent)" }}>{cert.registry_id}</span>.
          </div>
        </div>

        <div className="card mt-16" style={{ padding: 20 }}>
          <div className="mono mb-8" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Quick actions
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ justifyContent: "flex-start" }}
              onClick={() => {
                const text = `${cert.owner_id} (${new Date(cert.timestamp).getFullYear()}). ${cert.sequence_type} sequence. ArtGene Archive ${cert.registry_id}.`;
                navigator.clipboard.writeText(text);
              }}
            >
              ⎘ Copy citation
            </button>
            <button className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start" }}>
              ↓ Download FASTA
            </button>
            <button className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start" }}>
              ↓ Certificate JSON
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function SequenceTab({ cert }: { cert: Certificate }) {
  const [view, setView] = useState<"dna" | "protein">("dna");
  const [showWatermark, setShowWatermark] = useState(false);
  const [copied, setCopied] = useState(false);

  const wm = cert.watermark_metadata;
  const dnaSeq  = wm?.dna_sequence ?? "";
  const aaSeq   = wm?.original_protein ?? "";
  const carrierIndices = new Set<number>(wm?.anchor_map?.carrier_indices ?? []);

  const activeSeq  = view === "dna" ? dnaSeq : aaSeq;
  const chunkSize  = view === "dna" ? 60 : 60;
  const codonWidth = view === "dna" ? 3 : 1;

  // Build rows of {start, seq}
  const rows: { start: number; seq: string }[] = [];
  for (let i = 0; i < activeSeq.length; i += chunkSize) {
    rows.push({ start: i + 1, seq: activeSeq.slice(i, i + chunkSize) });
  }

  function handleCopy() {
    navigator.clipboard.writeText(`>${cert.registry_id}\n${activeSeq}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (!activeSeq) {
    return (
      <div style={{ color: "var(--ink-3)", fontSize: 14, padding: "24px 0" }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>§ Sequence</div>
        <p>Sequence data is not available for this record (watermark metadata absent).</p>
      </div>
    );
  }

  return (
    <div className="grid-12" style={{ gap: 32 }}>
      <div style={{ gridColumn: "span 12" }}>

        {/* Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div className="eyebrow">
            § {view === "dna" ? `Coding sequence · ${dnaSeq.length} bp` : `Protein sequence · ${aaSeq.length} aa`}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Sequence type toggle */}
            <div style={{ display: "flex", border: "0.5px solid var(--rule)", borderRadius: 3, overflow: "hidden", fontSize: 11 }}>
              <button
                onClick={() => setView("dna")}
                style={{
                  padding: "5px 12px",
                  background: view === "dna" ? "var(--ink)" : "transparent",
                  color: view === "dna" ? "var(--paper)" : "var(--ink-3)",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--mono)",
                  letterSpacing: "0.05em",
                }}
              >
                DNA
              </button>
              {aaSeq && (
                <button
                  onClick={() => setView("protein")}
                  style={{
                    padding: "5px 12px",
                    background: view === "protein" ? "var(--ink)" : "transparent",
                    color: view === "protein" ? "var(--paper)" : "var(--ink-3)",
                    border: "none",
                    borderLeft: "0.5px solid var(--rule)",
                    cursor: "pointer",
                    fontFamily: "var(--mono)",
                    letterSpacing: "0.05em",
                  }}
                >
                  Protein
                </button>
              )}
            </div>
            {view === "dna" && wm && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowWatermark(v => !v)}
                style={{ background: showWatermark ? "var(--accent-soft)" : undefined }}
              >
                {showWatermark ? "Hide watermark" : "Show watermark"}
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
              {copied ? "Copied ✓" : "Copy FASTA"}
            </button>
          </div>
        </div>

        {/* Sequence block */}
        <div className="seq-block">
          {rows.map(({ start, seq }) => {
            const chunks = seq.match(new RegExp(`.{1,${codonWidth}}`, "g")) ?? [];
            return (
              <div key={start} style={{ display: "flex", gap: 24, alignItems: "baseline" }}>
                <span
                  className="mono"
                  style={{ minWidth: 44, textAlign: "right", color: "var(--ink-4)", fontSize: 11, userSelect: "none" }}
                >
                  {String(start).padStart(4, "0")}
                </span>
                <span style={{ flex: 1, letterSpacing: view === "dna" ? "0.05em" : "0.08em" }}>
                  {chunks.map((chunk, idx) => {
                    const codonPos = Math.floor((start - 1) / codonWidth) + idx;
                    const isWm = showWatermark && view === "dna" && carrierIndices.has(codonPos);
                    return (
                      <span
                        key={idx}
                        style={{
                          marginRight: view === "dna" ? 5 : 0,
                          color: isWm ? "var(--ink)" : "inherit",
                          fontWeight: isWm ? 500 : 400,
                          background: isWm
                            ? "color-mix(in oklab, var(--verify) 22%, transparent)"
                            : undefined,
                          borderRadius: isWm ? 2 : undefined,
                          padding: isWm ? "1px 2px" : undefined,
                        }}
                      >
                        {chunk}
                      </span>
                    );
                  })}
                </span>
                <span
                  className="mono"
                  style={{ minWidth: 40, textAlign: "right", color: "var(--ink-4)", fontSize: 11, userSelect: "none" }}
                >
                  {start + seq.length - 1}
                </span>
              </div>
            );
          })}
        </div>

        {/* Watermark legend */}
        {showWatermark && view === "dna" && wm && (
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 12, letterSpacing: "0.04em" }}>
            <span
              style={{
                background: "color-mix(in oklab, var(--verify) 22%, transparent)",
                padding: "1px 4px",
                borderRadius: 2,
              }}
            >
              HIGHLIGHTED
            </span>
            {" "}· synonymous codons carrying the ArtGene {(wm.config?.sig_bytes ?? 16) * 8}-bit watermark.
            Protein sequence unchanged. {carrierIndices.size} carrier positions.
          </div>
        )}

        {/* Feature map — placeholder (no annotation endpoint yet) */}
        <div className="mt-40 eyebrow mb-16">§ Feature map</div>
        <div
          style={{
            background: "var(--paper-2)",
            border: "0.5px solid var(--rule)",
            borderRadius: 6,
            padding: "20px 28px",
            color: "var(--ink-4)",
            fontSize: 13,
          }}
        >
          Feature annotation (Start / domains / Stop track) will be available once the backend
          exposes sequence annotation data. Length: {dnaSeq.length > 0 ? `${dnaSeq.length} bp` : "unknown"}.
        </div>

      </div>
    </div>
  );
}

function RefsTab({ cert }: { cert: Certificate }) {
  const depositDate = new Date(cert.timestamp).toISOString().slice(0, 10);

  return (
    <div className="grid-12" style={{ gap: 48 }}>

      {/* ── Main column ── */}
      <div style={{ gridColumn: "span 8" }}>
        <div className="eyebrow mb-16">§ References</div>

        {/* Empty state for references (no API endpoint yet) */}
        <div style={{ borderTop: "0.5px solid var(--rule)" }}>
          <div style={{ padding: "24px 0", color: "var(--ink-4)", fontSize: 13, lineHeight: 1.7 }}>
            Reference list is not yet available. This field will be populated once the backend
            exposes a <code className="mono" style={{ fontSize: 12 }}>references</code> endpoint
            on <code className="mono" style={{ fontSize: 12 }}>Certificate</code>.
          </div>
        </div>

        {/* Version history */}
        <div className="mt-40 eyebrow mb-16">§ Version history</div>
        <div style={{ border: "0.5px solid var(--rule)", borderRadius: 6, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--paper-3)" }}>
                <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 500, color: "var(--ink-2)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--mono)" }}>Version</th>
                <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 500, color: "var(--ink-2)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--mono)" }}>Changes</th>
                <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 500, color: "var(--ink-2)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--mono)" }}>Date</th>
                <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 500, color: "var(--ink-2)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--mono)" }}>By</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderTop: "0.5px solid var(--rule-2)" }}>
                <td style={{ padding: "12px 16px" }}>
                  <span className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>v1.0</span>
                  {" "}
                  <span className="badge badge-verify" style={{ fontSize: 9, marginLeft: 6 }}>Current</span>
                </td>
                <td style={{ padding: "12px 16px", color: "var(--ink-2)" }}>
                  Initial deposit · {cert.tier} certified · {cert.status}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>{depositDate}</span>
                </td>
                <td style={{ padding: "12px 16px", color: "var(--ink-2)" }}>{cert.owner_id}</td>
              </tr>
              <tr style={{ borderTop: "0.5px solid var(--rule-2)", background: "var(--paper-2)" }}>
                <td colSpan={4} style={{ padding: "12px 16px", color: "var(--ink-4)", fontSize: 12 }}>
                  Earlier versions not yet tracked — version history endpoint pending backend implementation.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Sidebar ── */}
      <aside style={{ gridColumn: "span 4" }}>
        <div className="card" style={{ padding: 20 }}>
          <div className="mono mb-16" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Related records
          </div>
          <div style={{ color: "var(--ink-4)", fontSize: 12.5, lineHeight: 1.55, marginBottom: 8 }}>
            Related record discovery is not yet available. This will be populated once the backend
            exposes a similarity or citation graph endpoint.
          </div>
          <div style={{ padding: "10px 0", borderTop: "0.5px solid var(--rule-2)" }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{cert.registry_id}</span>
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>This record (current)</div>
          </div>
        </div>

        <div className="card mt-16" style={{ padding: 20 }}>
          <div className="mono mb-8" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Cited by
          </div>
          <div style={{ color: "var(--ink-4)", fontSize: 12.5, lineHeight: 1.55 }}>
            Citation tracking not yet available. Forward-citation data will be surfaced once the
            backend exposes a citation index.
          </div>
        </div>

        <div className="card mt-16" style={{ padding: 20 }}>
          <div className="mono mb-8" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Cite this record
          </div>
          <div
            className="mono"
            style={{
              fontSize: 11, background: "var(--paper)", padding: 12,
              borderRadius: 3, border: "0.5px solid var(--rule)",
              lineHeight: 1.6, color: "var(--ink-2)",
            }}
          >
            {cert.owner_id} ({new Date(cert.timestamp).getFullYear()}).{" "}
            {cert.sequence_type} sequence. <em>ArtGene Archive</em>{" "}
            <span style={{ color: "var(--accent)" }}>{cert.registry_id}</span>.
          </div>
        </div>
      </aside>
    </div>
  );
}

function BiosafetyTab({ cert }: { cert: Certificate }) {
  const report = cert.consequence_report;
  const overall: GateStatus = report?.overall_status ?? "skip";

  if (!report) {
    return (
      <div className="card" style={{ padding: 24, color: "var(--ink-3)", fontSize: 14 }}>
        No biosafety report available for this record.
      </div>
    );
  }

  // Build gate rows from available gate results
  type GateRow = {
    letter: string;
    name: string;
    tool: string;
    status: GateStatus;
    score: number | null;
    threshold: number | null;
    summary: string;
    panel: React.ReactNode;
  };

  const gateRows: GateRow[] = [];

  if (report.gate1) {
    const g = report.gate1 as Gate1Result;
    gateRows.push({
      letter: "α", name: "Structural confidence", tool: "ESMFold · pLDDT",
      status: g.status,
      score: g.plddt_mean,
      threshold: 70,
      summary: g.message ?? (g.plddt_mean != null ? `Mean pLDDT ${g.plddt_mean.toFixed(1)}` : ""),
      panel: <Gate1Panel gate1={g} />,
    });
  }
  if (report.gate2) {
    const g = report.gate2 as Gate2Result;
    const isChained = g.screening_method === "chained_v1";
    gateRows.push({
      letter: "β", name: "Off-target homology",
      tool: isChained ? "SecureDNA + IBBIS + Composition" : "Toxin / Allergen heuristic",
      status: g.status,
      score: g.toxin_probability != null ? (1 - g.toxin_probability) : null,
      threshold: 0.70,
      summary: g.message ?? (g.toxin_probability != null ? `Toxin probability ${(g.toxin_probability * 100).toFixed(1)}%` : ""),
      panel: <Gate2Panel gate2={g} />,
    });
  }
  if (report.gate3) {
    const g = report.gate3 as Gate3Result;
    gateRows.push({
      letter: "γ", name: "Ecological risk", tool: "HGT + DriftRadar",
      status: g.status,
      score: g.hgt_score != null ? (1 - g.hgt_score / 100) : null,
      threshold: 0.55,
      summary: g.message ?? (g.hgt_score != null ? `HGT score ${g.hgt_score.toFixed(1)} / 100` : ""),
      panel: <Gate3Panel gate3={g} />,
    });
  }
  if (report.gate4) {
    const g = report.gate4 as Gate4Result;
    gateRows.push({
      letter: "δ", name: "Functional analogue",
      tool: g.method === "esm2_cosine_v1" ? "ESM-2 cosine similarity" : "Composition fingerprint",
      status: g.status,
      score: g.max_similarity != null ? (1 - g.max_similarity) : null,
      threshold: g.threshold_fail != null ? (1 - g.threshold_fail) : 0.50,
      summary: g.message ?? (g.max_similarity != null ? `Max similarity ${g.max_similarity.toFixed(4)}` : ""),
      panel: <Gate4Panel gate4={g} />,
    });
  }

  const allPassed = gateRows.every(g => g.status === "pass");
  const overallColor = overall === "pass" ? "var(--verify)" : overall === "fail" ? "var(--danger)" : "var(--warn)";

  const tierMap: Record<string, string> = {
    FULL: "Tier 1", STANDARD: "Tier 2", REDUCED: "Tier 3", MINIMAL: "Tier 4", REJECTED: "Restricted",
  };
  const tierLabel = tierMap[cert.tier] ?? cert.tier;

  return (
    <div className="grid-12" style={{ gap: 48 }}>

      {/* ── Main column ── */}
      <div style={{ gridColumn: "span 8" }}>
        <div className="eyebrow mb-16">§ Biosafety scorecard</div>

        {/* Overall assessment banner */}
        <div
          style={{
            background: `color-mix(in oklab, ${overallColor} 8%, var(--paper-2))`,
            border: `0.5px solid color-mix(in oklab, ${overallColor} 30%, transparent)`,
            borderRadius: 6,
            padding: "24px 28px",
            marginBottom: 32,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div
                className="mono"
                style={{ fontSize: 10.5, color: overallColor, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}
              >
                Overall assessment · {tierLabel}
              </div>
              <div style={{ fontSize: 22, color: "var(--ink)", letterSpacing: "-0.01em" }}>
                {allPassed
                  ? "All gates passed without exception."
                  : overall === "fail"
                  ? "One or more gates failed — manual review required."
                  : "Gates passed with warnings — see details below."}
              </div>
            </div>
            <div
              className="mono"
              style={{ fontSize: 42, color: overallColor, letterSpacing: "-0.02em", lineHeight: 1 }}
            >
              {overall === "pass" ? "✓" : overall === "fail" ? "✗" : "⚠"}
            </div>
          </div>
        </div>

        {/* Gate rows */}
        {gateRows.map(g => (
          <div key={g.letter} style={{ borderTop: "0.5px solid var(--rule)", padding: "28px 0" }}>
            <div style={{ display: "flex", gap: 24, alignItems: "start" }}>
              {/* Greek-letter circle */}
              <div
                style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "var(--paper-2)", border: "0.5px solid var(--rule)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 26, color: "var(--accent)",
                  fontFamily: "var(--serif, var(--sans))",
                  flexShrink: 0,
                }}
              >
                {g.letter}
              </div>

              <div style={{ flex: 1 }}>
                {/* Gate header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
                      Gate {g.letter} · {g.tool}
                    </div>
                    <div style={{ fontSize: 20, color: "var(--ink)" }}>{g.name}</div>
                  </div>
                  <StatusBadge status={g.status} />
                </div>

                {/* Score bar */}
                {g.score !== null && g.threshold !== null && (
                  <div style={{ marginTop: 14, marginBottom: 12 }}>
                    <div
                      style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)", marginBottom: 6 }}
                    >
                      <span>Score</span>
                      <span style={{ color: "var(--ink)" }}>
                        {g.score.toFixed(2)}{" "}
                        <span style={{ color: "var(--ink-4)" }}>/ threshold {g.threshold.toFixed(2)}</span>
                      </span>
                    </div>
                    <div style={{ height: 4, background: "var(--rule)", borderRadius: 2, position: "relative", overflow: "hidden" }}>
                      <div
                        style={{ position: "absolute", top: 0, bottom: 0, left: `${g.threshold * 100}%`, width: "0.5px", background: "var(--ink-3)", zIndex: 2 }}
                      />
                      <div
                        style={{
                          position: "absolute", top: 0, left: 0, height: "100%",
                          width: `${Math.min(100, Math.max(0, g.score) * 100)}%`,
                          background: g.status === "pass" ? "var(--verify)" : g.status === "fail" ? "var(--danger)" : "var(--warn)",
                        }}
                      />
                    </div>
                  </div>
                )}

                {g.summary && (
                  <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)", margin: "12px 0 0" }}>{g.summary}</p>
                )}

                {/* Detailed panel (collapsible via existing GateItem, but here flat) */}
                <details style={{ marginTop: 16 }}>
                  <summary
                    className="mono"
                    style={{ fontSize: 11, color: "var(--ink-3)", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", userSelect: "none" }}
                  >
                    Show full details ▸
                  </summary>
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "0.5px solid var(--rule-2)" }}>
                    {g.panel}
                  </div>
                </details>
              </div>
            </div>
          </div>
        ))}

        {report.skipped_gates.length > 0 && (
          <div className="mt-24 mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
            Gates {report.skipped_gates.join(", ")} skipped (fail-fast after gate failure).
          </div>
        )}

        <div
          className="mt-24"
          style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.6, paddingLeft: 18, borderLeft: "2px solid var(--rule)" }}
        >
          Biosafety screening is automated and non-exhaustive. Flagged or borderline records route
          to the ArtGene Human Review Panel. Tier assignments are reviewed annually.
        </div>
      </div>

      {/* ── Sidebar ── */}
      <aside style={{ gridColumn: "span 4" }}>
        <div className="card" style={{ padding: 20 }}>
          <div className="mono mb-16" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Tier legend
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            {[
              { t: "Tier 1", color: "var(--verify)", desc: "Unrestricted. Public, open access. All gates pass with margin." },
              { t: "Tier 2", color: "var(--warn)",   desc: "Conditional. Metadata public; sequence on request with institutional verification." },
              { t: "Tier 3", color: "var(--danger)", desc: "Restricted. Flagged by one or more gates. Human review required." },
            ].map(tier => (
              <div key={tier.t} style={{ paddingLeft: 12, borderLeft: `2px solid ${tier.color}` }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{tier.t}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5, marginTop: 2 }}>{tier.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card mt-16" style={{ padding: 20 }}>
          <div className="mono mb-8" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Report a concern
          </div>
          <p style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.55, margin: "0 0 12px" }}>
            If you believe this record was misclassified or poses a risk not captured by automated
            screening, contact the biosafety panel.
          </p>
          <a
            href="mailto:biosafety@artgene-archive.org"
            className="btn btn-ghost btn-sm"
            style={{ display: "inline-block" }}
          >
            biosafety@artgene-archive.org →
          </a>
        </div>

        {report.gate_mode && (
          <div className="card mt-16" style={{ padding: 20 }}>
            <div className="mono mb-8" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Screen mode
            </div>
            <span
              className="mono"
              style={{
                fontSize: 11,
                background: report.gate_mode === "real" ? "color-mix(in oklab, var(--verify) 12%, var(--paper))" : "var(--paper-3)",
                color: report.gate_mode === "real" ? "var(--verify)" : "var(--ink-3)",
                padding: "4px 10px",
                borderRadius: 3,
                border: "0.5px solid var(--rule)",
              }}
            >
              {report.gate_mode === "real" ? "● LIVE" : `${report.gate_mode}`}
            </span>
          </div>
        )}
      </aside>
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
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "abstract" | "sequence" | "biosafety" | "provenance" | "refs" | "compliance" | "synthesizer"
  >("abstract");
  const [showDistributeModal, setShowDistributeModal] = useState(false);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const data = await client.exportCertificate(id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${id}.artgene.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed — please try again.");
    } finally {
      setExporting(false);
    }
  }

  const { data: cert, isLoading, isError, error } = useQuery({
    queryKey: ["certificate", id],
    queryFn: () => client.getCertificate(id),
    enabled: Boolean(id && apiKey),
  });

  if (!apiKey) {
    return (
      <div className="wrap" style={{ padding: "80px 0", textAlign: "center", color: "var(--ink-3)" }}>
        <p>No API key configured. Add <code>NEXT_PUBLIC_API_KEY</code> to your environment.</p>
        <Link href="/sequences" className="btn btn-ghost btn-sm" style={{ marginTop: 16, display: "inline-block" }}>
          ← Back to sequences
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="wrap" style={{ padding: "80px 0", textAlign: "center", color: "var(--ink-3)" }}>
        Loading record…
      </div>
    );
  }

  if (isError || !cert) {
    return (
      <div className="wrap" style={{ padding: "80px 0", textAlign: "center" }}>
        <p style={{ color: "var(--danger)", marginBottom: 16 }}>
          {error instanceof Error ? error.message : "Certificate not found"}
        </p>
        <Link href="/sequences" className="btn btn-ghost btn-sm">← Back to sequences</Link>
      </div>
    );
  }

  const TABS = [
    { key: "abstract",    label: "Abstract & description" },
    { key: "sequence",    label: "Sequence" },
    { key: "biosafety",   label: "Biosafety scorecard" },
    { key: "provenance",  label: "Provenance & watermark" },
    { key: "refs",        label: "References & versions" },
    { key: "compliance",  label: "Compliance" },
    { key: "synthesizer", label: "Synthesizer" },
  ] as const;

  const statusLabel =
    cert.status === "CERTIFIED"               ? "Certified" :
    cert.status === "CERTIFIED_WITH_WARNINGS" ? "Certified (warnings)" :
    cert.status === "REVOKED"                 ? "Revoked" : cert.status;

  const statusBadgeClass =
    cert.status === "CERTIFIED"               ? "badge badge-verify badge-dot" :
    cert.status === "CERTIFIED_WITH_WARNINGS" ? "badge badge-warn badge-dot" :
    "badge";

  const tierMap: Record<string, string> = {
    FULL: "Tier 1", STANDARD: "Tier 2", REDUCED: "Tier 3", MINIMAL: "Tier 4", REJECTED: "Restricted",
  };
  const tierLabel = tierMap[cert.tier] ?? cert.tier;

  const wm = cert.watermark_metadata;
  const aaLength = wm?.original_protein?.length ?? null;
  const bpLength = wm?.dna_sequence?.length ?? null;

  return (
    <div className="route">

      {/* ── Top bar ── */}
      <div style={{ background: "var(--paper-3)", borderBottom: "0.5px solid var(--rule)", padding: "10px 0" }}>
        <div
          className="wrap"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}
        >
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--ink-3)", textTransform: "uppercase" }}>
            <Link href="/registry" style={{ color: "var(--ink-3)", textDecoration: "none" }}>Registry</Link>
            {" ▸ "}
            <Link href="/sequences" style={{ color: "var(--ink-3)", textDecoration: "none" }}>Sequences</Link>
            {" ▸ "}
            <span style={{ color: "var(--ink)" }}>{cert.registry_id}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className={statusBadgeClass}>{statusLabel} · {tierLabel}</span>
            <span className="badge">{cert.sequence_type.toUpperCase()}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab("refs")}>⎘ Cite</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab("sequence")}>↓ FASTA</button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleExport}
              disabled={exporting}
              aria-busy={exporting}
            >
              {exporting ? "Exporting…" : "↓ Certificate"}
            </button>
          </div>
        </div>
        {exportError && (
          <div className="wrap" style={{ paddingTop: 4 }}>
            <p className="mono" style={{ fontSize: 11, color: "var(--danger)" }} role="alert">{exportError}</p>
          </div>
        )}
      </div>

      {/* ── Record header ── */}
      <section className="wrap" style={{ padding: "48px 0 32px" }}>
        <div className="grid-12" style={{ gap: 40, alignItems: "start" }}>
          <div style={{ gridColumn: "span 8" }}>
            <div
              className="mono"
              style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}
            >
              {cert.registry_id} · {cert.sequence_type}
            </div>
            <h1
              className="display"
              style={{ fontSize: 42, margin: "0 0 14px", letterSpacing: "-0.02em" }}
            >
              {cert.registry_id}
            </h1>
            <div style={{ fontSize: 16, fontStyle: "italic", color: "var(--ink-3)", marginBottom: 20 }}>
              {cert.sequence_type} sequence · deposited by {cert.owner_id}
            </div>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginTop: 24, fontSize: 13, color: "var(--ink-2)" }}>
              <div>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
                  Depositor
                </div>
                {cert.owner_id}
              </div>
              <div>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
                  Deposited
                </div>
                {new Date(cert.timestamp).toISOString().slice(0, 16).replace("T", " ") + " UTC"}
              </div>
              <div>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
                  Organisation
                </div>
                {cert.org_id || "—"}
              </div>
              {(aaLength !== null || bpLength !== null) && (
                <div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
                    Length
                  </div>
                  {[aaLength ? `${aaLength} aa` : null, bpLength ? `${bpLength} bp` : null].filter(Boolean).join(" · ")}
                </div>
              )}
              <div>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
                  Ethics code
                </div>
                {cert.ethics_code}
              </div>
            </div>
          </div>
          <div style={{ gridColumn: "span 4", display: "flex", justifyContent: "center", paddingTop: 8 }}>
            <CertSeal size={160} />
          </div>
        </div>
      </section>

      {/* ── Sticky tabs ── */}
      <div
        style={{
          borderTop: "0.5px solid var(--rule)",
          borderBottom: "0.5px solid var(--rule)",
          position: "sticky",
          top: 62,
          background: "var(--paper)",
          zIndex: 10,
        }}
      >
        <div className="wrap" style={{ display: "flex", overflowX: "auto" }}>
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: "16px 22px",
                background: "transparent",
                border: "none",
                borderBottom: activeTab === key ? "1.5px solid var(--accent)" : "1.5px solid transparent",
                color: activeTab === key ? "var(--ink)" : "var(--ink-3)",
                fontSize: 13.5,
                fontFamily: "var(--sans)",
                cursor: "pointer",
                marginBottom: "-0.5px",
                letterSpacing: "0.005em",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab body ── */}
      <section className="wrap" style={{ padding: "48px 0 80px" }}>
        {activeTab === "abstract"   && <AbstractTab cert={cert} />}
        {activeTab === "sequence"   && <SequenceTab cert={cert} />}
        {activeTab === "biosafety"  && <BiosafetyTab cert={cert} />}
        {activeTab === "provenance" && (
          <ProvenanceTab
            cert={cert}
            sequenceId={id}
            client={client}
            showModal={showDistributeModal}
            onOpenModal={() => setShowDistributeModal(true)}
            onCloseModal={() => setShowDistributeModal(false)}
          />
        )}
        {activeTab === "refs"        && <RefsTab cert={cert} />}
        {activeTab === "compliance"  && <ComplianceTab id={id} client={client} />}
        {activeTab === "synthesizer" && (
          <SynthesizerTab
            id={id}
            client={client}
            onRevoked={() => setActiveTab("biosafety")}
          />
        )}
      </section>

    </div>
  );
}
