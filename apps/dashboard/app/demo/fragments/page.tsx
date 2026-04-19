"use client";

import { useState } from "react";
import {
  analyseFragments,
  type AssemblyResult,
  type FragmentScreenResult,
  type FragmentsResponse,
} from "../../../lib/api";

// ---------------------------------------------------------------------------
// Example fragments — three short sequences that assemble into a hazard
// ---------------------------------------------------------------------------

// Three fragments with 20-AA overlaps: A→B→C assembles into a 58-AA contig.
// Each fragment passes screening individually; the assembled product may flag
// if it resembles a known dangerous analogue.
const EXAMPLE_FASTA = `>fragment_1
MAEQKLISEEDLGIGKFLHSAGITGMLSEM
>fragment_2
DLGIGKFLHSAGITGMLSEMKWKLFKKIPKFLHLAK
>fragment_3
LSEMKWKLFKKIPKFLHLAKFKKLIPENDSEQ`;

const HOST_OPTIONS = [
  { value: "ECOLI", label: "E. coli" },
  { value: "HUMAN", label: "Human" },
  { value: "YEAST", label: "Yeast" },
];

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function verdictColor(v: string) {
  if (v === "BLOCKED") return "text-red-600 dark:text-red-400";
  if (v === "WARN") return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

function verdictBg(v: string) {
  if (v === "BLOCKED")
    return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/40";
  if (v === "WARN")
    return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40";
  return "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/40";
}

function statusBadgeClass(s: string) {
  if (s === "fail") return "badge-fail";
  if (s === "warn") return "badge-warn";
  if (s === "pass") return "badge-pass";
  return "badge-skip";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PrivacyBanner() {
  return (
    <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40 px-4 py-3 flex items-start gap-3 text-sm text-blue-800 dark:text-blue-300">
      <svg
        className="h-4 w-4 mt-0.5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
      <span>
        <strong>Your sequences are not stored.</strong> Fragments submitted here
        are analysed in memory only — nothing is saved, logged, or cached. To
        permanently register a sequence, use the{" "}
        <a href="/register" className="underline hover:text-blue-600">
          Register
        </a>{" "}
        page.
      </span>
    </div>
  );
}

function FragmentTable({ results }: { results: FragmentScreenResult[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="text-left py-2 pr-4 font-medium text-slate-500 dark:text-slate-400">
              Fragment
            </th>
            <th className="text-right py-2 px-3 font-medium text-slate-500 dark:text-slate-400">
              Length
            </th>
            <th className="text-center py-2 px-3 font-medium text-slate-500 dark:text-slate-400">
              Gate 2
            </th>
            <th className="text-center py-2 px-3 font-medium text-slate-500 dark:text-slate-400">
              Gate 4
            </th>
            <th className="text-center py-2 px-3 font-medium text-slate-500 dark:text-slate-400">
              Overall
            </th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr
              key={i}
              className="border-b border-slate-100 dark:border-slate-800 last:border-0"
            >
              <td className="py-2 pr-4 font-mono text-xs text-slate-700 dark:text-slate-200 max-w-[200px] truncate">
                {r.header}
              </td>
              <td className="py-2 px-3 text-right text-slate-500 dark:text-slate-400">
                {r.sequence_length} AA
              </td>
              <td className="py-2 px-3 text-center">
                <span className={statusBadgeClass(r.gate2_status)}>
                  {r.gate2_status.toUpperCase()}
                </span>
              </td>
              <td className="py-2 px-3 text-center">
                <span className={statusBadgeClass(r.gate4_status)}>
                  {r.gate4_status.toUpperCase()}
                </span>
              </td>
              <td className="py-2 px-3 text-center">
                <span className={statusBadgeClass(r.overall_status)}>
                  {r.overall_status.toUpperCase()}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssemblyCard({ result }: { result: AssemblyResult }) {
  return (
    <div className={`rounded-lg border p-4 space-y-3 ${verdictBg(result.risk_verdict)}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white">
          Assembled Product
        </h3>
        <span
          className={`text-lg font-bold ${verdictColor(result.risk_verdict)}`}
        >
          {result.risk_verdict}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <div className="card p-2 text-center">
          <div className="text-xs text-slate-500 dark:text-slate-400">Contigs</div>
          <div className="font-bold text-slate-900 dark:text-white">
            {result.contigs_found}
          </div>
        </div>
        <div className="card p-2 text-center">
          <div className="text-xs text-slate-500 dark:text-slate-400">Length</div>
          <div className="font-bold text-slate-900 dark:text-white">
            {result.assembled_length} AA
          </div>
        </div>
        <div className="card p-2 text-center">
          <div className="text-xs text-slate-500 dark:text-slate-400">Gate 2</div>
          <span className={statusBadgeClass(result.gate2_status)}>
            {result.gate2_status.toUpperCase()}
          </span>
        </div>
        <div className="card p-2 text-center">
          <div className="text-xs text-slate-500 dark:text-slate-400">Gate 4</div>
          <span className={statusBadgeClass(result.gate4_status)}>
            {result.gate4_status.toUpperCase()}
          </span>
        </div>
      </div>

      {(result.gate2_message || result.gate4_message) && (
        <div className="space-y-1">
          {result.gate2_message && (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              <span className="font-medium">Gate 2:</span> {result.gate2_message}
            </p>
          )}
          {result.gate4_message && (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              <span className="font-medium">Gate 4:</span> {result.gate4_message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ResultsPanel({ data }: { data: FragmentsResponse }) {
  return (
    <div className="space-y-4">
      {/* Summary message */}
      <div
        className={`rounded-lg border px-4 py-3 text-sm font-medium ${
          data.assembled_result?.risk_verdict === "BLOCKED"
            ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/40 text-red-700 dark:text-red-300"
            : data.assembled_result?.risk_verdict === "WARN"
            ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40 text-amber-700 dark:text-amber-300"
            : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/40 text-emerald-700 dark:text-emerald-300"
        }`}
      >
        {data.message}
      </div>

      {/* Per-fragment results */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
          Individual Fragment Screening
          <span className="ml-2 text-xs font-normal text-slate-400">
            ({data.fragment_count} fragment{data.fragment_count !== 1 ? "s" : ""} · Gates 2+4)
          </span>
        </h3>
        <FragmentTable results={data.fragment_results} />
      </div>

      {/* Assembly result */}
      {data.assembly_detected && data.assembled_result ? (
        <AssemblyCard result={data.assembled_result} />
      ) : (
        <div className="card p-4 text-sm text-slate-500 dark:text-slate-400">
          No assembly overlap detected (minimum 20 AA overlap required between
          fragments). Fragments were screened individually only.
        </div>
      )}

      {/* Overlap count */}
      {data.assembly_detected && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {data.overlaps_found} overlap{data.overlaps_found !== 1 ? "s" : ""} detected
          between submitted fragments.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FragmentsPage() {
  const [fasta, setFasta] = useState("");
  const [host, setHost] = useState("ECOLI");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FragmentsResponse | null>(null);

  async function handleSubmit() {
    const input = fasta.trim();
    if (!input) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await analyseFragments({
        fragments_fasta: input,
        host_organism: host,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Fragment Assembly Risk Screen
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Paste up to 50 protein fragments in FASTA format. Each fragment is
          screened individually (Gates 2+4), then overlapping fragments are
          assembled and the assembled product is re-screened. Catches sequences
          that are individually harmless but dangerous when combined.
        </p>
      </div>

      <PrivacyBanner />

      {/* Input */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Fragments (multi-FASTA)
          </label>
          <button
            onClick={() => setFasta(EXAMPLE_FASTA)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Load example
          </button>
        </div>

        <textarea
          value={fasta}
          onChange={(e) => setFasta(e.target.value)}
          placeholder={
            ">fragment_1\nMSEQKLISEEDL...\n>fragment_2\nEEDLGIGKFLHS..."
          }
          rows={10}
          className="w-full font-mono text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
          spellCheck={false}
        />

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 dark:text-slate-400">
              Host organism
            </label>
            <select
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1"
            >
              {HOST_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !fasta.trim()}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Screening…
              </>
            ) : (
              "Screen Fragments"
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card p-4 text-red-500 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {data && <ResultsPanel data={data} />}

      {/* How it works */}
      {!data && !loading && (
        <div className="card p-5 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <p className="font-medium text-slate-700 dark:text-slate-200">
            How it works
          </p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>
              Each fragment is screened individually through{" "}
              <strong>Gate 2</strong> (SecureDNA DOPRF + IBBIS hazard patterns)
              and <strong>Gate 4</strong> (cosine similarity to known dangerous
              protein analogues).
            </li>
            <li>
              Pairs of fragments with ≥ 20 AA overlap are detected and
              assembled into contigs.
            </li>
            <li>
              Each assembled contig is re-screened through Gates 2+4. A
              sequence that passes individually may fail when assembled.
            </li>
            <li>
              Additionally, any sequence submitted for{" "}
              <strong>registration</strong> is automatically cross-checked
              against all previously registered sequences — catching split
              synthesis attempts across different sessions, machines, or time.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
