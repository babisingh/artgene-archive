"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KindBadge } from "../Accession";
import {
  CatalogueError,
  HOST_LABELS,
  LICENSE_LABELS,
  MOLECULE_LABELS,
  fetchRecord,
  formatDate,
  formatLength,
  type CatalogueRecord,
  type Gate,
} from "../../lib/catalogue";

const CONTACT = "b@genethropic.com";

/** Readable names for the gate rows the API shows the public. */
const GATE_LABELS: Record<string, string> = {
  "attribution/complete": "Attribution",
  "license/redistribution": "Licence and redistribution",
  "license/enquiry": "Licence enquiry",
  "biosafety/screening": "Biosafety screening",
};

function gateLabel(gate: Gate): string {
  return (
    GATE_LABELS[`${gate.gate_family}/${gate.gate_key}`] ??
    `${gate.gate_family}: ${gate.gate_key}`
  );
}

function outcomeBadge(outcome: string) {
  const className =
    outcome === "pass"
      ? "badge badge-verify"
      : outcome === "fail"
        ? "badge badge-danger"
        : outcome === "warn" || outcome === "advisory"
          ? "badge badge-warn"
          : "badge";
  return <span className={className}>{outcome}</span>;
}

/** A row in a definition list, left out entirely when there is nothing to say. */
function Row({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function orcidUrl(orcid: string): string {
  return `https://orcid.org/${orcid}`;
}

/**
 * A citation for the record, built from what the source says.
 *
 * For an AGC record that is the paper. For an AG record the archive is the
 * venue, which is what the API records as the container, so the same builder
 * serves both.
 */
function citationFor(record: CatalogueRecord): string {
  const source = record.source;
  if (!source) return record.registry_id;

  const names = source.authors.map((author) => author.full_name);
  const authorPart =
    names.length === 0
      ? ""
      : names.length <= 3
        ? names.join(", ")
        : `${names[0]} and others`;

  const year = source.published_on
    ? new Date(source.published_on).getUTCFullYear()
    : null;

  const parts = [
    authorPart,
    year ? `(${year})` : null,
    source.title,
    source.container,
    source.doi ? `https://doi.org/${source.doi}` : source.url,
    `ArtGene Archive ${record.registry_id}`,
  ].filter(Boolean);

  return `${parts.join(". ")}.`;
}

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("done");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 2500);
      }}
    >
      {state === "done"
        ? "Copied"
        : state === "failed"
          ? "Could not copy, select it instead"
          : "Copy citation"}
    </button>
  );
}

export function RecordClient({ id }: { id: string }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["record", id],
    queryFn: () => fetchRecord(id),
    retry: false,
  });

  if (isPending) {
    return (
      <div className="wrap page">
        <p className="muted small" role="status">
          Reading the record.
        </p>
      </div>
    );
  }

  if (isError || !data) {
    const notFound = error instanceof CatalogueError && error.status === 404;
    return (
      <div className="wrap page">
        <p className="crumbs">
          <Link href="/sequences">Browse</Link>
        </p>
        <h1 className="h2">{notFound ? "No such record" : "This record could not be read"}</h1>
        <p className="muted" style={{ maxWidth: 560 }}>
          {notFound ? (
            <>
              Nothing is published under <span className="accession">{id}</span>.
              Either that accession does not exist, or the record has not been
              published yet. Records are not public until a person has reviewed
              them.
            </>
          ) : (
            (error instanceof Error ? error.message : "Please try again.")
          )}
        </p>
        <Link href="/sequences" className="btn btn-ghost">
          Browse the catalogue
        </Link>
      </div>
    );
  }

  const record = data;
  const { source, design, sequence } = record;
  const molecule = MOLECULE_LABELS[record.molecule_type] ?? record.molecule_type;
  const citation = citationFor(record);
  const withheld = sequence?.withheld ?? false;
  const held = sequence?.held ?? false;

  const hitRate =
    design &&
    (design.n_designed !== null ||
      design.n_tested !== null ||
      design.n_functional !== null)
      ? design
      : null;

  const correctionHref = `mailto:${CONTACT}?subject=${encodeURIComponent(
    `Correction or removal: ${record.registry_id}`,
  )}`;

  return (
    <div className="wrap page">
      <p className="crumbs">
        <Link href="/sequences">Browse</Link> / {record.registry_id}
      </p>

      {/* --- Summary ------------------------------------------------------ */}
      <div className="record-head">
        <span className="accession" style={{ fontSize: 16 }}>
          {record.registry_id}
        </span>
        <KindBadge kind={record.record_kind} />
        <span className="badge">{molecule}</span>
        {design?.wet_lab_validated ? (
          <span
            className="badge badge-verify"
            title="The authors reported testing this sequence at the bench."
          >
            Wet-lab validated
          </span>
        ) : null}
        {withheld ? <span className="badge badge-warn">Sequence withheld</span> : null}
      </div>

      <h1 className="h1" style={{ fontSize: "clamp(26px, 4.6vw, 38px)", marginTop: 14 }}>
        {record.title}
      </h1>

      {record.summary ? (
        <p className="lede" style={{ maxWidth: 680 }}>
          {record.summary}
        </p>
      ) : null}

      {withheld ? (
        <div className="notice notice-warn" style={{ marginTop: 8 }}>
          <h2 className="h3">The sequence is withheld</h2>
          <p style={{ margin: "0 0 8px" }}>{record.hosting_reason}</p>
          <p style={{ margin: 0 }}>
            The record is listed so that a withheld sequence does not look like
            work that never happened. The archive does not publish the detail of
            a screening decision, and parts of this record are left out for the
            same reason.
          </p>
        </div>
      ) : null}

      {/* --- Source and citation ------------------------------------------ */}
      <section className="record-section">
        <h2 className="h2">Source and citation</h2>
        {record.record_kind === "catalogue" ? (
          <p className="small muted" style={{ maxWidth: 620 }}>
            This sequence was reported elsewhere. The publication below is the
            primary record, and this entry describes what the archive read in
            it.
          </p>
        ) : (
          <p className="small muted" style={{ maxWidth: 620 }}>
            This sequence was deposited with the archive by its authors, so the
            archive holds the primary copy and this entry is the record to cite.
          </p>
        )}

        {source ? (
          <>
            <dl className="kv">
              <Row label="Title">{source.title}</Row>
              <Row label="Authors">
                {source.authors.length === 0
                  ? null
                  : source.authors.map((author, index) => (
                      <span key={`${author.full_name}-${index}`}>
                        {index > 0 ? "; " : ""}
                        {author.orcid ? (
                          <a
                            className="link"
                            href={orcidUrl(author.orcid)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`ORCID ${author.orcid}`}
                          >
                            {author.full_name}
                          </a>
                        ) : (
                          author.full_name
                        )}
                        {author.affiliation ? (
                          <span className="muted"> ({author.affiliation})</span>
                        ) : null}
                        {author.is_corresponding ? (
                          <span className="muted"> corresponding</span>
                        ) : null}
                      </span>
                    ))}
              </Row>
              <Row label="Venue">{source.container}</Row>
              <Row label="Date">{formatDate(source.published_on)}</Row>
              <Row label="Version">{source.version}</Row>
              <Row label="Peer reviewed">
                {source.peer_reviewed ? "Yes" : "Not stated as peer reviewed"}
              </Row>
              <Row label="DOI">
                {source.doi ? (
                  <a
                    className="link mono"
                    href={`https://doi.org/${source.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.doi}
                  </a>
                ) : null}
              </Row>
              <Row label="Link">
                {source.url ? (
                  <a
                    className="link"
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.url}
                  </a>
                ) : null}
              </Row>
              <Row label="Article licence">
                {source.article_license
                  ? (LICENSE_LABELS[source.article_license] ?? source.article_license)
                  : null}
              </Row>
            </dl>

            <div style={{ marginTop: 20 }}>
              <p className="label">Cite this record</p>
              <p className="cite">{citation}</p>
              <div style={{ marginTop: 10 }}>
                <CopyButton text={citation} />
              </div>
            </div>
          </>
        ) : (
          <p className="muted">The archive holds no source details for this record.</p>
        )}
      </section>

      {/* --- Design ------------------------------------------------------- */}
      <section className="record-section">
        <h2 className="h2">Design</h2>
        {design ? (
          <dl className="kv">
            <Row label="Generating model">{design.generating_model}</Row>
            <Row label="Model version">{design.model_version}</Row>
            <Row label="Model availability">{design.model_availability}</Row>
            <Row label="Design method">{design.design_method}</Row>
            <Row label="Design target">{design.design_target}</Row>
            {hitRate ? (
              <Row label="Designed, tested, functional">
                <span className="hitrate">
                  <span>
                    <span className="n">{hitRate.n_designed ?? "not stated"}</span> designed
                  </span>
                  <span className="arrow" aria-hidden="true">
                    &rarr;
                  </span>
                  <span>
                    <span className="n">{hitRate.n_tested ?? "not stated"}</span> tested
                  </span>
                  <span className="arrow" aria-hidden="true">
                    &rarr;
                  </span>
                  <span>
                    <span className="n">{hitRate.n_functional ?? "not stated"}</span> functional
                  </span>
                </span>
              </Row>
            ) : null}
            <Row label="Assays">
              {design.assays.length > 0 ? design.assays.join(", ") : null}
            </Row>
            <Row label="Expression host">
              {design.expression_host
                ? (HOST_LABELS[design.expression_host] ?? design.expression_host)
                : null}
            </Row>
            <Row label="Wet-lab validated">
              {design.wet_lab_validated
                ? "Yes, the authors reported testing it at the bench"
                : "Not reported as tested at the bench"}
            </Row>
          </dl>
        ) : (
          <p className="muted">The archive holds no design details for this record.</p>
        )}
      </section>

      {/* --- Screening ---------------------------------------------------- */}
      <section className="record-section">
        <h2 className="h2">Screening</h2>
        <p className="small muted" style={{ maxWidth: 620 }}>
          The checks the archive ran on this record before listing it. Screening
          is a filter, not a safety guarantee, and the archive does not publish
          which check caught a sequence.
        </p>
        {record.gates.length > 0 ? (
          <div>
            {record.gates.map((gate, index) => (
              <div className="gate-row" key={`${gate.gate_family}-${gate.gate_key}-${index}`}>
                {outcomeBadge(gate.outcome)}
                <div className="gate-body">
                  <p className="gate-name">{gateLabel(gate)}</p>
                  {gate.detail ? (
                    <p className="small muted" style={{ margin: 0 }}>
                      {gate.detail}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No screening lines are recorded for this record.</p>
        )}
      </section>

      {/* --- Availability ------------------------------------------------- */}
      <section className="record-section">
        <h2 className="h2">Availability</h2>
        <dl className="kv">
          <Row label="Data licence">
            {source?.data_license
              ? (LICENSE_LABELS[source.data_license] ?? source.data_license)
              : "No licence stated"}
          </Row>
          <Row label="What the archive holds">
            {held
              ? "The sequence data, under the licence above."
              : "The citation, the length and a checksum. Not the sequence data."}
          </Row>
          <Row label="Hosting decision">
            <span style={{ display: "block" }}>{record.hosting_decision}</span>
            <span className="small muted">{record.hosting_reason}</span>
          </Row>
          {sequence ? <Row label="Length">{formatLength(sequence)}</Row> : null}
          {sequence ? (
            <Row label="Checksum, SHA3-256">
              <span className="checksum">{sequence.sha3_256}</span>
            </Row>
          ) : null}
        </dl>

        <div className="notice" style={{ marginTop: 20 }}>
          {held
            ? "The archive has no download endpoint yet. To ask for this sequence, write to"
            : "The archive does not hold this sequence, so there is nothing to download. To ask about the record, write to"}{" "}
          <a className="link" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          , quoting <span className="accession">{record.registry_id}</span>.
        </div>
      </section>

      {/* --- Other databases ---------------------------------------------- */}
      {record.accessions.length > 0 ? (
        <section className="record-section">
          <h2 className="h2">In other databases</h2>
          <dl className="kv">
            {record.accessions.map((accession, index) => (
              <Row key={index} label={accession.database}>
                <a
                  className="link mono"
                  href={accession.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {accession.accession}
                </a>
              </Row>
            ))}
          </dl>
        </section>
      ) : null}

      {/* --- Record dates and corrections --------------------------------- */}
      <section className="record-section">
        <h2 className="h2">This record</h2>
        <dl className="kv">
          <Row label="Accession">
            <span className="accession">{record.registry_id}</span>
          </Row>
          <Row label="Kind">
            {record.record_kind === "catalogue"
              ? "Catalogued from published work. The publication is the primary record."
              : "Deposited with the archive by its authors. The archive holds the primary copy."}
          </Row>
          <Row label="Created">{formatDate(record.created_at)}</Row>
          <Row label="Published">{formatDate(record.published_at)}</Row>
        </dl>

        <p className="small" style={{ marginTop: 20, marginBottom: 0 }}>
          <a className="link" href={correctionHref}>
            Request a correction or removal
          </a>
          . Authors can ask for a record to be corrected, or for their sequence
          to be taken out of the archive.
        </p>
      </section>
    </div>
  );
}
