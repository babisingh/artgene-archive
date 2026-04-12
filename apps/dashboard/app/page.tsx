"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useApiKey } from "../lib/providers";

// ---------------------------------------------------------------------------
// Stat card (live dashboard stats for logged-in users)
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  color = "blue",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: "blue" | "green" | "amber" | "violet";
}) {
  const accent = {
    blue: "border-blue-500 dark:border-blue-400",
    green: "border-emerald-500 dark:border-emerald-400",
    amber: "border-amber-500 dark:border-amber-400",
    violet: "border-violet-500 dark:border-violet-400",
  }[color];

  return (
    <div className={`card p-5 border-l-4 ${accent}`}>
      <div className="text-3xl font-bold text-slate-900 dark:text-white">{value}</div>
      <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-1">{label}</div>
      {sub && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gate feature card
// ---------------------------------------------------------------------------

function GateCard({
  number,
  title,
  description,
  icon,
}: {
  number: string;
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="card p-6 space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Gate {number}
          </div>
          <div className="font-semibold text-slate-900 dark:text-white">{title}</div>
        </div>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Homepage
// ---------------------------------------------------------------------------

export default function HomePage() {
  const { client, apiKey } = useApiKey();

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: () => client.health(),
    retry: false,
  });

  const { data: certs } = useQuery({
    queryKey: ["certificates"],
    queryFn: () => client.listCertificates(100, 0),
    enabled: Boolean(apiKey),
  });

  const totalCerts = certs?.count ?? 0;
  const certified = certs?.items.filter((c) => c.status === "CERTIFIED").length ?? 0;
  const failed = certs?.items.filter((c) => c.status === "FAILED").length ?? 0;
  const tiers = certs
    ? Object.entries(
        certs.items.reduce<Record<string, number>>((acc, c) => {
          acc[c.tier] = (acc[c.tier] ?? 0) + 1;
          return acc;
        }, {})
      )
    : [];

  return (
    <div className="space-y-16">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative rounded-2xl overflow-hidden">
        <div className="card p-10 sm:p-16 bg-gradient-to-br from-blue-600 via-blue-700 to-violet-700
                        dark:from-blue-800 dark:via-blue-900 dark:to-violet-900 text-white border-0">
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-blue-400/20 blur-3xl" />
          </div>

          <div className="relative z-10 max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20
                            rounded-full px-3 py-1 text-xs font-medium text-blue-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              TINSEL Registry v1.0 — Now in beta
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight">
              Cryptographic provenance<br />for synthetic DNA
            </h1>

            <p className="text-lg text-blue-100 leading-relaxed">
              ArtGene embeds invisible, tamper-evident watermarks into synthetic gene sequences
              and certifies them through automated biosafety screening — creating a transparent,
              auditable chain of custody from lab bench to regulatory submission.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/register"
                className="btn bg-white text-blue-700 hover:bg-blue-50 font-semibold shadow"
              >
                Register a Sequence →
              </Link>
              <Link
                href="/getting-started"
                className="btn bg-white/10 border border-white/30 text-white hover:bg-white/20"
              >
                How it works
              </Link>
            </div>

            {!apiKey && (
              <p className="text-xs text-blue-200">
                Set your API key in the navigation bar to access the registry.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Service status ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 text-sm -mt-8">
        <span className="text-slate-500 dark:text-slate-400">Service status:</span>
        {health ? (
          <>
            <span className={`badge ${health.db === "connected" ? "badge-pass" : "badge-fail"}`}>
              DB {health.db}
            </span>
            <span className={`badge ${health.vault === "connected" ? "badge-pass" : "badge-fail"}`}>
              Vault {health.vault}
            </span>
            <span className="badge badge-skip">{health.env}</span>
          </>
        ) : (
          <span className="badge badge-skip">Connecting…</span>
        )}
      </div>

      {/* ── Live stats (authenticated users only) ─────────────────────────── */}
      {apiKey && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Registry Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Certificates" value={totalCerts} color="blue" />
            <StatCard label="Certified" value={certified} color="green" />
            <StatCard label="Failed / Rejected" value={failed} color="amber" />
            <StatCard
              label="Top Tier"
              value={tiers[0]?.[0] ?? "—"}
              sub={tiers[0] ? `${tiers[0][1]} sequences` : undefined}
              color="violet"
            />
          </div>
        </section>
      )}

      {/* ── Mission / Why ArtGene ─────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
            Why synthetic biology needs a provenance layer
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Synthetic gene sequences can be copied, modified, and misrepresented with no trace of
            their origin. As gene synthesis becomes cheaper and more accessible, the gap between
            legitimate research and potential misuse widens. ArtGene was built to close that gap.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              icon: "🔏",
              title: "Steganographic watermarking",
              body: "TINSEL encodes a cryptographically signed identity payload into the codon usage pattern of a protein — invisible to standard sequence analysis tools, yet mathematically verifiable.",
            },
            {
              icon: "🛡️",
              title: "Three-gate biosafety screening",
              body: "Every sequence passes structural analysis, off-target toxin/allergen screening, and ecological risk assessment before a certificate is issued. No gate can be bypassed.",
            },
            {
              icon: "📜",
              title: "Immutable certificate chain",
              body: "Each certificate carries a SHA3-512 hash of its full provenance record, binding the watermarked sequence to the researcher, institution, ethics code, and timestamp.",
            },
          ].map(({ icon, title, body }) => (
            <div key={title} className="card p-6 space-y-3">
              <div className="text-3xl">{icon}</div>
              <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Biosafety gates ───────────────────────────────────────────────── */}
      <section className="space-y-5">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Automated biosafety pipeline
        </h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-2xl">
          All three gates run automatically on every submission. Results are embedded in the
          certificate and visible in the registry.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <GateCard
            number="1"
            title="Structural Analysis"
            icon="🔬"
            description="ESMFold pLDDT confidence scores and RNA minimum free energy (ΔMFE) assess whether the protein is predicted to fold into a hazardous structure such as an amyloid or prion-like aggregate."
          />
          <GateCard
            number="2"
            title="Off-Target Screening"
            icon="🧪"
            description="BLAST similarity search against known toxin and select-agent databases. ToxinPred2 and allergen models score the probability of harmful biological activity."
          />
          <GateCard
            number="3"
            title="Ecological Risk"
            icon="🌍"
            description="Horizontal gene transfer (HGT) propensity and DriftRadar ecological-spread modelling estimate the risk of environmental release and persistence if the organism escaped containment."
          />
        </div>
      </section>

      {/* ── Quick navigation ──────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            href: "/register",
            icon: "➕",
            title: "Register a Sequence",
            sub: "Submit a FASTA sequence for TINSEL watermarking and biosafety certification.",
          },
          {
            href: "/sequences",
            icon: "🧬",
            title: "Sequence Registry",
            sub: "Browse all certified and rejected sequences with full gate reports.",
          },
          {
            href: "/getting-started",
            icon: "📖",
            title: "Getting Started",
            sub: "Step-by-step guide to the TINSEL workflow, χ² scoring, and tier system.",
          },
        ].map(({ href, icon, title, sub }) => (
          <Link
            key={href}
            href={href}
            className="card p-5 hover:border-blue-400 dark:hover:border-blue-500 transition-colors group"
          >
            <div className="text-2xl mb-2">{icon}</div>
            <div className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {title}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{sub}</div>
          </Link>
        ))}
      </section>

    </div>
  );
}
