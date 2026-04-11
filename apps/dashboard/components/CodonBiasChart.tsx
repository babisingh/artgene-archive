"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WatermarkMetadata } from "../lib/api";

// ---------------------------------------------------------------------------
// Codon pools — mirrors tinsel/watermark/encoder.py CODON_POOLS
// Only include amino acids with >1 synonymous codon.
// ---------------------------------------------------------------------------

const CODON_POOLS: Record<string, string[]> = {
  A: ["GCT", "GCC", "GCA", "GCG"],
  C: ["TGT", "TGC"],
  D: ["GAT", "GAC"],
  E: ["GAA", "GAG"],
  F: ["TTT", "TTC"],
  G: ["GGT", "GGC", "GGA", "GGG"],
  H: ["CAT", "CAC"],
  I: ["ATT", "ATC", "ATA"],
  K: ["AAA", "AAG"],
  L: ["TTA", "TTG", "CTT", "CTC", "CTA", "CTG"],
  N: ["AAT", "AAC"],
  P: ["CCT", "CCC", "CCA", "CCG"],
  Q: ["CAA", "CAG"],
  R: ["CGT", "CGC", "CGA", "CGG", "AGA", "AGG"],
  S: ["TCT", "TCC", "TCA", "TCG", "AGT", "AGC"],
  T: ["ACT", "ACC", "ACA", "ACG"],
  V: ["GTT", "GTC", "GTA", "GTG"],
  Y: ["TAT", "TAC"],
};

// Amino acid full names for tooltips
const AA_NAMES: Record<string, string> = {
  A: "Ala", C: "Cys", D: "Asp", E: "Glu", F: "Phe",
  G: "Gly", H: "His", I: "Ile", K: "Lys", L: "Leu",
  N: "Asn", P: "Pro", Q: "Gln", R: "Arg", S: "Ser",
  T: "Thr", V: "Val", Y: "Tyr",
};

// ---------------------------------------------------------------------------
// Data computation
// ---------------------------------------------------------------------------

interface CodonDataPoint {
  name: string;          // display label: "L·CTG"
  codon: string;         // triplet
  aa: string;            // amino acid letter
  actual: number;        // observed relative frequency within AA pool [0,1]
  expected: number;      // uniform 1/pool_size [0,1]
  count: number;         // raw count
  isGap?: boolean;       // true for visual separator entries
}

function computeChartData(
  protein: string,
  dna: string,
  topN = 6
): CodonDataPoint[] {
  // Count amino acid occurrences
  const aaCounts: Record<string, number> = {};
  for (const aa of protein.toUpperCase()) {
    if (CODON_POOLS[aa]) aaCounts[aa] = (aaCounts[aa] ?? 0) + 1;
  }

  // Pick topN most-frequent AAs (with pool size > 1)
  const selectedAAs = Object.entries(aaCounts)
    .filter(([aa]) => (CODON_POOLS[aa]?.length ?? 0) > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([aa]) => aa);

  const dnaUpper = dna.toUpperCase();
  const protUpper = protein.toUpperCase();

  const result: CodonDataPoint[] = [];

  for (let gi = 0; gi < selectedAAs.length; gi++) {
    const aa = selectedAAs[gi];
    const pool = CODON_POOLS[aa]!;
    const expected = 1 / pool.length;

    // Count codon usage for this AA
    const codonCounts: Record<string, number> = {};
    for (const codon of pool) codonCounts[codon] = 0;

    for (let i = 0; i < protUpper.length; i++) {
      if (protUpper[i] === aa) {
        const codon = dnaUpper.slice(i * 3, i * 3 + 3);
        if (codon in codonCounts) codonCounts[codon]!++;
      }
    }

    const total = Object.values(codonCounts).reduce((s, c) => s + c, 0);

    for (const codon of pool) {
      const count = codonCounts[codon] ?? 0;
      result.push({
        name: `${aa}·${codon}`,
        codon,
        aa,
        actual: total > 0 ? count / total : 0,
        expected,
        count,
      });
    }

    // Add visual gap between groups (except after last)
    if (gi < selectedAAs.length - 1) {
      result.push({
        name: `gap_${aa}`,
        codon: "",
        aa,
        actual: 0,
        expected: 0,
        count: 0,
        isGap: true,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Chi-squared interpretation
// ---------------------------------------------------------------------------

function chiLabel(chi2: number): { text: string; color: string } {
  if (chi2 < 10) return { text: "Very low bias", color: "#10b981" };
  if (chi2 < 30) return { text: "Low bias", color: "#22c55e" };
  if (chi2 < 60) return { text: "Moderate bias", color: "#f59e0b" };
  return { text: "Elevated bias", color: "#ef4444" };
}

// ---------------------------------------------------------------------------
// Custom tick — shows only codon part, colour-coded by AA
// ---------------------------------------------------------------------------

const GROUP_COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b",
  "#ef4444", "#06b6d4",
];

interface TickProps {
  x?: number;
  y?: number;
  payload?: { value: string };
  aaOrder?: string[];
}

function CodonTick({ x = 0, y = 0, payload, aaOrder = [] }: TickProps) {
  if (!payload?.value || payload.value.startsWith("gap_")) return null;
  const [aa, codon] = payload.value.split("·");
  const colorIdx = aaOrder.indexOf(aa ?? "");
  const color = colorIdx >= 0 ? GROUP_COLORS[colorIdx % GROUP_COLORS.length] : "#64748b";
  return (
    <text x={x} y={y + 12} textAnchor="middle" fontSize={10} fill={color} fontFamily="monospace">
      {codon}
    </text>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

interface TooltipPayload {
  payload?: CodonDataPoint;
}

function CustomTooltip({ active, payload: pl }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !pl?.[0]?.payload || pl[0].payload.isGap) return null;
  const d = pl[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-lg text-xs">
      <div className="font-mono font-bold text-slate-900 dark:text-white mb-1">
        {AA_NAMES[d.aa] ?? d.aa} ({d.aa}) · {d.codon}
      </div>
      <div className="space-y-0.5 text-slate-600 dark:text-slate-300">
        <div>Observed: <span className="font-semibold text-blue-600 dark:text-blue-400">{(d.actual * 100).toFixed(1)}%</span></div>
        <div>Expected: <span className="font-semibold text-slate-500">{(d.expected * 100).toFixed(1)}%</span></div>
        <div>Count: {d.count}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main chart component
// ---------------------------------------------------------------------------

interface CodonBiasChartProps {
  watermark: WatermarkMetadata;
}

export function CodonBiasChart({ watermark }: CodonBiasChartProps) {
  const {
    original_protein,
    dna_sequence,
    carrier_positions,
  } = watermark;
  const chi_squared = watermark.codon_bias_metrics.chi_squared;
  const tier = watermark.config.tier;

  if (!original_protein || !dna_sequence) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-slate-400">
        No codon data available
      </div>
    );
  }

  const chartData = computeChartData(original_protein, dna_sequence, 6);
  const aaOrder = Array.from(new Set(chartData.filter((d) => !d.isGap).map((d) => d.aa)));
  const chi = chiLabel(chi_squared);

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Codon Usage Distribution
          </div>
          <div className="text-sm font-medium text-slate-900 dark:text-white mt-0.5">
            TINSEL Watermark · Top {aaOrder.length} synonymous families
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-3 text-xs">
          <div className="card px-3 py-1.5 flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400">χ²</span>
            <span className="font-mono font-semibold text-slate-900 dark:text-white">
              {chi_squared.toFixed(4)}
            </span>
            <span className="font-medium" style={{ color: chi.color }}>
              {chi.text}
            </span>
          </div>
          <div className="card px-3 py-1.5 flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400">Tier</span>
            <span className={`badge font-semibold ${
              tier === "FULL" ? "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-400"
              : tier === "STANDARD" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400"
              : tier === "REDUCED" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400"
              : "badge-skip"
            }`}>
              {tier}
            </span>
          </div>
          <div className="card px-3 py-1.5 text-slate-500 dark:text-slate-400">
            <span className="font-mono font-semibold text-slate-900 dark:text-white">
              {carrier_positions}
            </span>{" "}
            carrier positions
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-500 opacity-80" />
          Observed frequency
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 border-t-2 border-dashed border-slate-400" />
          Expected (uniform)
        </span>
        <span className="ml-auto text-xs">
          {aaOrder.map((aa, i) => (
            <span
              key={aa}
              className="mr-2 font-mono font-semibold"
              style={{ color: GROUP_COLORS[i % GROUP_COLORS.length] }}
            >
              {aa}={AA_NAMES[aa]}
            </span>
          ))}
        </span>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 0, bottom: 24 }}
          barSize={18}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="rgba(100,116,139,0.15)"
          />
          <XAxis
            dataKey="name"
            tick={(props: TickProps) => (
              <CodonTick {...props} aaOrder={aaOrder} />
            )}
            tickLine={false}
            axisLine={{ stroke: "rgba(100,116,139,0.2)" }}
            interval={0}
          />
          <YAxis
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            tick={{ fontSize: 10, fill: "currentColor" }}
            tickLine={false}
            axisLine={false}
            domain={[0, 1]}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Reference lines for expected frequencies per group */}
          {aaOrder.map((aa, idx) => {
            const pool = CODON_POOLS[aa];
            if (!pool) return null;
            const expected = 1 / pool.length;
            const color = GROUP_COLORS[idx % GROUP_COLORS.length];
            // Draw a dashed line at expected frequency level for each codon in the group
            return pool.map((codon) => (
              <ReferenceLine
                key={`${aa}-${codon}`}
                x={`${aa}·${codon}`}
                stroke={color}
                strokeDasharray="3 2"
                strokeOpacity={0.4}
                segment={[
                  { x: `${aa}·${codon}`, y: 0 },
                  { x: `${aa}·${codon}`, y: expected },
                ]}
                ifOverflow="visible"
              />
            ));
          })}

          <Bar dataKey="actual" radius={[3, 3, 0, 0]} name="Observed">
            {chartData.map((entry, idx) => {
              if (entry.isGap) return <Cell key={idx} fill="transparent" />;
              const aaIdx = aaOrder.indexOf(entry.aa);
              const color = GROUP_COLORS[aaIdx % GROUP_COLORS.length] ?? "#3b82f6";
              // Tint by deviation from expected
              const deviation = entry.actual - entry.expected;
              const opacity = 0.5 + Math.min(Math.abs(deviation) * 3, 0.5);
              return (
                <Cell
                  key={idx}
                  fill={color}
                  fillOpacity={opacity}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* AA group labels below chart */}
      <div className="flex justify-around text-xs font-mono font-semibold px-9">
        {aaOrder.map((aa, i) => (
          <span key={aa} style={{ color: GROUP_COLORS[i % GROUP_COLORS.length] }}>
            {aa} ({CODON_POOLS[aa]?.length ?? 0}-fold)
          </span>
        ))}
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
        Bar height = observed codon frequency within synonymous family.
        Opacity encodes deviation from uniform expectation.
        Higher χ² indicates stronger watermark statistical signature.
      </p>
    </div>
  );
}
