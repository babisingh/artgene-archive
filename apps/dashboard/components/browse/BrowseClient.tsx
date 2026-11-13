"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RecordRow } from "../RecordRow";
import {
  MOLECULE_LABELS,
  MOLECULE_TYPES,
  fetchCatalogue,
  type CatalogueQuery,
} from "../../lib/catalogue";

const PAGE = 20;

/** The filters a visitor can set, read from and written to the URL. */
interface Filters {
  q: string;
  kind: string;
  molecule_type: string;
  model: string;
  validated: boolean;
  offset: number;
}

function readFilters(params: URLSearchParams): Filters {
  const offset = Number.parseInt(params.get("offset") ?? "0", 10);
  return {
    q: params.get("q") ?? "",
    kind: params.get("kind") ?? "",
    molecule_type: params.get("molecule_type") ?? "",
    model: params.get("model") ?? "",
    validated: params.get("validated") === "true",
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
  };
}

function toQueryString(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.molecule_type) params.set("molecule_type", filters.molecule_type);
  if (filters.model) params.set("model", filters.model);
  if (filters.validated) params.set("validated", "true");
  if (filters.offset) params.set("offset", String(filters.offset));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Whether the visitor narrowed anything, which decides which empty state to show. */
function isNarrowed(filters: Filters): boolean {
  return Boolean(
    filters.q || filters.kind || filters.molecule_type || filters.model || filters.validated,
  );
}

export function BrowseClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = readFilters(new URLSearchParams(searchParams.toString()));

  // The two text inputs are typed into before they are applied, so they hold
  // their own state and the URL is updated when the form is submitted.
  const [q, setQ] = useState(filters.q);
  const [model, setModel] = useState(filters.model);

  // Keep the inputs in step when the URL changes under them, for instance on
  // a back navigation or when the search box on the home page sends a query.
  useEffect(() => {
    setQ(filters.q);
    setModel(filters.model);
  }, [filters.q, filters.model]);

  function apply(next: Partial<Filters>) {
    const merged: Filters = { ...filters, ...next };
    // Any change to the query itself returns to the first page: staying on
    // page three of a different result set shows an empty list for no reason.
    if (next.offset === undefined) merged.offset = 0;
    router.push(`/sequences${toQueryString(merged)}`, { scroll: false });
  }

  const query: CatalogueQuery = {
    q: filters.q || undefined,
    kind: filters.kind || undefined,
    molecule_type: filters.molecule_type || undefined,
    model: filters.model || undefined,
    validated: filters.validated || undefined,
    limit: PAGE,
    offset: filters.offset,
  };

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["catalogue", query],
    queryFn: () => fetchCatalogue(query),
    retry: false,
  });

  const narrowed = isNarrowed(filters);
  const total = data?.count ?? 0;
  const from = total === 0 ? 0 : filters.offset + 1;
  const to = Math.min(filters.offset + PAGE, total);

  return (
    <div className="wrap page">
      <h1 className="h1" style={{ fontSize: "clamp(28px, 5vw, 40px)" }}>
        Browse the catalogue
      </h1>
      <p className="lede" style={{ maxWidth: 620 }}>
        Every published record in the archive, catalogued from the literature or
        deposited here by its authors.
      </p>

      <form
        className="search-row"
        role="search"
        style={{ maxWidth: 560, marginBottom: 20 }}
        onSubmit={(event) => {
          event.preventDefault();
          apply({ q: q.trim() });
        }}
      >
        <input
          className="input"
          type="search"
          value={q}
          aria-label="Search the catalogue"
          placeholder="Search titles, venues and models"
          onChange={(event) => setQ(event.target.value)}
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      <div className="filters">
        <div>
          <label className="label" htmlFor="filter-kind">
            Kind of record
          </label>
          <select
            id="filter-kind"
            className="select"
            value={filters.kind}
            onChange={(event) => apply({ kind: event.target.value })}
          >
            <option value="">Any</option>
            <option value="catalogue">Catalogued from a publication</option>
            <option value="submission">Deposited with the archive</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="filter-molecule">
            Molecule type
          </label>
          <select
            id="filter-molecule"
            className="select"
            value={filters.molecule_type}
            onChange={(event) => apply({ molecule_type: event.target.value })}
          >
            <option value="">Any</option>
            {MOLECULE_TYPES.map((type) => (
              <option key={type} value={type}>
                {MOLECULE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="filter-model">
            Generating model
          </label>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              apply({ model: model.trim() });
            }}
          >
            <input
              id="filter-model"
              className="input"
              value={model}
              placeholder="Any model"
              onChange={(event) => setModel(event.target.value)}
              onBlur={() => {
                if (model.trim() !== filters.model) apply({ model: model.trim() });
              }}
            />
          </form>
        </div>

        <label className="filter-check" htmlFor="filter-validated">
          <input
            id="filter-validated"
            type="checkbox"
            checked={filters.validated}
            onChange={(event) => apply({ validated: event.target.checked })}
          />
          Wet-lab validated only
        </label>
      </div>

      <div style={{ paddingTop: 24 }}>
        {isPending ? (
          <p className="muted small" role="status">
            Reading the catalogue.
          </p>
        ) : isError ? (
          <div className="notice notice-warn">
            <p style={{ margin: 0 }}>
              The catalogue could not be read.{" "}
              {error instanceof Error ? error.message : ""}
            </p>
          </div>
        ) : total === 0 && narrowed ? (
          <div className="empty">
            <p className="h3">No records match</p>
            <p className="muted" style={{ margin: "0 auto", maxWidth: 420 }}>
              Nothing in the catalogue matches what you asked for. Try fewer
              filters, or a shorter search.
            </p>
            <p style={{ marginBottom: 0, marginTop: 20 }}>
              <Link href="/sequences" className="btn btn-ghost">
                Clear all filters
              </Link>
            </p>
          </div>
        ) : total === 0 ? (
          <div className="empty">
            <p className="h3">No records are published yet</p>
            <p className="muted" style={{ margin: "0 auto", maxWidth: 440 }}>
              The archive is open for submissions, and the first records are
              being prepared. Nothing is listed until a person has reviewed it.
            </p>
            <p style={{ marginBottom: 0, marginTop: 20 }}>
              <Link href="/submit" className="btn btn-primary">
                Submit a sequence
              </Link>
            </p>
          </div>
        ) : (
          <>
            <p className="xsmall muted" style={{ marginTop: 0 }}>
              Showing {from} to {to} of {total.toLocaleString("en-GB")}
              {total === 1 ? " record" : " records"}
            </p>
            <ul className="record-list">
              {data?.items.map((item) => (
                <RecordRow key={item.registry_id} item={item} />
              ))}
            </ul>

            {total > PAGE ? (
              <div className="pager">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={filters.offset === 0}
                  onClick={() =>
                    apply({ offset: Math.max(0, filters.offset - PAGE) })
                  }
                >
                  Previous
                </button>
                <span className="xsmall muted">
                  Page {Math.floor(filters.offset / PAGE) + 1} of{" "}
                  {Math.ceil(total / PAGE)}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={to >= total}
                  onClick={() => apply({ offset: filters.offset + PAGE })}
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
