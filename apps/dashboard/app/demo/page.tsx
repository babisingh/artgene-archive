"use client";

import { useState } from "react";
import type { AnalyseResponse, RecipientCopy } from "../../lib/api";
import { analyseSequence } from "../../lib/api";

const EXAMPLE_SEQUENCES = [
  {
    label: "GLP-1 Receptor Agonist",
    fasta: ">GLP1RA|demo\nHAEGTFTSDVSSYLEGQAAKEFIAWLVKGRCEGVLGDTFR",
  },
  {
    label: "Green Fluorescent Protein",
    fasta: ">GFP|demo\nMSKGEELFTGVVPILVELDGDVNGHKFSVSGEGEGDATYGKLTLKFICTTGKLPVPWPTLVTTLTYGVQCFSRYPDHMKQHDFFKSAMPEGYVQERTIFFKDDGNYKTRAEVKFEGDTLVNRIELKGIDFKEDGNILGHKLEYNYNSHNVYIMADKQKNGIKVNFKIRHNIEDGSVQLADHYQQNTPIGDGPVLLPDNHYLSTQSALSKDPNEKRDHMVLLEFVTAAGITLGMDELYK",
  },
  {
    label: "Human Insulin",
    fasta: ">Insulin|demo\nMALWMRLLPLLALLALWGPDPAAAFVNQHLCGSHLVEALYLVCGERGFFYTPKTRREAEDLQVGQVELGGGPGAGSLQPLALEGSLQKRGIVEQCCTSICSLYQLENYCN",
  },
];

const HOST_ORGANISMS = ["ECOLI", "HUMAN", "YEAST", "CHO", "INSECT", "PLANT"];

function CodonDiffStrip({ copy, label }: { copy: RecipientCopy; label: string }) {
  const diffs = copy.codon_diffs.slice(0, 12);
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
        {label} — {copy.n_codons_changed} synonymous substitutions
      </div>
      <div className="flex flex-wrap gap-1">
        {diffs.map((d, i) => (
          <div key={i} className="bg-slate-100 dark:bg-slate-700 rounded px-1.5 py-0.5 text-xs font-mono">
            <span className="text-slate-400">{d.amino_acid}{d.position}</span>{" "}
            <span className="text-rose-500">{d.original_codon}</span>
            <span className="text-slate-400">→</span>
            <span className="text-blue-500">{d.fingerprinted_codon}</span>
          </div>
        ))}
        {copy.codon_diffs.length > 12 && (
          <span className="text-xs text-slate-400 self-center">
            +{copy.codon_diffs.length - 12} more
          </span>
        )}
      </div>
    </div>
  );
}

function DnaPreview({
  label,
  dna,
  highlight,
}: {
  label: string;
  dna: string;
  highlight?: boolean;
}) {
  const preview = dna.slice(0, 90);
  return (
    <div
      className={`rounded-lg p-3 border ${
        highlight
          ? "border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30"
          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
      }`}
    >
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</div>
      <div className="font-mono text-xs text-slate-700 dark:text-slate-300 break-all">
        {preview}
        <span className="text-slate-400">…</span>
      </div>
    </div>
  );
}

function ResultsPanel({ data }: { data: AnalyseResponse }) {
  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Sequence length", value: `${data.sequence_length} AA` },
          { label: "Protein preserved", value: data.protein_preserved ? "✓ Yes" : "✗ No" },
          {
            label: "Positions differ (Copy A vs B)",
            value: data.n_codons_differ_between_copies,
          },
        ].map(({ label, value }) => (
          <div key={label} className="card p-3 text-center">
            <div className="text-xl font-bold text-slate-900 dark:text-white">{value}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* DNA previews */}
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-slate-900 dark:text-white">Codon Fingerprints</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Same protein. Different codon patterns per recipient. The fingerprint is invisible to
          translation — only the platform can distinguish the copies.
        </p>
        <DnaPreview label="Base (codon-optimised, no fingerprint)" dna={data.control_dna} />
        <DnaPreview
          label={`Copy for ${data.recipient_a.recipient_org}`}
          dna={data.recipient_a.dna}
          highlight
        />
        <DnaPreview
          label={`Copy for ${data.recipient_b.recipient_org}`}
          dna={data.recipient_b.dna}
        />
      </div>

      {/* Codon diffs */}
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-slate-900 dark:text-white">Synonymous Substitutions</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Every change is synonymous — same amino acid, different codon. Biology is unaffected.
        </p>
        <CodonDiffStrip copy={data.recipient_a} label={data.recipient_a.recipient_org} />
        <CodonDiffStrip copy={data.recipient_b} label={data.recipient_b.recipient_org} />
      </div>

      {/* Verify simulation */}
      <div className="card p-5 space-y-4 border-2 border-green-300 dark:border-green-700">
        <h3 className="font-semibold text-slate-900 dark:text-white">Verify Simulation</h3>
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-sm text-slate-600 dark:text-slate-300 italic">
          &ldquo;{data.verify_demo.scenario}&rdquo;
        </div>
        <div className="flex items-center gap-2">
          <span className="badge-pass">MATCH FOUND</span>
          <span className="text-sm text-slate-700 dark:text-slate-300">
            Traced to <strong>{data.verify_demo.matched_recipient}</strong> at{" "}
            <strong>{data.verify_demo.matched_org}</strong>
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {data.verify_demo.explanation}
        </p>
        <div className="text-xs text-slate-400 dark:text-slate-500 font-mono break-all">
          Submitted: {data.verify_demo.submitted_dna}
        </div>
      </div>

      {/* How it works */}
      <div className="card p-5 space-y-3">
        <h3 className="font-semibold text-slate-900 dark:text-white">How Provenance Tracing works</h3>
        <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-2 list-decimal list-inside">
          <li>Register your protein sequence in ArtGene Archive</li>
          <li>
            Issue a distribution copy for each recipient — each gets a unique codon fingerprint
          </li>
          <li>If a copy appears somewhere unexpected, paste it on the Verify Source page</li>
          <li>The platform checks the codon pattern against all fingerprints you have issued</li>
          <li>The matching recipient is identified — even without any metadata in the file</li>
        </ol>
      </div>

      {/* CTA */}
      <div className="card p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Ready to use it?</h3>
        <div className="flex flex-wrap gap-3">
          <a href="/register" className="btn-primary text-sm">
            Register a sequence
          </a>
          <a href="/sequences" className="btn-secondary text-sm">
            View my sequences
          </a>
          <a href="/verify" className="btn-secondary text-sm">
            Verify Source
          </a>
        </div>
      </div>
    </div>
  );
}

export default function DemoPage() {
  const [fasta, setFasta] = useState(EXAMPLE_SEQUENCES[0].fasta);
  const [host, setHost] = useState("ECOLI");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyseResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await analyseSequence({ fasta, host_organism: host });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Provenance Tracing Demo
        </h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
          See how ArtGene embeds a unique codon fingerprint into each distribution copy of your
          sequence — invisible to translation, detectable by the platform.
        </p>
        <div className="flex justify-center gap-2 flex-wrap">
          <span className="badge-pass">Same protein in all copies</span>
          <span className="badge-pass">Unique DNA per recipient</span>
          <span className="badge-pass">Leak attribution</span>
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            title: "Synonymous Codons",
            body: "Fingerprint is embedded by choosing among equivalent codons. The protein is identical in all copies.",
          },
          {
            title: "Per-Recipient Keys",
            body: "Each copy is generated with a unique HMAC-derived seed. No two recipients share the same codon pattern.",
          },
          {
            title: "Leak Attribution",
            body: "If a copy leaks, the Verify Source endpoint identifies which fingerprint it matches and who received it.",
          },
        ].map(({ title, body }) => (
          <div key={title} className="card p-4 space-y-1.5">
            <div className="font-semibold text-sm text-slate-900 dark:text-white">{title}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{body}</div>
          </div>
        ))}
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_SEQUENCES.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setFasta(s.fasta)}
              className="btn-secondary text-xs"
            >
              {s.label}
            </button>
          ))}
        </div>

        <div>
          <label
            htmlFor="demo-fasta"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Protein or DNA sequence (FASTA)
          </label>
          <textarea
            id="demo-fasta"
            rows={6}
            value={fasta}
            onChange={(e) => setFasta(e.target.value)}
            className="input w-full font-mono text-xs resize-y"
            placeholder=">MyProtein&#10;MSKGEELFTG..."
            required
          />
        </div>

        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label
              htmlFor="demo-host"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Host organism (codon optimisation)
            </label>
            <select
              id="demo-host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="input"
            >
              {HOST_ORGANISMS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="btn-primary"
          >
            {loading ? "Generating fingerprints…" : "Generate Distribution Copies"}
          </button>
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500">
          No authentication required. Sequences are analysed in memory and not stored.
        </p>

        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}
      </form>

      {data && <ResultsPanel data={data} />}
    </div>
  );
}
