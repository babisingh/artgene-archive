"use client";

import { useState } from "react";
import { useApiKey } from "../../lib/providers";
import type { VerifySourceResponse } from "../../lib/api";

const EXAMPLE_NOTICE = `Paste a DNA FASTA sequence from one of your issued distribution copies.
The system will check it against all fingerprints you have issued and tell
you which recipient it came from.`;

export default function VerifySourcePage() {
  const { client, apiKey } = useApiKey();
  const [fasta, setFasta] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifySourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await client.verifySource({ fasta });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed — please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!apiKey) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <div className="card p-8 text-center text-amber-600 dark:text-amber-400 text-sm">
          ⚠ No API key set — click <strong>Set API Key</strong> in the navigation bar.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Verify Source</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Identify which distribution copy a sequence came from. Each copy you issue carries a
          unique codon fingerprint — paste the DNA here to trace it back to the recipient.
        </p>
      </div>

      <div className="card p-5 space-y-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">How it works</p>
        <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
          <li>When you issue a distribution copy, a unique codon pattern is embedded in the DNA</li>
          <li>The pattern is invisible to translation — the protein is identical in all copies</li>
          <li>This endpoint checks the pattern against all fingerprints you have issued</li>
          <li>Only sequences from your own organisation&apos;s distributions are checked</li>
        </ul>
      </div>

      <form onSubmit={handleVerify} className="card p-5 space-y-4">
        <div>
          <label htmlFor="fasta-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Paste DNA sequence (FASTA format)
          </label>
          <textarea
            id="fasta-input"
            rows={10}
            value={fasta}
            onChange={e => setFasta(e.target.value)}
            placeholder={`>ArtGene-Provenance | seq=AG-2026-000001 | fingerprint=dist-abc123...\nATGAAAACCATCATCGCT...`}
            className="input w-full font-mono text-xs resize-y"
            required
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{EXAMPLE_NOTICE}</p>
        </div>

        {error && (
          <p className="text-sm text-red-500" role="alert">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !fasta.trim()}
          aria-busy={loading}
          className="btn-primary w-full"
        >
          {loading ? "Checking…" : "Check Source"}
        </button>
      </form>

      {result && (
        <div
          className={`card p-5 space-y-3 border-2 ${
            result.match_found
              ? "border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-950/30"
              : "border-slate-300 dark:border-slate-600"
          }`}
        >
          {result.match_found ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400 font-bold text-lg">Match Found</span>
                <span className="badge-pass">IDENTIFIED</span>
              </div>
              <div className="space-y-2 text-sm">
                <Row label="Sequence" value={result.sequence_id ?? "—"} />
                <Row label="Recipient" value={result.recipient_name ?? "—"} />
                <Row label="Organisation" value={result.recipient_org ?? "—"} />
                <Row label="Purpose" value={result.purpose ?? "—"} />
                <Row label="Issued" value={result.issued_at ? new Date(result.issued_at).toLocaleString() : "—"} />
                <Row label="Fingerprint ID" value={<span className="font-mono text-xs">{result.fingerprint_id}</span>} />
              </div>
              <p className="text-xs text-green-700 dark:text-green-400 border-t border-green-200 dark:border-green-800 pt-2">
                {result.message}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-slate-700 dark:text-slate-300 font-semibold">No Match</span>
                <span className="badge-skip">NOT FOUND</span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{result.message}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-500 dark:text-slate-400 shrink-0 w-32">{label}</span>
      <span className="text-slate-900 dark:text-slate-100 font-medium">{value}</span>
    </div>
  );
}
