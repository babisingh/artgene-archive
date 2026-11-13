"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { RecordRow } from "../RecordRow";
import { fetchCatalogue, type CatalogueListResponse } from "../../lib/catalogue";

const RECENT = 5;

interface Snapshot {
  recent: CatalogueListResponse;
  catalogued: number;
  deposited: number;
  validated: number;
}

/**
 * The counts and the recent records, both from the catalogue list route.
 *
 * Four requests rather than one, because the API reports a total per query and
 * there is no summary endpoint. Each asks for the smallest page it can.
 *
 * With nothing published, every count is zero and the grid of zeros would say
 * less than one honest sentence, so the zero case renders that sentence
 * instead. Today that is the real state of the archive.
 */
async function loadSnapshot(): Promise<Snapshot> {
  const [recent, catalogued, deposited, validated] = await Promise.all([
    fetchCatalogue({ limit: RECENT }),
    fetchCatalogue({ limit: 1, kind: "catalogue" }),
    fetchCatalogue({ limit: 1, kind: "submission" }),
    fetchCatalogue({ limit: 1, validated: true }),
  ]);
  return {
    recent,
    catalogued: catalogued.count,
    deposited: deposited.count,
    validated: validated.count,
  };
}

export function CatalogueSnapshot() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["home-snapshot"],
    queryFn: loadSnapshot,
    staleTime: 60_000,
    retry: false,
  });

  if (isPending) {
    return (
      <p className="muted small" role="status">
        Reading the catalogue.
      </p>
    );
  }

  if (isError || !data) {
    return (
      <div className="notice notice-warn">
        The catalogue could not be read just now, so the counts below are not
        shown. Browsing may still work.
      </div>
    );
  }

  const total = data.recent.count;

  if (total === 0) {
    return (
      <div className="empty">
        <p className="h3">No records are published yet</p>
        <p className="muted" style={{ margin: "0 auto", maxWidth: 440 }}>
          The archive is open for submissions, and the first records are being
          prepared. Nothing is listed until a person has reviewed it.
        </p>
        <p style={{ marginBottom: 0, marginTop: 20 }}>
          <Link href="/submit" className="btn btn-primary">
            Submit a sequence
          </Link>
        </p>
      </div>
    );
  }

  const cells: { n: number; label: string }[] = [
    { n: total, label: total === 1 ? "record listed" : "records listed" },
    { n: data.catalogued, label: "catalogued from publications" },
    { n: data.deposited, label: "deposited with the archive" },
    { n: data.validated, label: "tested at the bench" },
  ];

  return (
    <>
      <div className="counts">
        {cells.map((cell) => (
          <div className="count-cell" key={cell.label}>
            <div className="count-n">{cell.n.toLocaleString("en-GB")}</div>
            <div className="count-label">{cell.label}</div>
          </div>
        ))}
      </div>

      <div className="section">
        <h2 className="h2">Recently added</h2>
        <ul className="record-list">
          {data.recent.items.map((item) => (
            <RecordRow key={item.registry_id} item={item} />
          ))}
        </ul>
        <p style={{ paddingTop: 20, marginBottom: 0 }}>
          <Link href="/sequences" className="btn btn-ghost">
            Browse the whole catalogue
          </Link>
        </p>
      </div>
    </>
  );
}
