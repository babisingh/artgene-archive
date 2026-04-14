"use client";

import { useEffect, useRef, useState } from "react";
import type { StructureResponse, WatermarkMetadata } from "../../lib/api";
import { InfoTooltip } from "../../components/InfoTooltip";
import type { AnalyseResponse } from "../../lib/api";

// ── SVG Icons ──────────────────────────────────────────────────────────────

export function IconDna({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 3.5C9 7 15 7.5 15 12s-6 5-8 8.5" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 3.5C15 7 9 7.5 9 12s6 5 8 8.5" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="9.5" y1="6.2" x2="14.5" y2="7.2" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="8.8" y1="9.8" x2="15.2" y2="9.8" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="8.8" y1="14.2" x2="15.2" y2="14.2" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="9.5" y1="17.8" x2="14.5" y2="16.8" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconProtein({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="5" cy="5" r="2" strokeWidth="1.5" />
      <circle cx="12" cy="3" r="2" strokeWidth="1.5" />
      <circle cx="19" cy="7" r="2" strokeWidth="1.5" />
      <circle cx="17" cy="15" r="2" strokeWidth="1.5" />
      <circle cx="9" cy="18" r="2" strokeWidth="1.5" />
      <circle cx="5" cy="20" r="1.5" strokeWidth="1.5" />
      <path d="M7 5h3M14 3.5l3 2M17 9v4M15 17l-4 1M7 18l-0.5 1" strokeLinecap="round" />
    </svg>
  );
}

export function IconLock({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconCheck({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function IconMrna({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M3 17 Q6 9 9 17 Q12 9 15 17 Q18 9 21 17" />
      <line x1="3" y1="17" x2="21" y2="17" strokeOpacity="0.3" />
    </svg>
  );
}

export function IconCodon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="5" height="7" rx="1" />
      <rect x="10" y="4" width="5" height="7" rx="1" />
      <rect x="17" y="4" width="4" height="7" rx="1" />
      <rect x="3" y="14" width="5" height="7" rx="1" className="fill-violet-200 dark:fill-violet-800/60" strokeOpacity="0.6" />
      <rect x="10" y="14" width="5" height="7" rx="1" />
      <rect x="17" y="14" width="4" height="7" rx="1" />
    </svg>
  );
}

export function IconStructure3D({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3L3 8.5v7L12 21l9-5.5v-7L12 3z" />
      <path d="M12 3v18M3 8.5l9 5L21 8.5" strokeOpacity="0.4" />
    </svg>
  );
}

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

// ── WatermarkMetadata adapter ──────────────────────────────────────────────

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
  dotBracket, label, color,
}: {
  dotBracket: string; label: string; color: string;
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
              ...{dotBracket.length - LIMIT} more
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
          { label: "Very high (>=90)", c: "#2563eb" },
          { label: "Confident (70-89)", c: "#06b6d4" },
          { label: "Low (50-69)", c: "#f59e0b" },
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

// ── Self-contained 3D viewer ───────────────────────────────────────────────
// Manages its own script loading and ref so there are no parent-ref timing issues.

export function Viewer3D({ pdbText, label, sublabel }: { pdbText: string; label: string; sublabel: string }) {
  const divRef = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);
  const [libReady, setLibReady] = useState(false);

  // Load 3Dmol.js exactly once per page
  useEffect(() => {
    if (typeof window !== "undefined" && (window as Window & typeof globalThis & { $3Dmol?: unknown }).$3Dmol) {
      setLibReady(true);
      return;
    }
    const existing = document.getElementById("3dmol-script");
    if (existing) {
      // Script tag exists — poll until window.$3Dmol is set
      const t = setInterval(() => {
        if ((window as Window & typeof globalThis & { $3Dmol?: unknown }).$3Dmol) {
          setLibReady(true);
          clearInterval(t);
        }
      }, 100);
      return () => clearInterval(t);
    }
    const s = document.createElement("script");
    s.id = "3dmol-script";
    s.src = "https://3dmol.csb.pitt.edu/build/3Dmol-min.js";
    s.async = true;
    s.onload = () => setLibReady(true);
    document.head.appendChild(s);
  }, []);

  // Render viewer once lib + div are both ready
  useEffect(() => {
    if (!libReady || !divRef.current || rendered.current) return;
    const w = (window as Window & typeof globalThis & { $3Dmol?: { createViewer: (el: HTMLElement, opts: object) => { addModel: (d: string, f: string) => void; setStyle: (sel: object, sty: object) => void; zoomTo: () => void; render: () => void } } }).$3Dmol;
    if (!w) return;
    rendered.current = true;
    const el = divRef.current;
    el.innerHTML = "";
    const v = w.createViewer(el, { backgroundColor: "#0f172a" });
    v.addModel(pdbText, "pdb");
    v.setStyle({ b: [90, 100]  }, { cartoon: { color: "#2563eb" } });
    v.setStyle({ b: [70, 89.9] }, { cartoon: { color: "#06b6d4" } });
    v.setStyle({ b: [50, 69.9] }, { cartoon: { color: "#f59e0b" } });
    v.setStyle({ b: [0,  49.9] }, { cartoon: { color: "#ef4444" } });
    v.zoomTo();
    v.render();
  }, [libReady, pdbText]);

  return (
    <div className="space-y-1.5">
      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</div>
      <div className="text-xs text-slate-400">{sublabel}</div>
      <div
        ref={divRef}
        style={{
          height: 300,
          minHeight: 300,
          maxHeight: 300,
          background: "#0f172a",
          overflow: "hidden",
          userSelect: "none",
          borderRadius: "0.5rem",
          border: "1px solid rgba(100,116,139,0.25)",
        }}
      />
      {!libReady && (
        <div className="text-xs text-slate-400 flex items-center gap-1">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading 3Dmol.js...
        </div>
      )}
    </div>
  );
}

// ── Structure panel ────────────────────────────────────────────────────────

export function StructurePanel({
  structure, structureLoading,
}: {
  structure: StructureResponse | null;
  structureLoading: boolean;
}) {
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <IconStructure3D className="w-5 h-5 text-blue-500" />
        <h2 className="font-semibold text-lg text-slate-900 dark:text-white">3D Protein Structure</h2>
        <InfoTooltip
          text="ESMFold predicts the 3D fold from the amino acid sequence. Because TINSEL only changes synonymous codons, both DNAs encode the identical protein and therefore fold into the identical 3D structure — the ultimate proof of losslessness."
          wide
        />
        {structureLoading && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Folding with ESMFold...
          </span>
        )}
      </div>

      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
        <strong>Key insight:</strong> Both viewers render the <em>same</em> 3D structure.
        TINSEL preserves the amino acid sequence exactly — control DNA and watermarked DNA
        fold into an <strong>identical protein</strong> (RMSD = 0.000 A).
      </div>

      {structureLoading && (
        <div className="rounded-lg bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center gap-2 text-sm text-slate-400"
          style={{ height: 300 }}>
          <svg className="animate-spin h-6 w-6 text-blue-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          ESMFold computing structure...
          <span className="text-xs">This takes 15-30 s</span>
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
                <Viewer3D pdbText={structure.pdb_text!} label="Control DNA -> Protein" sublabel="Host-optimised reference" />
                <Viewer3D pdbText={structure.pdb_text!} label="Watermarked DNA -> Protein" sublabel="TINSEL-encoded sequence" />
              </div>

              {structure.plddt_per_residue && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    pLDDT Confidence Strip
                    <InfoTooltip text="Per-residue pLDDT from ESMFold. Blue >=90 (very high), cyan 70-89 (confident), amber 50-69 (low), red <50 (disordered)." wide />
                  </div>
                  <PlddtStrip scores={structure.plddt_per_residue} />
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard label="Mean pLDDT" value={structure.plddt_mean?.toFixed(1) ?? "—"}
                  tooltip="Mean per-residue pLDDT. >=70 = confident structure." good={(structure.plddt_mean ?? 0) >= 70} />
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
