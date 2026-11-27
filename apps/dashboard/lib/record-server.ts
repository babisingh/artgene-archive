import { cache } from "react";

import {
  FUNCTION_LABELS,
  MOLECULE_LABELS,
  SUBJECT_LABELS,
  type CatalogueRecord,
} from "./catalogue";

/**
 * A record read on the server, so its page arrives with the record in it.
 *
 * The record page used to reach every visitor, search engines included, as a
 * loading placeholder titled only by its accession; the record itself came
 * later, from the browser. Search engines read titles and snippets from the
 * page as it arrives, so twenty records showed as twenty accession numbers.
 *
 * This asks the API exactly what the proxy asks for an anonymous visitor:
 * GET /catalogue/{id} with the read-only key. So the server sees the same
 * public view the browser always got, redactions included, and nothing more.
 * Only server code imports this file.
 */

export const SITE = (process.env.SITE_URL ?? "https://artgene-archive.org").replace(/\/+$/, "");
const API_URL = (process.env.API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const READ_KEY = process.env.PUBLIC_READ_API_KEY ?? process.env.API_KEY ?? "";

const ACCESSION = /^AGC?-\d{4}-\d{6}$/;

/**
 * The record, or null when nothing public exists under that id. Anything else
 * (the API down, a timeout) is also null: the page then loads the record in
 * the browser, exactly as it did before this existed.
 *
 * `cache` makes the page and its metadata share one request.
 */
export const publicRecord = cache(async (id: string): Promise<CatalogueRecord | null> => {
  if (!ACCESSION.test(id)) return null;
  try {
    const response = await fetch(`${API_URL}/api/v1/catalogue/${encodeURIComponent(id)}`, {
      headers: READ_KEY ? { "x-api-key": READ_KEY } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const record = (await response.json()) as CatalogueRecord;
    return record?.registry_id === id ? record : null;
  } catch {
    return null;
  }
});

export function recordUrl(id: string): string {
  return `${SITE}/sequences/${id}`;
}

/** Shortened at a word, for a snippet. */
function clip(text: string, limit: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= limit) return flat;
  const cut = flat.slice(0, limit - 1);
  const atWord = cut.includes(" ") ? cut.slice(0, cut.lastIndexOf(" ")) : cut;
  return `${atWord.replace(/[\s,;:.]+$/, "")}…`;
}

/** The line under the title in search results: the editor's subtitle, else the summary. */
export function recordDescription(record: CatalogueRecord): string {
  const lead = record.subtitle || record.summary || record.technical_summary;
  if (lead) return clip(lead, 200);
  const molecule = MOLECULE_LABELS[record.molecule_type] ?? record.molecule_type;
  return `${molecule} record ${record.registry_id} in the ArtGene Archive catalogue of AI-designed biological sequences.`;
}

function orcidUrl(orcid: string): string {
  return /^https?:\/\//.test(orcid) ? orcid : `https://orcid.org/${orcid}`;
}

/** An SPDX identifier as a URL, or nothing when the licence is not a real one. */
function licenseUrl(license: string | null | undefined): string | null {
  if (!license || !/^[A-Za-z0-9.+-]+$/.test(license)) return null;
  if (["UNSTATED", "UNKNOWN", "NONE", "OTHER", "PROPRIETARY"].includes(license.toUpperCase())) return null;
  return `https://spdx.org/licenses/${license}.html`;
}

/**
 * schema.org Dataset markup for a record, which is what Google Dataset Search
 * reads. Google requires a name and a description of 50 to 5,000 characters.
 *
 * Built only from what the page itself shows the public: the title, the two
 * summaries, the paper, its authors. Never a sequence (the record carries
 * none), and nothing at all for a record whose sequence is withheld or whose
 * biosafety class is restricted: those stay findable on the site and in the
 * sitemap, and are not promoted as datasets.
 */
export function datasetMarkup(record: CatalogueRecord): Record<string, unknown> | null {
  if (record.sequence?.withheld || record.biosafety_class === "restricted") return null;

  const parts = [record.subtitle, record.summary, record.technical_summary]
    .filter((part): part is string => Boolean(part && part.trim()))
    .map((part) => part.trim());
  const description = parts.join("\n\n").slice(0, 5000).trim();
  if (description.length < 50) return null;

  const url = recordUrl(record.registry_id);
  const source = record.source;
  const keywords = [
    "AI-designed sequence",
    MOLECULE_LABELS[record.molecule_type] ?? record.molecule_type,
    record.function_class ? FUNCTION_LABELS[record.function_class] ?? record.function_class : null,
    record.subject_class ? SUBJECT_LABELS[record.subject_class] ?? record.subject_class : null,
  ].filter(Boolean);
  const license = licenseUrl(source?.data_license);

  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": url,
    url,
    name: record.title,
    identifier: record.registry_id,
    description,
    keywords,
    isAccessibleForFree: true,
    ...(source?.authors?.length
      ? {
          creator: source.authors.map((author) => ({
            "@type": "Person",
            name: author.full_name,
            ...(author.orcid ? { sameAs: orcidUrl(author.orcid) } : {}),
          })),
        }
      : {}),
    ...(source?.doi
      ? { citation: `https://doi.org/${source.doi}` }
      : source?.url
        ? { citation: source.url }
        : {}),
    ...(license ? { license } : {}),
    ...(record.published_at ? { datePublished: record.published_at.slice(0, 10) } : {}),
    includedInDataCatalog: { "@type": "DataCatalog", name: "ArtGene Archive", url: `${SITE}/` },
    publisher: { "@type": "Organization", name: "ArtGene Archive", url: `${SITE}/` },
  };
}

/** JSON for a <script> tag. "<" is escaped so no field can close the tag early. */
export function asJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
