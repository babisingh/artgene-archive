"use client";

import { InfoTooltip } from "../../components/InfoTooltip";
import type { AnalyseResponse, StructureResponse, WatermarkMetadata } from "../../lib/api";

// ── Example presets ────────────────────────────────────────────────────────

export const EXAMPLES = [
  {
    name: "GLP-1",
    host: "HUMAN",
    badge: "Human",
    description: "Glucagon-like peptide-1 — diabetes therapy",
    fasta: ">GLP-1_Human\nHAEGTFTSDVSSYLEGQAAKEFIAWLVKGR",
  },
  {
    name: "Insulin B",
    host: "CHO",
    badge: "CHO",
    description: "Insulin B chain — biopharmaceutical production",
    fasta: ">Insulin_B_CHO\nFVNQHLCGSHLVEALYLVCGERGFFYTPKT",
  },
  {
    name: "GFP",
    host: "YEAST",
    badge: "Yeast",
    description: "Green Fluorescent Protein — reporter gene",
    fasta: ">GFP_Yeast\nMSKGEELFTGVVPILVELDGDVNGHKFSVSGEGEGDATYGKLTLKFICTTGKLPVPWPTLVTTLTYGVQCFSRYPDHMKQHDFFKSAMPEGYVQERTIFFKDDGNYKTRAEVKFEGDTLVNRIELKGIDFKEDGNILGHKLEYNYNSHNVYIMADKQKNGIKVNFKIRHNIEDGSVQLADHYQQNTPIGDGPVLLPDNHYLSTQSALSKDPNEKRDHMVLLEFVTAAGITLGMDELYK",
  },
  {
    name: "Ubiquitin",
    host: "ECOLI",
    badge: "E. coli",
    description: "Human ubiquitin — structural biology standard",
    fasta: ">Ubiquitin_ECOLI\nMQIFVKTLTGKTITLEVEPSDTIENVKAKIQDKEGIPPDQQRLIFAGKQLEDGRTLSDYNIQKESTLHLVLRLRGG",
  },
] as const;

// ── WatermarkMetadata adapter (for CodonBiasChart) ─────────────────────────

export function toWatermarkMeta(data: AnalyseResponse): WatermarkMetadata {
  return {
    original_protein: data.original_protein,
    dna_sequence: data.watermarked_dna,
    watermark_id: "demo",
    carrier_positions: data.carrier_positions,
    config: {
      watermark_id: "demo",
      tier: data.watermark_tier,
      sig_bytes: 0,
      spreading_key_id: "demo",
      codeword_length: 0,
      rs_n: null,
      rs_k: null,
    },
    anchor_map: { carrier_indices: [], pool_sizes: [], protein_length: data.sequence_length },
    codon_bias_metrics: {
      chi_squared: data.chi_squared,
      p_value: data.p_value,
      is_covert: data.is_covert,
      per_aa_deviations: data.per_aa_deviations,
    },
    signature_hex: "",
  };
}

// ── mRNA Arc Diagram ───────────────────────────────────────────────────────

export function ArcDiagram({
  dotBracket,
  label,
  color,
}: {
  dotBracket: string;
  label: string;
  color: string;
}) {
  const LIMIT = 120;
  const seq = dotBracket.slice(0, LIMIT);
  const n = seq.length;
  if (n === 0) return <div className="text-xs text-slate-400 py-4 text-center">No data</div>;

  const stack: number[] = [];
  const pairs: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    if (seq[i] === "(") stack.push(i);
    else if (seq[i] === ")" && stack.length > 0) pairs.push([stack.pop()!, i]);
  }

  const W = 480, H = 72, margin = 12;
  const xOf = (i: number) => margin + (i / Math.max(n - 1, 1)) * (W - 2 * margin);
  const yBase = H - 10;

  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{label}</div>
      <div className="overflow-x-auto">
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
          <line x1={margin} y1={yBase} x2={W - margin} y2={yBase} stroke="#94a3b8" strokeWidth={1.5} />
          {Array.from({ length: n }, (_, i) => (
            <circle key={i} cx={xOf(i)} cy={yBase} r={seq[i] === "." ? 1 : 2}
              fill={seq[i] === "." ? "#94a3b8" : color} opacity={seq[i] === "." ? 0.4 : 0.9} />
          ))}
          {pairs.map(([i, j]) => {
            const x1 = xOf(i), x2 = xOf(j), mx = (x1 + x2) / 2;
            const arcH = Math.min(((x2 - x1) / 2) * 0.9, 58);
            return <path key={`${i}-${j}`} d={`M ${x1} ${yBase} Q ${mx} ${yBase - arcH} ${x2} ${yBase}`}
              fill="none" stroke={color} strokeWidth={0.9} strokeOpacity={0.45} />;
          })}
          {dotBracket.length > LIMIT && (
            <text x={W - margin + 2} y={yBase - 4} fontSize={8} fill="#94a3b8" textAnchor="start">
              …{dotBracket.length - LIMIT} more
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}

// ── pLDDT colour strip ─────────────────────────────────────────────────────

export function PlddtStrip({ scores }: { scores: number[] }) {
  const color = (s: number) => s >= 90 ? "#2563eb" : s >= 70 ? "#06b6d4" : s >= 50 ? "#f59e0b" : "#ef4444";
  const W = 600, H = 20, bw = W / scores.length;
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", height: H }}>
        {scores.map((s, i) => (
          <rect key={i} x={i * bw} y={0} width={bw + 0.5} height={H} fill={color(s)} />
        ))}
      </svg>
      <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
        {[
          { label: "Very high (≥90)", c: "#2563eb" },
          { label: "Confident (70–89)", c: "#06b6d4" },
          { label: "Low (50–69)", c: "#f59e0b" },
          { label: "Very low (<50)", c: "#ef4444" },
        ].map(({ label, c }) => (
          <span key={label} className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0" style={{ background: c }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────

export function StatCard({
  label, value, sub, tooltip, good,
}: {
  label: string; value: string | number; sub?: string; tooltip: string; good?: boolean;
}) {
  const colorClass = good === undefined
    ? "text-slate-900 dark:text-white"
    : good
    ? "text-green-600 dark:text-green-400"
    : "text-amber-600 dark:text-amber-400";
  return (
    <div className="card p-4 space-y-0.5">
      <div className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {label}<InfoTooltip text={tooltip} wide />
      </div>
      <div className={`font-mono text-xl font-bold ${colorClass}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

// ── Structure viewer placeholder ───────────────────────────────────────────

export function StructurePanel({
  structure,
  structureLoading,
  ctrlRef,
  wmRef,
}: {
  structure: StructureResponse | null;
  structureLoading: boolean;
  ctrlRef: React.RefObject<HTMLDivElement>;
  wmRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-lg text-slate-900 dark:text-white">3D Protein Structure</h2>
        <InfoTooltip
          text="ESMFold predicts the 3D fold from the amino acid sequence. Because TINSEL only changes synonymous codons, both DNAs encode the identical protein — so they fold into the identical 3D structure. This is the ultimate proof of losslessness."
          wide
        />
        {structureLoading && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Folding with ESMFold…
          </span>
        )}
      </div>

      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
        <strong>Key insight:</strong> Both viewers below render the <em>same</em> 3D structure.
        TINSEL preserves the amino acid sequence exactly, so control DNA and watermarked DNA
        fold into an <strong>identical protein</strong> — RMSD = 0.000 Å.
      </div>

      {structureLoading && (
        <div className="rounded-lg bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center h-48 gap-2 text-sm text-slate-400">
          <svg className="animate-spin h-6 w-6 text-blue-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          ESMFold computing structure…
          <span className="text-xs text-slate-400">This takes 15–30 s</span>
        </div>
      )}

      {structure && !structureLoading && (
        <div className="space-y-4">
          {structure.fallback ? (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              {structure.message}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { ref: ctrlRef, label: "Control DNA → Protein", sub: "Host-optimised reference" },
                  { ref: wmRef,   label: "Watermarked DNA → Protein", sub: "TINSEL-encoded sequence" },
                ].map(({ ref, label, sub }) => (
                  <div key={label} className="space-y-1.5">
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</div>
                    <div className="text-xs text-slate-400">{sub}</div>
                    <div ref={ref} className="w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700"
                      style={{ height: 280, background: "#0f172a" }} />
                  </div>
                ))}
              </div>

              {structure.plddt_per_residue && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    pLDDT Confidence Strip
                    <InfoTooltip text="Per-residue pLDDT from ESMFold. Blue ≥90 (very high), cyan 70–89 (confident), amber 50–69 (low), red <50 (disordered)." wide />
                  </div>
                  <PlddtStrip scores={structure.plddt_per_residue} />
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard label="Mean pLDDT" value={structure.plddt_mean?.toFixed(1) ?? "—"}
                  tooltip="Mean per-residue pLDDT. ≥70 = confident structure." good={(structure.plddt_mean ?? 0) >= 70} />
                <StatCard label="Instability Index" value={structure.instability_index?.toFixed(1) ?? "—"}
                  tooltip="Guruprasad 1990 instability index. >40 may indicate in-vivo instability." good={(structure.instability_index ?? 0) <= 40} />
                <StatCard label="Source" value={structure.fallback ? "Mock" : "ESMFold"}
                  tooltip="Whether the structure came from the real ESMFold Atlas API." good={!structure.fallback} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
