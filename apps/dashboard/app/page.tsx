"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useApiKey } from "../lib/providers";

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
    <div className="space-y-8">
      {/* Hero */}
      <div className="card p-8 bg-gradient-to-br from-blue-600 to-violet-600 dark:from-blue-700 dark:to-violet-700 text-white border-0">
        <h1 className="text-3xl font-bold mb-2">ArtGene TINSEL Registry</h1>
        <p className="text-blue-100 max-w-xl">
          Traceable Identity Notation for Sequence Encryption + Ledger. Watermark,
          certify, and audit synthetic gene sequences with cryptographic provenance.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/sequences" className="btn bg-white text-blue-700 hover:bg-blue-50">
            View Registry →
          </Link>
          {!apiKey && (
            <p className="text-xs text-blue-200 self-center">
              Set your API key in the top navigation to get started.
            </p>
          )}
        </div>
      </div>

      {/* Service status */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-500 dark:text-slate-400">Service status:</span>
        {health ? (
          <>
            <span
              className={`badge ${health.db === "connected" ? "badge-pass" : "badge-fail"}`}
            >
              DB {health.db}
            </span>
            <span
              className={`badge ${health.vault === "connected" ? "badge-pass" : "badge-fail"}`}
            >
              Vault {health.vault}
            </span>
            <span className="badge badge-skip">{health.env}</span>
          </>
        ) : (
          <span className="badge badge-skip">Connecting…</span>
        )}
      </div>

      {/* Stats */}
      {apiKey && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Certificates" value={totalCerts} color="blue" />
          <StatCard label="Certified" value={certified} color="green" />
          <StatCard label="Failed" value={failed} color="amber" />
          <StatCard
            label="Top Tier"
            value={tiers[0]?.[0] ?? "—"}
            sub={tiers[0] ? `${tiers[0][1]} sequences` : undefined}
            color="violet"
          />
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/sequences" className="card p-5 hover:border-blue-400 transition-colors group">
          <div className="text-2xl mb-2">🧬</div>
          <div className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
            Sequence Registry
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Browse and register TINSEL-certified gene sequences.
          </div>
        </Link>
        <div className="card p-5 opacity-60 cursor-not-allowed">
          <div className="text-2xl mb-2">🗺️</div>
          <div className="font-semibold text-slate-900 dark:text-white">
            Pathway Bundles
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Multi-gene Merkle bundles — coming in Phase 5.
          </div>
        </div>
      </div>
    </div>
  );
}
