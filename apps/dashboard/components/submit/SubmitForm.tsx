"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ACCESSION_DATABASES,
  ACCESSION_DB_LABELS,
  CITATION_ONLY_LICENSES,
  CatalogueError,
  HOST_LABELS,
  HOST_ORGANISMS,
  LICENSE_LABELS,
  MOLECULE_LABELS,
  MOLECULE_TYPES,
  REDISTRIBUTABLE_LICENSES,
  submit,
  type SubmissionPayload,
  type SubmissionReceipt,
} from "../../lib/catalogue";

interface AuthorRow {
  full_name: string;
  orcid: string;
  affiliation: string;
  is_corresponding: boolean;
}

interface AccessionRow {
  database: string;
  accession: string;
  url: string;
}

const EMPTY_AUTHOR: AuthorRow = {
  full_name: "",
  orcid: "",
  affiliation: "",
  is_corresponding: false,
};

const EMPTY_ACCESSION: AccessionRow = { database: "pdb", accession: "", url: "" };

/** Trimmed, or null. The API treats an absent optional field and an empty one differently. */
function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function intOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function SubmitForm() {
  // The sequence
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [moleculeType, setMoleculeType] = useState<string>("protein");
  const [fasta, setFasta] = useState("");
  const [hostOrganism, setHostOrganism] = useState<string>("ECOLI");
  const [dataLicense, setDataLicense] = useState<string>("CC-BY-4.0");

  // Authors
  const [authors, setAuthors] = useState<AuthorRow[]>([{ ...EMPTY_AUTHOR }]);

  // Design
  const [model, setModel] = useState("");
  const [modelVersion, setModelVersion] = useState("");
  const [modelAvailability, setModelAvailability] = useState("");
  const [designMethod, setDesignMethod] = useState("");
  const [designTarget, setDesignTarget] = useState("");
  const [nDesigned, setNDesigned] = useState("");
  const [nTested, setNTested] = useState("");
  const [nFunctional, setNFunctional] = useState("");
  const [assays, setAssays] = useState("");
  const [expressionHost, setExpressionHost] = useState("");
  const [validated, setValidated] = useState(false);

  // Where it is published, if it is
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceDoi, setSourceDoi] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceContainer, setSourceContainer] = useState("");
  const [sourcePublishedOn, setSourcePublishedOn] = useState("");

  // Other databases
  const [accessions, setAccessions] = useState<AccessionRow[]>([]);

  // The submitter
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [orcid, setOrcid] = useState("");

  // Confirmations, and the field a person never sees
  const [confirmsRights, setConfirmsRights] = useState(false);
  const [acceptsScreening, setAcceptsScreening] = useState(false);
  const [website, setWebsite] = useState("");

  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<CatalogueError | null>(null);
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);

  function buildPayload(): SubmissionPayload {
    return {
      title: title.trim(),
      summary: orNull(summary),
      molecule_type: moleculeType,
      fasta: fasta.trim(),
      host_organism: hostOrganism,
      authors: authors
        .filter((author) => author.full_name.trim() !== "")
        .map((author) => ({
          full_name: author.full_name.trim(),
          orcid: orNull(author.orcid),
          affiliation: orNull(author.affiliation),
          is_corresponding: author.is_corresponding,
        })),
      design: {
        generating_model: model.trim(),
        model_version: orNull(modelVersion),
        model_availability: orNull(modelAvailability),
        design_method: orNull(designMethod),
        design_target: orNull(designTarget),
        n_designed: intOrNull(nDesigned),
        n_tested: intOrNull(nTested),
        n_functional: intOrNull(nFunctional),
        assays: assays
          .split(",")
          .map((assay) => assay.trim())
          .filter((assay) => assay !== ""),
        expression_host: orNull(expressionHost),
        wet_lab_validated: validated,
      },
      accessions: accessions
        .filter((row) => row.accession.trim() !== "" && row.url.trim() !== "")
        .map((row) => ({
          database: row.database,
          accession: row.accession.trim(),
          url: row.url.trim(),
        })),
      source: {
        url: orNull(sourceUrl),
        doi: orNull(sourceDoi),
        title: orNull(sourceTitle),
        container: orNull(sourceContainer),
        published_on: orNull(sourcePublishedOn),
      },
      data_license: dataLicense,
      submitter: {
        name: name.trim(),
        email: email.trim(),
        affiliation: orNull(affiliation),
        orcid: orNull(orcid),
      },
      confirms_rights: confirmsRights,
      accepts_screening: acceptsScreening,
      website: orNull(website),
    };
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFailure(null);
    setSending(true);
    try {
      const result = await submit(buildPayload());
      setReceipt(result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setFailure(
        error instanceof CatalogueError
          ? error
          : new CatalogueError(0, "ERROR", "The submission could not be sent."),
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSending(false);
    }
  }

  // ---------------------------------------------------------------------
  // The receipt. Its wording is the API's, verbatim: the same sentence is
  // returned whatever screening concluded, so nothing may be added here
  // that would let a submitter infer an outcome.
  // ---------------------------------------------------------------------
  if (receipt) {
    return (
      <div className="wrap-narrow page">
        <h1 className="h1" style={{ fontSize: "clamp(26px, 4.6vw, 38px)" }}>
          Submission received
        </h1>
        {receipt.registry_id ? (
          <>
            <p className="label">Accession</p>
            <p className="accession" style={{ fontSize: 22, marginTop: 0 }}>
              {receipt.registry_id}
            </p>
          </>
        ) : null}
        <div className="notice notice-accent">{receipt.message}</div>
        <p className="small muted" style={{ marginTop: 20 }}>
          Keep the accession: it identifies the record if you write to the
          archive about it.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <Link href="/" className="btn btn-ghost">
            Back to the archive
          </Link>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setReceipt(null);
              setFailure(null);
            }}
          >
            Submit another sequence
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap-narrow page">
      <h1 className="h1" style={{ fontSize: "clamp(28px, 5vw, 42px)" }}>
        Submit a sequence
      </h1>
      <p className="lede">
        For sequences designed with a model and made in the lab, whether or not
        they are published. The archive records the same details it records for
        published work, screens the sequence for biosafety, and lists the record
        only after a person has reviewed it.
      </p>
      <p className="small muted">
        Submitting through code instead? See the{" "}
        <Link href="/data" className="link">
          API and data page
        </Link>
        . Submissions need no key.
      </p>

      {failure ? (
        <div className="notice notice-danger" role="alert">
          <h2 className="h3">The submission was not accepted</h2>
          <p style={{ margin: failure.fields.length ? "0 0 10px" : 0 }}>
            {failure.message}
          </p>
          {failure.fields.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {failure.fields.map((field, index) => (
                <li key={index}>
                  <span className="mono xsmall">{field.field}</span>: {field.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate>
        {/* --- The sequence --------------------------------------------- */}
        <section className="form-section">
          <h2 className="h2">The sequence</h2>

          <div className="field">
            <label className="label" htmlFor="title">
              Title (required)
            </label>
            <input
              id="title"
              className="input"
              value={title}
              required
              maxLength={300}
              onChange={(event) => setTitle(event.target.value)}
            />
            <p className="hint">
              What the sequence is, in a line. For example, a thermostable
              variant of a named enzyme.
            </p>
          </div>

          <div className="field">
            <label className="label" htmlFor="summary">
              Summary
            </label>
            <textarea
              id="summary"
              className="textarea"
              rows={3}
              maxLength={2000}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
            <p className="hint">A short paragraph, as it would appear in an abstract.</p>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="molecule">
                Molecule type (required)
              </label>
              <select
                id="molecule"
                className="select"
                value={moleculeType}
                onChange={(event) => setMoleculeType(event.target.value)}
              >
                {MOLECULE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {MOLECULE_LABELS[type]}
                  </option>
                ))}
              </select>
              <p className="hint">
                Must match the sequence itself. A protein must be declared a
                protein, and only a protein may be.
              </p>
            </div>

            <div className="field">
              <label className="label" htmlFor="host">
                Host organism for screening (required)
              </label>
              <select
                id="host"
                className="select"
                value={hostOrganism}
                onChange={(event) => setHostOrganism(event.target.value)}
              >
                {HOST_ORGANISMS.map((host) => (
                  <option key={host} value={host}>
                    {HOST_LABELS[host]}
                  </option>
                ))}
              </select>
              <p className="hint">
                Screening reads the sequence in the context of a host. Choose
                the one it was designed for.
              </p>
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="fasta">
              Sequence, FASTA or plain (required)
            </label>
            <textarea
              id="fasta"
              className="textarea"
              rows={7}
              required
              value={fasta}
              placeholder={">my-design-01\nMKVLATGSW..."}
              onChange={(event) => setFasta(event.target.value)}
            />
            <p className="hint">
              One sequence. A FASTA header is optional.
            </p>
          </div>

          <div className="field">
            <label className="label" htmlFor="license">
              Licence for the sequence data (required)
            </label>
            <select
              id="license"
              className="select"
              value={dataLicense}
              onChange={(event) => setDataLicense(event.target.value)}
            >
              <optgroup label="The archive can hold the sequence">
                {REDISTRIBUTABLE_LICENSES.map((spdx) => (
                  <option key={spdx} value={spdx}>
                    {LICENSE_LABELS[spdx]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Citation and checksum only">
                {CITATION_ONLY_LICENSES.map((spdx) => (
                  <option key={spdx} value={spdx}>
                    {LICENSE_LABELS[spdx]}
                  </option>
                ))}
              </optgroup>
            </select>
            <p className="hint">
              State the real licence. Under the second group the archive keeps
              the citation, the length and a checksum, and does not store the
              sequence.
            </p>
          </div>
        </section>

        {/* --- Authors -------------------------------------------------- */}
        <section className="form-section">
          <h2 className="h2">Authors</h2>
          <p className="small muted">
            Who designed the sequence, in the order they should be credited. At
            least one is required.
          </p>

          {authors.map((author, index) => (
            <div className="repeat-item" key={index}>
              <div className="repeat-head">
                <span className="label" style={{ margin: 0 }}>
                  Author {index + 1}
                </span>
                {authors.length > 1 ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      setAuthors(authors.filter((_, position) => position !== index))
                    }
                  >
                    Remove
                  </button>
                ) : null}
              </div>

              <div className="field-row">
                <div className="field">
                  <label className="label" htmlFor={`author-name-${index}`}>
                    Full name (required)
                  </label>
                  <input
                    id={`author-name-${index}`}
                    className="input"
                    value={author.full_name}
                    required
                    onChange={(event) => {
                      const next = [...authors];
                      next[index] = { ...author, full_name: event.target.value };
                      setAuthors(next);
                    }}
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor={`author-orcid-${index}`}>
                    ORCID iD
                  </label>
                  <input
                    id={`author-orcid-${index}`}
                    className="input mono"
                    value={author.orcid}
                    placeholder="0000-0000-0000-0000"
                    onChange={(event) => {
                      const next = [...authors];
                      next[index] = { ...author, orcid: event.target.value };
                      setAuthors(next);
                    }}
                  />
                </div>
              </div>

              <div className="field" style={{ marginBottom: 10 }}>
                <label className="label" htmlFor={`author-affiliation-${index}`}>
                  Affiliation
                </label>
                <input
                  id={`author-affiliation-${index}`}
                  className="input"
                  value={author.affiliation}
                  onChange={(event) => {
                    const next = [...authors];
                    next[index] = { ...author, affiliation: event.target.value };
                    setAuthors(next);
                  }}
                />
              </div>

              <label className="confirm" style={{ marginBottom: 0 }}>
                <input
                  type="checkbox"
                  checked={author.is_corresponding}
                  onChange={(event) => {
                    const next = [...authors];
                    next[index] = { ...author, is_corresponding: event.target.checked };
                    setAuthors(next);
                  }}
                />
                Corresponding author
              </label>
            </div>
          ))}

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setAuthors([...authors, { ...EMPTY_AUTHOR }])}
          >
            Add another author
          </button>
        </section>

        {/* --- Design --------------------------------------------------- */}
        <section className="form-section">
          <h2 className="h2">Design</h2>

          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="model">
                Generating model (required)
              </label>
              <input
                id="model"
                className="input"
                value={model}
                required
                onChange={(event) => setModel(event.target.value)}
              />
              <p className="hint">The model that produced the sequence.</p>
            </div>
            <div className="field">
              <label className="label" htmlFor="model-version">
                Model version
              </label>
              <input
                id="model-version"
                className="input"
                value={modelVersion}
                onChange={(event) => setModelVersion(event.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="model-availability">
              Model availability
            </label>
            <input
              id="model-availability"
              className="input"
              value={modelAvailability}
              placeholder="Open weights, API only, internal, and so on"
              onChange={(event) => setModelAvailability(event.target.value)}
            />
            <p className="hint">
              Whether someone else could run the model that made this sequence.
            </p>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="design-method">
                Design method
              </label>
              <input
                id="design-method"
                className="input"
                value={designMethod}
                onChange={(event) => setDesignMethod(event.target.value)}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="design-target">
                Design target
              </label>
              <input
                id="design-target"
                className="input"
                value={designTarget}
                onChange={(event) => setDesignTarget(event.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <p className="label">Designed, tested, functional</p>
            <div className="field-row" style={{ gap: 12 }}>
              <input
                className="input mono"
                inputMode="numeric"
                value={nDesigned}
                aria-label="Number designed"
                placeholder="designed"
                onChange={(event) => setNDesigned(event.target.value)}
              />
              <input
                className="input mono"
                inputMode="numeric"
                value={nTested}
                aria-label="Number tested"
                placeholder="tested"
                onChange={(event) => setNTested(event.target.value)}
              />
            </div>
            <input
              className="input mono"
              inputMode="numeric"
              value={nFunctional}
              aria-label="Number functional"
              placeholder="functional"
              style={{ marginTop: 12 }}
              onChange={(event) => setNFunctional(event.target.value)}
            />
            <p className="hint">
              How many were designed, how many were made and tested, and how
              many worked. Leave blank what you did not measure.
            </p>
          </div>

          <div className="field">
            <label className="label" htmlFor="assays">
              Assays
            </label>
            <input
              id="assays"
              className="input"
              value={assays}
              placeholder="Thermal shift, activity assay"
              onChange={(event) => setAssays(event.target.value)}
            />
            <p className="hint">Separated by commas.</p>
          </div>

          <div className="field">
            <label className="label" htmlFor="expression-host">
              Expression host used in the lab
            </label>
            <select
              id="expression-host"
              className="select"
              value={expressionHost}
              onChange={(event) => setExpressionHost(event.target.value)}
            >
              <option value="">Not stated</option>
              {HOST_ORGANISMS.map((host) => (
                <option key={host} value={host}>
                  {HOST_LABELS[host]}
                </option>
              ))}
            </select>
          </div>

          <label className="confirm">
            <input
              type="checkbox"
              checked={validated}
              onChange={(event) => setValidated(event.target.checked)}
            />
            This sequence was made and tested in the laboratory
          </label>
        </section>

        {/* --- Where it is published ------------------------------------ */}
        <section className="form-section">
          <h2 className="h2">Where it is published</h2>
          <p className="small muted">
            Leave this blank if the sequence is not published anywhere. The
            archive then becomes its venue, and this record is the one to cite.
          </p>

          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="source-url">
                Link
              </label>
              <input
                id="source-url"
                className="input"
                value={sourceUrl}
                placeholder="https://"
                onChange={(event) => setSourceUrl(event.target.value)}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="source-doi">
                DOI
              </label>
              <input
                id="source-doi"
                className="input mono"
                value={sourceDoi}
                placeholder="10.1234/example"
                onChange={(event) => setSourceDoi(event.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="source-title">
              Title of the paper or preprint
            </label>
            <input
              id="source-title"
              className="input"
              value={sourceTitle}
              onChange={(event) => setSourceTitle(event.target.value)}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="source-container">
                Journal, preprint server or repository
              </label>
              <input
                id="source-container"
                className="input"
                value={sourceContainer}
                onChange={(event) => setSourceContainer(event.target.value)}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="source-date">
                Date published
              </label>
              <input
                id="source-date"
                className="input"
                type="date"
                value={sourcePublishedOn}
                onChange={(event) => setSourcePublishedOn(event.target.value)}
              />
            </div>
          </div>
        </section>

        {/* --- Other databases ------------------------------------------ */}
        <section className="form-section">
          <h2 className="h2">In other databases</h2>
          <p className="small muted">
            Where the sequence or its structure is already deposited, if it is.
          </p>

          {accessions.map((row, index) => (
            <div className="repeat-item" key={index}>
              <div className="repeat-head">
                <span className="label" style={{ margin: 0 }}>
                  Accession {index + 1}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    setAccessions(accessions.filter((_, position) => position !== index))
                  }
                >
                  Remove
                </button>
              </div>
              <div className="field-row">
                <div className="field">
                  <label className="label" htmlFor={`accession-db-${index}`}>
                    Database
                  </label>
                  <select
                    id={`accession-db-${index}`}
                    className="select"
                    value={row.database}
                    onChange={(event) => {
                      const next = [...accessions];
                      next[index] = { ...row, database: event.target.value };
                      setAccessions(next);
                    }}
                  >
                    {ACCESSION_DATABASES.map((database) => (
                      <option key={database} value={database}>
                        {ACCESSION_DB_LABELS[database]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor={`accession-id-${index}`}>
                    Accession
                  </label>
                  <input
                    id={`accession-id-${index}`}
                    className="input mono"
                    value={row.accession}
                    onChange={(event) => {
                      const next = [...accessions];
                      next[index] = { ...row, accession: event.target.value };
                      setAccessions(next);
                    }}
                  />
                </div>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="label" htmlFor={`accession-url-${index}`}>
                  Link
                </label>
                <input
                  id={`accession-url-${index}`}
                  className="input"
                  value={row.url}
                  placeholder="https://"
                  onChange={(event) => {
                    const next = [...accessions];
                    next[index] = { ...row, url: event.target.value };
                    setAccessions(next);
                  }}
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setAccessions([...accessions, { ...EMPTY_ACCESSION }])}
          >
            Add an accession
          </button>
        </section>

        {/* --- The submitter -------------------------------------------- */}
        <section className="form-section">
          <h2 className="h2">About you</h2>
          <p className="small muted">
            Who the archive writes to about this submission. You need not be one
            of the authors. Your address is not published.
          </p>

          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="submitter-name">
                Your name (required)
              </label>
              <input
                id="submitter-name"
                className="input"
                value={name}
                required
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="submitter-email">
                Email (required)
              </label>
              <input
                id="submitter-email"
                className="input"
                type="email"
                value={email}
                required
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="submitter-affiliation">
                Affiliation
              </label>
              <input
                id="submitter-affiliation"
                className="input"
                value={affiliation}
                onChange={(event) => setAffiliation(event.target.value)}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="submitter-orcid">
                Your ORCID iD
              </label>
              <input
                id="submitter-orcid"
                className="input mono"
                value={orcid}
                placeholder="0000-0000-0000-0000"
                onChange={(event) => setOrcid(event.target.value)}
              />
            </div>
          </div>
        </section>

        {/* --- Confirmations -------------------------------------------- */}
        <section className="form-section">
          <h2 className="h2">Before you send</h2>

          <label className="confirm">
            <input
              type="checkbox"
              checked={confirmsRights}
              onChange={(event) => setConfirmsRights(event.target.checked)}
            />
            I may share this sequence and its details with the archive, under the
            licence I chose above.
          </label>

          <label className="confirm">
            <input
              type="checkbox"
              checked={acceptsScreening}
              onChange={(event) => setAcceptsScreening(event.target.checked)}
            />
            I accept that the sequence will be screened for biosafety before
            anything is stored or published.
          </label>

          {/* A person never sees this field. A bot that fills it is answered as
              if accepted, and nothing is stored. */}
          <div className="honeypot" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>

          <div style={{ marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" disabled={sending}>
              {sending ? "Sending" : "Submit the sequence"}
            </button>
          </div>
          <p className="hint">
            Nothing becomes public when you send this. A person reviews the
            record first.
          </p>
        </section>
      </form>
    </div>
  );
}
