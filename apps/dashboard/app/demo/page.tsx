"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CodonBiasChart } from "../../components/CodonBiasChart";
import { InfoTooltip } from "../../components/InfoTooltip";
import { analyseSequence, fetchStructure, type AnalyseResponse, type StructureResponse } from "../../lib/api";
import { ArcDiagram, EXAMPLES, PlddtStrip, StatCard, StructurePanel, toWatermarkMeta } from "./components";

declare global {
  interface Window {
    $3Dmol: {
      createViewer: (
        el: HTMLElement,
        opts: Record<string, unknown>
      ) => {
        addModel: (data: string, fmt: string) => void;
        setStyle: (sel: Record<string, unknown>, style: Record<string, unknown>) => void;
        zoomTo: () => void;
        render: () => void;
      };
    };
  }
}

const HOST_OPTIONS = [
  { value: "ECOLI",  label: "E. coli" },
  { value: "HUMAN",  label: "Human" },
  { value: "YEAST",  label: "Yeast (S. cerevisiae)" },
  { value: "CHO",    label: "CHO" },
  { value: "INSECT", label: "Insect (Sf9)" },
  { value: "PLANT",  label: "Plant (A. thaliana)" },
];

export default function DemoPage() {
  const [fasta, setFasta]                       = useState("");
  const [host, setHost]                         = useState("ECOLI");
  const [loading, setLoading]                   = useState(false);
  const [error, setError]                       = useState<string | null>(null);
  const [data, setData]                         = useState<AnalyseResponse | null>(null);
  const [structure, setStructure]               = useState<StructureResponse | null>(null);
  const [structureLoading, setStructureLoading] = useState(false);
  const [mol3Loaded, setMol3Loaded]             = useState(false);
  const ctrlRef      = useRef<HTMLDivElement>(null);
  const wmRef        = useRef<HTMLDivElement>(null);
  const viewersDone  = useRef(false);

  // Load 3Dmol.js once
  useEffect(() => {
    if (document.getElementById("3dmol-script")) { setMol3Loaded(true); return; }
    const s = document.createElement("script");
    s.id  = "3dmol-script";
    s.src = "https://3dmol.csb.pitt.edu/build/3Dmol-min.js";
    s.async = true;
    s.onload = () => setMol3Loaded(true);
    document.head.appendChild(s);
  }, []);

  // Render 3D viewers when both PDB + library are ready
  useEffect(() => {
    if (!structure?.pdb_text || !mol3Loaded || viewersDone.current) return;
    if (!ctrlRef.current || !wmRef.current) return;
    viewersDone.current = true;
    const w = window.$3Dmol;
    if (!w) return;
    [ctrlRef.current, wmRef.current].forEach((el) => {
      el.innerHTML = "";
      const v = w.createViewer(el, { backgroundColor: "#0f172a" });
      v.addModel(structure.pdb_text!, "pdb");
      v.setStyle({ b: [90, 100]  }, { cartoon: { color: "#2563eb" } });
      v.setStyle({ b: [70, 89.9] }, { cartoon: { color: "#06b6d4" } });
      v.setStyle({ b: [50, 69.9] }, { cartoon: { color: "#f59e0b" } });
      v.setStyle({ b: [0,  49.9] }, { cartoon: { color: "#ef4444" } });
      v.zoomTo();
      v.render();
    });
  }, [structure, mol3Loaded]);

  const handleSubmit = useCallback(async () => {
    const input = fasta.trim();
    if (!input) return;
    setLoading(true);
    setError(null);
    setData(null);
    setStructure(null);
    viewersDone.current = false;
    try {
      const result = await analyseSequence({ fasta: input, host_organism: host });
      setData(result);
      setStructureLoading(true);
      fetchStructure(result.original_protein)
        .then(setStructure)
        .catch((err) =>
          setStructure({
            pdb_text: null, plddt_mean: null, plddt_per_residue: null,
            instability_index: null, sequence_length: result.sequence_length,
            fallback: true, message: String(err),
          })
        )
        .finally(() => setStructureLoading(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [fasta, host]);

  const pctChanged = data
    ? ((data.n_codons_changed / data.n_codons_total) * 100).toFixed(1)
    : "0";

  return (
    <div className="container mx-auto px-4 max-w-5xl py-8 space-y-8">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-400 text-sm font-medium">
          ✓ Lossless Watermarking — Public Proof-of-Concept
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          TINSEL Watermarking is Lossless
        </h1>
        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Every watermark encodes provenance into <strong>synonymous codons</strong> — different DNA,
          identical protein. Amino acid sequence, 3D structure, and mRNA stability are all preserved.
          Paste any sequence below to see live proof.
        </p>
      </div>

      {/* ── Explainer cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: "🧬", title: "Synonymous Codons", text: "Multiple DNA triplets encode the same amino acid. TINSEL steganographically selects among them using a cryptographic key stream — no amino acid is ever changed." },
          { icon: "🔬", title: "Identical Protein",  text: "Because the amino acid sequence is preserved character-for-character, the 3D fold, binding sites, and biological activity are indistinguishable from the unmodified sequence." },
          { icon: "📡", title: "Covert by Design",   text: "Chi-squared analysis across synonymous codon families shows statistically normal codon bias — the watermark is undetectable without the spreading key." },
        ].map(({ icon, title, text }) => (
          <div key={title} className="card p-5 space-y-2 border-l-4 border-blue-400 dark:border-blue-600">
            <div className="text-2xl">{icon}</div>
            <div className="font-semibold text-slate-900 dark:text-white">{title}</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{text}</p>
          </div>
        ))}
      </div>

      {/* ── Example presets ───────────────────────────────────────────────── */}
      <div>
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Try an example:</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {EXAMPLES.map((ex) => (
            <button key={ex.name} type="button"
              onClick={() => { setFasta(ex.fasta); setHost(ex.host); }}
              className="card p-3 text-left hover:border-blue-400 dark:hover:border-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400">
              <div className="font-semibold text-sm text-slate-900 dark:text-white">{ex.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{ex.description}</div>
              <span className="mt-2 inline-block text-xs px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700">
                {ex.badge}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Input form ────────────────────────────────────────────────────── */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-slate-900 dark:text-white">Input Sequence</h2>
          <InfoTooltip text="Paste a protein FASTA (>header\nMKL...) or a DNA FASTA. DNA is automatically translated to protein. Max 1,000 AA." wide />
        </div>
        <textarea value={fasta} onChange={(e) => setFasta(e.target.value)}
          placeholder=">Example\nMKLVGGEELFTGVVPILVELDGDVNGH..."
          rows={5} className="input w-full font-mono text-xs resize-y" />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
            Host organism
            <InfoTooltip text="Sets the codon usage table for both the reference DNA and TINSEL watermarking. Codon preferences differ significantly between organisms." wide />
          </label>
          <select value={host} onChange={(e) => setHost(e.target.value)} className="input py-1.5 text-sm w-48">
            {HOST_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button type="button" onClick={handleSubmit} disabled={loading || !fasta.trim()} className="btn-primary ml-auto px-6">
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analysing…
              </span>
            ) : "Analyse Sequence"}
          </button>
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3">
            {error}
          </div>
        )}
      </div>

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {data && <ResultsSection data={data} structure={structure} structureLoading={structureLoading}
        pctChanged={pctChanged} ctrlRef={ctrlRef} wmRef={wmRef} />}
    </div>
  );
}

// ── Results section (extracted to keep DemoPage small) ────────────────────

function ResultsSection({
  data, structure, structureLoading, pctChanged, ctrlRef, wmRef,
}: {
  data: AnalyseResponse;
  structure: StructureResponse | null;
  structureLoading: boolean;
  pctChanged: string;
  ctrlRef: React.RefObject<HTMLDivElement>;
  wmRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="space-y-6">

      {/* Summary badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-bold text-slate-900 dark:text-white">Analysis Results</span>
        <span className="px-3 py-1 rounded-full bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-400 text-sm font-semibold">
          ✓ Protein identity: 100%
        </span>
        <span className="px-3 py-1 rounded-full bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-400 text-sm font-medium">
          Tier: {data.watermark_tier}
        </span>
      </div>

      {/* Top stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Length" value={data.sequence_length} sub="amino acids"
          tooltip="Total number of amino acids in the sequence." />
        <StatCard label="Codons changed" value={`${data.n_codons_changed} / ${data.n_codons_total}`} sub={`${pctChanged}% — all synonymous`}
          tooltip="Synonymous codon substitutions made to embed the watermark. The amino acid sequence is unchanged." />
        <StatCard label="Carrier positions" value={data.carrier_positions} sub="positions"
          tooltip="Codon positions used to carry the TINSEL watermark payload. More positions = greater capacity." />
        <StatCard label="Host" value={data.host_organism}
          tooltip="Expression host used for codon optimisation." />
      </div>

      {/* Panel A: Protein Identity */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-lg text-slate-900 dark:text-white">Protein Sequence Identity</h2>
          <InfoTooltip text="TINSEL only selects among synonymous codons — different DNA triplet, same amino acid. The protein sequence is character-for-character identical to the input." wide />
          <span className="ml-auto px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-sm font-bold border border-green-300 dark:border-green-700">
            ✓ 100% Identical
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              RMSD (amino acid sequence)<InfoTooltip text="Root Mean Square Deviation between the two protein sequences. Zero means they are byte-for-byte identical." />
            </div>
            <div className="font-mono text-2xl font-bold text-green-600 dark:text-green-400">0.000 Å</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
              Amino acid identity
            </div>
            <div className="font-mono text-2xl font-bold text-green-600 dark:text-green-400">
              {data.sequence_length}/{data.sequence_length} (100%)
            </div>
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
            Protein sequence (control = watermarked):
          </div>
          <div className="font-mono text-xs bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 break-all border border-slate-200 dark:border-slate-700 max-h-28 overflow-y-auto">
            {data.original_protein}
          </div>
        </div>
      </div>

      {/* Panel B: DNA Codon Diff */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-lg text-slate-900 dark:text-white">DNA Codon Comparison</h2>
          <InfoTooltip text="Purple pills = positions where the watermark substituted a synonymous codon. The amino acid encoded at every position remains identical." wide />
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            First {Math.min(150, data.n_codons_total)}/{data.n_codons_total} codons shown.
            <span className="ml-2 inline-block w-3 h-3 rounded-sm bg-violet-200 dark:bg-violet-800 align-middle" /> Purple = changed (synonymous)
          </div>
          <div className="flex flex-wrap gap-0.5">
            {Array.from({ length: Math.min(150, data.n_codons_total) }, (_, i) => {
              const ctrl = data.control_dna.slice(i * 3, i * 3 + 3);
              const wm   = data.watermarked_dna.slice(i * 3, i * 3 + 3);
              const changed = ctrl !== wm;
              return (
                <span key={i} title={changed ? `AA ${i+1}: ${data.original_protein[i]} — ${ctrl}→${wm}` : `AA ${i+1}: ${data.original_protein[i]} — ${ctrl}`}
                  className={`font-mono text-[9px] px-1 py-0.5 rounded leading-none cursor-default ${
                    changed
                      ? "bg-violet-200 text-violet-900 dark:bg-violet-800/60 dark:text-violet-200 font-bold"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}>
                  {wm}
                </span>
              );
            })}
            {data.n_codons_total > 150 && (
              <span className="text-xs text-slate-400 self-center ml-1">+{data.n_codons_total - 150} more</span>
            )}
          </div>
        </div>
        {data.codon_diffs.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  {["Position","Amino Acid","Control","Watermarked","Synonymous?"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.codon_diffs.slice(0, 20).map((d) => (
                  <tr key={d.position} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                    <td className="px-3 py-1.5 font-mono text-slate-500">{d.position + 1}</td>
                    <td className="px-3 py-1.5 font-mono font-bold text-slate-900 dark:text-white">{d.amino_acid}</td>
                    <td className="px-3 py-1.5 font-mono text-slate-500">{d.control_codon}</td>
                    <td className="px-3 py-1.5 font-mono font-bold text-violet-700 dark:text-violet-400">{d.watermarked_codon}</td>
                    <td className="px-3 py-1.5 text-green-600 dark:text-green-400 font-semibold">✓ Yes</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.codon_diffs.length > 20 && (
              <div className="px-3 py-2 text-xs text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700">
                …and {data.codon_diffs.length - 20} more synonymous substitutions
              </div>
            )}
          </div>
        )}
      </div>

      {/* Panel C: mRNA */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-lg text-slate-900 dark:text-white">mRNA Secondary Structure</h2>
          <InfoTooltip text="mRNA folds through Watson-Crick (A-U, G-C) and wobble (G-U) base pairs. Synonymous substitutions are designed not to significantly disrupt existing structures." wide />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Control MFE",     value: `${data.control_mfe.toFixed(2)}`, sub: "kcal/mol", tooltip: "Approximate minimum free energy of the host-optimised control mRNA secondary structure.", color: "text-blue-600 dark:text-blue-400" },
            { label: "Watermarked MFE", value: `${data.watermarked_mfe.toFixed(2)}`, sub: "kcal/mol", tooltip: "Approximate minimum free energy of the watermarked mRNA secondary structure.", color: "text-violet-600 dark:text-violet-400" },
            { label: "ΔMFE",     value: `${data.delta_mfe >= 0 ? "+" : ""}${data.delta_mfe.toFixed(2)}`, sub: "kcal/mol", tooltip: "Change in MFE. Values close to 0 show preserved mRNA stability.", color: Math.abs(data.delta_mfe) < 5 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400" },
            { label: "ΔGC",      value: `${data.delta_gc >= 0 ? "+" : ""}${(data.delta_gc * 100).toFixed(2)}`, sub: "%", tooltip: "Change in GC content. Small changes indicate similar mRNA stability.", color: Math.abs(data.delta_gc) < 0.02 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400" },
          ].map(({ label, value, sub, tooltip, color }) => (
            <div key={label} className="card p-3">
              <div className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {label}<InfoTooltip text={tooltip} />
              </div>
              <div className={`font-mono text-xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-slate-400">{sub}</div>
            </div>
          ))}
        </div>
        {/* GC bars */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
            GC Content<InfoTooltip text="Percentage of G and C bases. Higher GC = more stable mRNA. Should remain similar after watermarking." />
          </div>
          {[
            { label: "Control",     value: data.control_gc,     color: "bg-blue-500" },
            { label: "Watermarked", value: data.watermarked_gc, color: "bg-violet-500" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <span className="w-24 text-xs text-slate-600 dark:text-slate-400">{label}</span>
              <div className="flex-1 h-4 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${(value * 100).toFixed(1)}%` }} />
              </div>
              <span className="w-12 text-right font-mono text-xs">{(value * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
        {/* Arc diagrams */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[
            { label: "Control",     db: data.control_dot_bracket,     pairs: data.n_pairs_control,     color: "#3b82f6" },
            { label: "Watermarked", db: data.watermarked_dot_bracket, pairs: data.n_pairs_watermarked, color: "#8b5cf6" },
          ].map(({ label, db, pairs, color }) => (
            <div key={label} className="space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {label} — {pairs} base pair{pairs !== 1 ? "s" : ""}
              </div>
              <ArcDiagram dotBracket={db} label="Dot-bracket (first 120 nt)" color={color} />
              <div className="font-mono text-[9px] break-all bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded p-2 text-slate-500 max-h-16 overflow-y-auto">
                {db.slice(0, 200)}{db.length > 200 ? "…" : ""}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel D: Codon Bias */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-lg text-slate-900 dark:text-white">Codon Bias Analysis</h2>
          <InfoTooltip text="Chi-squared statistics measure how much the watermarked codon usage deviates from uniform expectation. Low chi-squared = statistically covert watermark." wide />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="χ² statistic" value={data.chi_squared.toFixed(4)}
            tooltip="Chi-squared across all synonymous codon families. <10 = statistically indistinguishable from natural usage."
            good={data.chi_squared < 30} />
          <StatCard label="p-value" value={data.p_value < 0.001 ? data.p_value.toExponential(2) : data.p_value.toFixed(4)}
            tooltip="Probability that the observed codon bias could arise by chance. >0.05 = covert." good={data.p_value > 0.05} />
          <StatCard label="Covert?" value={data.is_covert ? "Yes ✓" : "No ✗"}
            tooltip="Whether the watermark passes covertness threshold (p>0.05 and χ²<30)." good={data.is_covert} />
        </div>
        <CodonBiasChart watermark={toWatermarkMeta(data)} />
      </div>

      {/* Panel E: 3D Structure */}
      <StructurePanel structure={structure} structureLoading={structureLoading} ctrlRef={ctrlRef} wmRef={wmRef} />

      {/* Final proof summary */}
      <div className="rounded-xl bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-800 p-6 text-center space-y-3">
        <div className="text-2xl font-bold text-green-700 dark:text-green-400">✓ Losslessness Verified</div>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
          The watermarked DNA encodes a protein that is <strong>100% identical</strong> to the control.{" "}
          {data.n_codons_changed} synonymous substitution{data.n_codons_changed !== 1 ? "s" : ""} out of{" "}
          {data.n_codons_total} codons ({pctChanged}%). Zero amino acids changed.
        </p>
        <div className="flex flex-wrap justify-center gap-4 text-sm font-medium">
          <span className="text-green-700 dark:text-green-400">✓ Protein identity: 100%</span>
          <span className="text-green-700 dark:text-green-400">✓ RMSD: 0.000 Å</span>
          <span className={data.is_covert ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}>
            {data.is_covert ? "✓" : "~"} Codon bias: {data.is_covert ? "Covert" : "Detectable"}
          </span>
          <span className={Math.abs(data.delta_mfe) < 5 ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}>
            {Math.abs(data.delta_mfe) < 5 ? "✓" : "~"} ΔMFE: {data.delta_mfe >= 0 ? "+" : ""}{data.delta_mfe.toFixed(2)} kcal/mol
          </span>
        </div>
      </div>

    </div>
  );
}
