/**
 * Client for the catalogue and submission routes.
 *
 * Separate from lib/api.ts on purpose. That client flattens every error body
 * into one generic sentence, which is fine for an operator console and wrong
 * for a public form: a submitter needs to be told which field the API
 * objected to, in the API's own words.
 *
 * Every request goes to the Next proxy at /api/proxy/<path>, never to the API
 * directly. The proxy attaches a read-only key server-side for the allowlisted
 * public GETs, so no key is ever present in this bundle. POST /submissions
 * needs no key at all.
 */

const PROXY = "/api/proxy";

// ---------------------------------------------------------------------------
// Vocabularies, mirroring sentinel_api.db.catalogue
// ---------------------------------------------------------------------------

export const MOLECULE_TYPES = [
  "protein",
  "dna",
  "rna",
  "genome",
  "regulatory_element",
  "grna_scaffold",
] as const;

export type MoleculeType = (typeof MOLECULE_TYPES)[number];

export const MOLECULE_LABELS: Record<string, string> = {
  protein: "Protein",
  dna: "DNA",
  rna: "RNA",
  genome: "Genome",
  regulatory_element: "Regulatory element",
  grna_scaffold: "gRNA scaffold",
};

export const HOST_ORGANISMS = [
  "ECOLI",
  "YEAST",
  "HUMAN",
  "CHO",
  "INSECT",
  "PLANT",
] as const;

export const HOST_LABELS: Record<string, string> = {
  ECOLI: "E. coli",
  YEAST: "Yeast",
  HUMAN: "Human cell line",
  CHO: "CHO cells",
  INSECT: "Insect cells",
  PLANT: "Plant",
};

export const ACCESSION_DATABASES = [
  "pdb",
  "genbank",
  "uniprot",
  "ena",
  "zenodo",
  "figshare",
  "supplementary",
  "other",
] as const;

export const ACCESSION_DB_LABELS: Record<string, string> = {
  pdb: "PDB",
  genbank: "GenBank",
  uniprot: "UniProt",
  ena: "ENA",
  zenodo: "Zenodo",
  figshare: "Figshare",
  supplementary: "Supplementary material",
  other: "Other",
};

/** Licences under which the archive can hold the sequence itself. */
export const REDISTRIBUTABLE_LICENSES = [
  "CC0-1.0",
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
  "MIT",
  "Apache-2.0",
  "PUBLIC-DOMAIN",
] as const;

/**
 * Licences the archive knows but cannot redistribute under. A record submitted
 * under one of these keeps its citation and a checksum, and the sequence is not
 * stored. Offered on the form so a submitter can state the real licence rather
 * than pick a permissive one to get through.
 */
export const CITATION_ONLY_LICENSES = [
  "CC-BY-NC-4.0",
  "CC-BY-NC-ND-4.0",
  "CC-BY-ND-4.0",
  "PROPRIETARY",
  "UNSTATED",
] as const;

export const LICENSE_LABELS: Record<string, string> = {
  "CC0-1.0": "CC0 1.0 (public domain dedication)",
  "PUBLIC-DOMAIN": "Public domain, no rights reserved",
  "CC-BY-4.0": "CC BY 4.0",
  "CC-BY-SA-4.0": "CC BY-SA 4.0",
  MIT: "MIT",
  "Apache-2.0": "Apache 2.0",
  "CC-BY-NC-4.0": "CC BY-NC 4.0",
  "CC-BY-ND-4.0": "CC BY-ND 4.0",
  "CC-BY-NC-ND-4.0": "CC BY-NC-ND 4.0",
  PROPRIETARY: "All rights reserved",
  UNSTATED: "No licence stated",
};

// ---------------------------------------------------------------------------
// Response types, mirroring CatalogueOut and the list route
// ---------------------------------------------------------------------------

export type RecordKind = "catalogue" | "submission";

export interface CatalogueListItem {
  registry_id: string;
  title: string;
  status: string;
  visibility: string;
  molecule_type: string;
  hosting_decision: string;
  biosafety_class: string;
  record_kind: RecordKind;
  generating_model: string | null;
  wet_lab_validated: boolean;
  container: string | null;
  published_on: string | null;
  peer_reviewed: boolean;
  created_at: string;
  published_at: string | null;
}

export interface CatalogueListResponse {
  items: CatalogueListItem[];
  /** The real total matching the query, not the length of this page. */
  count: number;
  offset: number;
  limit: number;
}

export interface Gate {
  gate_family: string;
  gate_key: string;
  outcome: string;
  detail: string | null;
}

export interface Author {
  full_name: string;
  orcid: string | null;
  affiliation: string | null;
  is_corresponding: boolean;
}

export interface Source {
  title: string;
  url: string;
  doi: string | null;
  container: string | null;
  published_on: string | null;
  peer_reviewed: boolean;
  version: string | null;
  article_license: string | null;
  data_license: string | null;
  authors: Author[];
}

export interface Design {
  generating_model: string | null;
  model_version: string | null;
  model_availability: string | null;
  design_method: string | null;
  design_target: string | null;
  n_designed: number | null;
  n_tested: number | null;
  n_functional: number | null;
  assays: string[];
  expression_host: string | null;
  wet_lab_validated: boolean;
}

export interface ExternalAccession {
  database: string;
  accession: string;
  url: string;
}

export interface SequenceInfo {
  molecule_type: string;
  length: number;
  sha3_256: string;
  /** The archive stores the sequence data. */
  held: boolean;
  /** Withheld on biosafety grounds or at the authors' request. */
  withheld: boolean;
}

export interface CatalogueRecord {
  registry_id: string;
  title: string;
  summary: string | null;
  molecule_type: string;
  status: string;
  visibility: string;
  record_kind: RecordKind;
  biosafety_class: string;
  hosting_decision: string;
  hosting_reason: string;
  license_resolution: string;
  citation_only: boolean;
  created_at: string | null;
  published_at: string | null;
  gates: Gate[];
  source: Source | null;
  design: Design | null;
  accessions: ExternalAccession[];
  sequence: SequenceInfo | null;
}

export interface SubmissionReceipt {
  registry_id: string | null;
  status: string;
  /**
   * Shown to the submitter verbatim. It is deliberately the same sentence
   * whatever screening concluded, so nothing on the page may add to it.
   */
  message: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * An error carrying what the API said, so a form can show it.
 *
 * `code` is the API's own machine code where it sent one (CONFIRMATION_REQUIRED,
 * INVALID_ORCID, and so on), `fields` holds FastAPI's per-field messages for a
 * validation failure, and `status` is the HTTP status.
 */
export class CatalogueError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: { field: string; message: string }[];

  constructor(
    status: number,
    code: string,
    message: string,
    fields: { field: string; message: string }[] = [],
  ) {
    super(message);
    this.name = "CatalogueError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/** FastAPI's own validation shape: detail is a list of per-field problems. */
interface FastApiValidationItem {
  loc?: unknown[];
  msg?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Turn an error body into a CatalogueError.
 *
 * Three shapes arrive from this API, and all three are handled here rather
 * than collapsed into one sentence:
 *   { detail: { code, message } }  the routes' own refusals
 *   { detail: [ { loc, msg } ] }   FastAPI, a field is missing or malformed
 *   { detail: "some string" }      a plain 404
 */
function toError(status: number, body: unknown): CatalogueError {
  const detail = isRecord(body) ? body.detail : undefined;

  if (isRecord(detail) && typeof detail.message === "string") {
    const code = typeof detail.code === "string" ? detail.code : "ERROR";
    return new CatalogueError(status, code, detail.message);
  }

  if (Array.isArray(detail)) {
    const fields = (detail as FastApiValidationItem[]).map((item) => {
      const loc = Array.isArray(item.loc) ? item.loc : [];
      // Drop the leading "body" / "header" segment: it tells a submitter
      // nothing, and the remaining path is the field they filled in.
      const path = loc
        .slice(1)
        .map((part) => String(part))
        .join(".");
      return {
        field: path || loc.map((part) => String(part)).join("."),
        message: item.msg ?? "This value was not accepted.",
      };
    });
    const summary =
      fields.length === 1 && fields[0].field
        ? `${fields[0].field}: ${fields[0].message}`
        : "Some fields were not accepted. Please check the details below.";
    return new CatalogueError(status, "VALIDATION_ERROR", summary, fields);
  }

  if (typeof detail === "string" && detail.trim()) {
    return new CatalogueError(status, "ERROR", detail);
  }

  return new CatalogueError(
    status,
    "ERROR",
    `The archive answered with status ${status}.`,
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${PROXY}/${path}`, init);
  } catch {
    throw new CatalogueError(
      0,
      "UNREACHABLE",
      "The archive could not be reached. Please try again.",
    );
  }

  const text = await response.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
  }

  if (!response.ok) {
    throw toError(response.status, body);
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface CatalogueQuery {
  q?: string;
  molecule_type?: string;
  model?: string;
  validated?: boolean;
  kind?: string;
  limit?: number;
  offset?: number;
}

export function catalogueQueryString(query: CatalogueQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.molecule_type) params.set("molecule_type", query.molecule_type);
  if (query.model) params.set("model", query.model);
  if (query.validated) params.set("validated", "true");
  if (query.kind) params.set("kind", query.kind);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.offset) params.set("offset", String(query.offset));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function fetchCatalogue(
  query: CatalogueQuery = {},
): Promise<CatalogueListResponse> {
  return request<CatalogueListResponse>(
    `catalogue${catalogueQueryString(query)}`,
  );
}

export function fetchRecord(registryId: string): Promise<CatalogueRecord> {
  return request<CatalogueRecord>(`catalogue/${encodeURIComponent(registryId)}`);
}

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

export interface SubmissionAuthor {
  full_name: string;
  orcid?: string | null;
  affiliation?: string | null;
  is_corresponding?: boolean;
}

export interface SubmissionDesign {
  generating_model: string;
  model_version?: string | null;
  model_availability?: string | null;
  design_method?: string | null;
  design_target?: string | null;
  n_designed?: number | null;
  n_tested?: number | null;
  n_functional?: number | null;
  assays?: string[];
  expression_host?: string | null;
  wet_lab_validated?: boolean;
}

export interface SubmissionPayload {
  title: string;
  summary?: string | null;
  molecule_type: string;
  fasta: string;
  host_organism: string;
  authors: SubmissionAuthor[];
  design: SubmissionDesign;
  accessions: ExternalAccession[];
  source: {
    url?: string | null;
    doi?: string | null;
    title?: string | null;
    container?: string | null;
    published_on?: string | null;
  };
  data_license: string;
  submitter: {
    name: string;
    email: string;
    affiliation?: string | null;
    orcid?: string | null;
  };
  confirms_rights: boolean;
  accepts_screening: boolean;
  /** The honeypot. A person leaves it empty. */
  website?: string | null;
}

export function submit(payload: SubmissionPayload): Promise<SubmissionReceipt> {
  return request<SubmissionReceipt>("submissions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Presentation helpers shared by the pages
// ---------------------------------------------------------------------------

/** AGC- cites work published elsewhere. AG- was deposited here. */
export function accessionKind(registryId: string): RecordKind {
  return registryId.startsWith("AGC-") ? "catalogue" : "submission";
}

export const KIND_LABEL: Record<RecordKind, string> = {
  catalogue: "Catalogued",
  submission: "Deposited",
};

export const KIND_TOOLTIP: Record<RecordKind, string> = {
  catalogue:
    "AGC: this cites work published elsewhere. The paper is the primary record.",
  submission:
    "AG: this sequence was deposited directly with the archive by its authors, which holds the primary copy.",
};

export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatLength(sequence: SequenceInfo): string {
  const unit = sequence.molecule_type === "protein" ? "residues" : "bases";
  return `${sequence.length.toLocaleString("en-GB")} ${unit}`;
}
