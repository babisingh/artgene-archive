import { FUNCTION_LABELS, MOLECULE_LABELS, type CatalogueListItem } from "../../lib/catalogue";
import { promotable, publishedRecords, recordUrl, SITE } from "../../lib/record-server";

/**
 * A plain guide for AI assistants (the llms.txt convention): what the archive
 * is, how to read and cite a record, and the records themselves, by title.
 *
 * Made when it is asked for, like the sitemap, so a record published today is
 * listed in the next fetch. It names only records that are promotable, and it
 * names them by title and link alone: never a sequence. If the API cannot be
 * reached, the guide still describes the archive, without the list.
 */
export const dynamic = "force-dynamic";

/** A title on one line, with nothing that would break a Markdown link. */
function linkText(text: string): string {
  return text.replace(/\s+/g, " ").replace(/[[\]]/g, "").trim();
}

function line(record: CatalogueListItem): string {
  const about = [
    MOLECULE_LABELS[record.molecule_type] ?? record.molecule_type,
    record.function_class ? FUNCTION_LABELS[record.function_class] ?? record.function_class : null,
    record.container,
    record.published_on ? record.published_on.slice(0, 4) : null,
  ].filter(Boolean);
  const link = `[${record.registry_id}: ${linkText(record.title)}](${recordUrl(record.registry_id)})`;
  return `- ${link}${about.length ? `: ${about.join(", ")}` : ""}`;
}

export async function GET(): Promise<Response> {
  let records: CatalogueListItem[] = [];
  let listed = true;
  try {
    records = (await publishedRecords()).filter(promotable);
  } catch (error) {
    listed = false;
    console.warn(`llms.txt: the record list could not be read (${error instanceof Error ? error.message : error})`);
  }

  const recordSection = listed
    ? records.length
      ? records.map(line).join("\n")
      : "No records are published yet."
    : `The record list could not be loaded just now. [Browse the catalogue](${SITE}/sequences) instead.`;

  const body = `# ArtGene Archive

> A public catalogue of protein and gene sequences designed by AI models, from papers, preprints and authors' own deposits. Every sequence is screened for biosafety before it is listed.

ArtGene Archive is run by [Genethropic](https://genethropic.com/). Every record says where the sequence came from, which model designed it, and whether it was tested at the bench. Nothing is listed until it has passed biosafety screening, a licence check and human review. Where a licence does not allow redistribution, the record keeps the citation and a checksum instead of the sequence.

There are two kinds of record, told apart by the prefix of the accession:

- AGC-YYYY-NNNNNN: catalogued from published work. The paper or preprint is the primary record; cite it.
- AG-YYYY-NNNNNN: deposited with the archive by its authors. The archive holds the primary copy; cite the record.

## Start here

- [Browse the catalogue](${SITE}/sequences): search and filter every published record.
- [How the archive works](${SITE}/about): what it catalogues, how a record gets in, the biosafety policy, and corrections.
- [API and data](${SITE}/data): read the catalogue and submit sequences through the API.
- [Submit a sequence](${SITE}/submit): deposit an AI-designed sequence with the archive.

## Records

${recordSection}
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // A guide without its list is not kept, so the next reader gets the full one.
      "cache-control": listed ? "public, max-age=3600" : "no-store",
    },
  });
}
