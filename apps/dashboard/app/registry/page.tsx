"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useApiKey } from "../../lib/providers";
import type { CertificateSummary } from "../../lib/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Status / tier badges
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "CERTIFIED" ? "badge-pass" : status === "FAILED" ? "badge-fail" : "badge-skip";
  return <span className={cls}>{status}</span>;
}

function TierBadge({ tier }: { tier: string }) {
  const cls = {
    FULL: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-400",
    STANDARD: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400",
    REDUCED: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400",
    MINIMAL: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
    REJECTED: "badge-fail",
  }[tier] ?? "badge-skip";
  return <span className={`badge ${cls}`}>{tier}</span>;
}

// ---------------------------------------------------------------------------
// Row skeleton
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-700/50">
      {[120, 72, 64, 120, 80, 72, 96].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"
            style={{ width: w }}
          />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Table row
// ---------------------------------------------------------------------------

function CertRow({ cert }: { cert: CertificateSummary }) {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
      <td className="px-4 py-3">
        <Link
          href={`/sequences/${cert.registry_id}`}
          className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {cert.registry_id}
        </Link>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={cert.status} />
      </td>
      <td className="px-4 py-3">
        <TierBadge tier={cert.tier} />
      </td>
      <td className="px-4 py-3 max-w-[12rem]">
        <span className="text-sm text-slate-600 dark:text-slate-400 truncate block">
          {cert.owner_id}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm capitalize text-slate-600 dark:text-slate-400">
          {cert.host_organism?.toLowerCase() ?? "—"}
        </span>
      </td>
      <td className="px-4 py-3">
        {cert.chi_squared != null ? (
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
            {cert.chi_squared.toFixed(4)}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {new Date(cert.timestamp).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/sequences/${cert.registry_id}`}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
        >
          Details →
        </Link>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Pagination controls
// ---------------------------------------------------------------------------

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  onPrev: () => void;
  onNext: () => void;
  loading?: boolean;
}

function Pagination({ page, totalPages, totalItems, onPrev, onNext, loading }: PaginationProps) {
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {loading
          ? "Loading…"
          : totalItems === 0
            ? "No certificates"
            : `${start}–${end} of ${totalItems}`}
      </span>
      <div className="flex gap-2">
        <button
          onClick={onPrev}
          disabled={page <= 1 || loading}
          className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
        >
          ← Prev
        </button>
        <span className="flex items-center px-2 text-xs text-slate-600 dark:text-slate-400">
          {page} / {Math.max(totalPages, 1)}
        </span>
        <button
          onClick={onNext}
          disabled={page >= totalPages || loading}
          className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RegistryPage() {
  const { client, apiKey } = useApiKey();
  const [page, setPage] = useState(1);
  const offset = (page - 1) * PAGE_SIZE;

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["certificates", page],
    queryFn: () => client.listCertificates(PAGE_SIZE, offset),
    placeholderData: (prev) => prev,
  });

  const totalItems = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            TINSEL Registry
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            All certified and rejected sequence registrations
          </p>
        </div>
        <Link href="/register" className="btn-primary" data-testid="new-registration-btn">
          + Register Sequence
        </Link>
      </div>

      {/* No API key warning */}
      {!apiKey && (
        <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Set your API key in the navigation bar to load certificates.
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="card p-8 text-center text-red-500 text-sm">
          {error instanceof Error ? error.message : "Failed to load certificates"}
        </div>
      )}

      {/* Table */}
      {!isError && (
        <div className={`card overflow-hidden transition-opacity ${isFetching ? "opacity-60" : ""}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  {["Registry ID", "Status", "Tier", "Owner", "Host", "χ²", "Date", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                  : data?.items.length === 0
                    ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-16 text-center text-slate-400 dark:text-slate-500">
                          No certificates yet.{" "}
                          <Link href="/register" className="text-blue-600 dark:text-blue-400 hover:underline">
                            Register your first sequence
                          </Link>
                        </td>
                      </tr>
                    )
                    : data?.items.map((cert) => (
                      <CertRow key={cert.registry_id} cert={cert} />
                    ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            loading={isLoading || isFetching}
          />
        </div>
      )}
    </div>
  );
}
