"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useApiKey } from "../../lib/providers";
import type { CertificateSummary, CertificateStatus } from "../../lib/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

type StatusFilter = "all" | "certified" | "under-review" | "restricted";

function matchesStatusFilter(status: CertificateStatus, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "certified") return status === "CERTIFIED" || status === "CERTIFIED_WITH_WARNINGS";
  if (filter === "under-review") return status === "PENDING";
  if (filter === "restricted") return status === "FAILED" || status === "REVOKED";
  return true;
}

function StatusBadge({ status }: { status: CertificateStatus }) {
  if (status === "CERTIFIED")
    return <span className="badge badge-verify badge-dot">Certified</span>;
  if (status === "CERTIFIED_WITH_WARNINGS")
    return <span className="badge badge-warn badge-dot">Certified ⚠</span>;
  if (status === "PENDING")
    return <span className="badge badge-warn badge-dot">Under review</span>;
  if (status === "FAILED")
    return (
      <span className="badge badge-danger" style={{ gap: 5 }}>
        ◉ Failed
      </span>
    );
  if (status === "REVOKED")
    return (
      <span className="badge badge-danger" style={{ gap: 5 }}>
        ◉ Revoked
      </span>
    );
  return <span className="badge">{status}</span>;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <tr>
      {[130, 200, 110, 130, 80, 110, 36].map((w, i) => (
        <td key={i}>
          <div
            style={{
              height: 13,
              width: w,
              background: "var(--rule-2)",
              borderRadius: 2,
              animation: "pulse 1.5s ease-in-out infinite",
            }}
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
  const date = new Date(cert.timestamp).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <tr style={{ cursor: "pointer" }}>
      <td>
        <Link href={`/sequences/${cert.registry_id}`} className="id">
          {cert.registry_id}
        </Link>
      </td>
      <td>
        <div
          style={{
            fontSize: 13.5,
            color: "var(--ink)",
            fontWeight: 500,
            marginBottom: 2,
          }}
        >
          {cert.owner_id}
        </div>
      </td>
      <td style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
        {cert.host_organism ?? "—"}
      </td>
      <td>
        <StatusBadge status={cert.status} />
      </td>
      <td className="mono" style={{ fontSize: 11.5, color: "var(--ink-2)" }}>
        {cert.tier}
      </td>
      <td className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
        {date}
      </td>
      <td style={{ textAlign: "right", color: "var(--ink-3)" }}>
        <Link
          href={`/sequences/${cert.registry_id}`}
          aria-label={`View record ${cert.registry_id}`}
        >
          →
        </Link>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const FILTER_LABELS: [StatusFilter, string][] = [
  ["all", "All records"],
  ["certified", "Certified"],
  ["under-review", "Under review"],
  ["restricted", "Restricted"],
];

export default function RegistryPage() {
  const { client, apiKey } = useApiKey();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const offset = (page - 1) * PAGE_SIZE;

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["registry", page],
    queryFn: () => client.listCertificates(PAGE_SIZE, offset),
    placeholderData: (prev) => prev,
    enabled: !!apiKey,
  });

  const totalItems = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  const items = (data?.items ?? []).filter((cert) => {
    if (!matchesStatusFilter(cert.status, filter)) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        cert.registry_id.toLowerCase().includes(q) ||
        cert.owner_id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="route">
      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <section className="wrap" style={{ padding: "56px 0 32px" }}>
        <div
          className="flex between"
          style={{ alignItems: "end", gap: 24, flexWrap: "wrap" }}
        >
          <div>
            <div className="eyebrow mb-8">The Registry · Volume I</div>
            <h1
              className="display"
              style={{ fontSize: "clamp(40px, 5vw, 64px)", margin: 0 }}
            >
              {totalItems > 0 ? (
                <>
                  {totalItems.toLocaleString()} <em>registered</em>
                  <br />
                  sequences.
                </>
              ) : (
                <>
                  Sequence <em>Registry</em>
                </>
              )}
            </h1>
            <p className="lede mt-16" style={{ maxWidth: 560 }}>
              Every AI-designed biological sequence deposited to ArtGene is
              listed here. Records are public, citable by AG-ID, and carry a
              full biosafety scorecard.
            </p>
          </div>

          <div
            style={{
              textAlign: "right",
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "var(--ink-3)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              lineHeight: 1.9,
            }}
          >
            <div>
              Snapshot ·{" "}
              {new Date().toLocaleDateString("en-GB", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}{" "}
              UTC
            </div>
            <Link
              href="/register"
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 10 }}
            >
              + Deposit sequence
            </Link>
          </div>
        </div>
      </section>

      {/* ── No API key notice ────────────────────────────────────────────── */}
      {!apiKey && (
        <section className="wrap" style={{ paddingBottom: 24 }}>
          <div
            style={{
              padding: "12px 16px",
              background: "var(--accent-soft)",
              border:
                "0.5px solid color-mix(in oklab, var(--accent) 30%, transparent)",
              borderRadius: "var(--radius-lg)",
              fontSize: 13,
              color: "var(--ink-2)",
            }}
          >
            An API key is required to browse the registry.{" "}
            <Link
              href="/register"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              Register a sequence
            </Link>{" "}
            or set your key to continue.
          </div>
        </section>
      )}

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <section className="wrap" style={{ padding: "0 0 20px" }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: "14px 16px",
            background: "var(--paper-2)",
            border: "0.5px solid var(--rule)",
            borderRadius: 6,
            flexWrap: "wrap",
          }}
        >
          {/* Search input */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              paddingRight: 14,
              borderRight: "0.5px solid var(--rule)",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="6" cy="6" r="4.5" stroke="var(--ink-3)" />
              <path
                d="M10 10 L13 13"
                stroke="var(--ink-3)"
                strokeWidth="1.2"
              />
            </svg>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by AG-ID or institution…"
              aria-label="Search registry"
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: 13.5,
                width: 300,
                fontFamily: "var(--sans)",
                color: "var(--ink)",
              }}
            />
          </div>

          {/* Status filter tabs */}
          {FILTER_LABELS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => {
                setFilter(k);
                setPage(1);
              }}
              className="btn btn-sm"
              style={{
                background: filter === k ? "var(--ink)" : "transparent",
                color: filter === k ? "var(--paper)" : "var(--ink-2)",
                borderColor: filter === k ? "var(--ink)" : "var(--rule)",
                padding: "6px 12px",
              }}
            >
              {label}
            </button>
          ))}

          {/* Result count */}
          <div
            style={{
              marginLeft: "auto",
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "var(--ink-3)",
              letterSpacing: "0.06em",
            }}
          >
            {isLoading
              ? "Loading…"
              : `${String(items.length).padStart(2, "0")} / ${totalItems.toLocaleString()} results`}
          </div>
        </div>
      </section>

      {/* ── Error state ─────────────────────────────────────────────────── */}
      {isError && (
        <section className="wrap" style={{ paddingBottom: 40 }}>
          <div
            className="card"
            style={{
              textAlign: "center",
              color: "var(--danger)",
              padding: "32px 24px",
            }}
          >
            {error instanceof Error
              ? error.message
              : "Failed to load certificates"}
          </div>
        </section>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {!isError && (
        <section className="wrap" style={{ padding: "0 0 40px" }}>
          <div
            style={{
              background: "var(--paper-2)",
              border: "0.5px solid var(--rule)",
              borderRadius: 6,
              overflow: "hidden",
              opacity: isFetching ? 0.65 : 1,
              transition: "opacity 0.2s",
            }}
          >
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 150 }}>AG-ID</th>
                  <th>Institution</th>
                  <th style={{ width: 140 }}>Host</th>
                  <th style={{ width: 155 }}>Status</th>
                  <th style={{ width: 100 }}>Tier</th>
                  <th style={{ width: 120 }}>Deposited</th>
                  <th style={{ width: 48 }} />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: "64px 24px",
                        textAlign: "center",
                        color: "var(--ink-3)",
                        fontFamily: "var(--mono)",
                        fontSize: 12,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      {apiKey ? "No records match." : "API key required."}
                    </td>
                  </tr>
                ) : (
                  items.map((cert) => (
                    <CertRow key={cert.registry_id} cert={cert} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div
            className="flex between"
            style={{
              alignItems: "center",
              marginTop: 20,
              fontFamily: "var(--mono)",
              fontSize: 11.5,
              color: "var(--ink-3)",
              letterSpacing: "0.05em",
            }}
          >
            <div>
              PAGE {String(page).padStart(2, "0")} /{" "}
              {String(totalPages).padStart(4, "0")} · {PAGE_SIZE} PER PAGE
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading || isFetching}
              >
                ← Prev
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  setPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={page >= totalPages || isLoading || isFetching}
              >
                Next →
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
