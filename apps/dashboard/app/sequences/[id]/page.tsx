import type { Metadata } from "next";
import { RecordClient } from "../../../components/record/RecordClient";
import {
  asJsonLd,
  datasetMarkup,
  publicRecord,
  recordDescription,
  recordUrl,
} from "../../../lib/record-server";

// Read per request: a record can be published or corrected at any moment.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const record = await publicRecord(id);
  if (!record) {
    return {
      title: id,
      description: `Record ${id} in the ArtGene Archive catalogue of AI-designed biological sequences.`,
    };
  }
  const title = `${record.title} (${record.registry_id})`;
  const description = recordDescription(record);
  const url = recordUrl(record.registry_id);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: "ArtGene Archive",
      title,
      description,
      url,
    },
  };
}

export default async function RecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // On the server when it can be had, so the page arrives with the record in
  // it; otherwise the browser loads it, as it always did.
  const record = await publicRecord(id);
  const dataset = record ? datasetMarkup(record) : null;
  return (
    <>
      {dataset && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: asJsonLd(dataset) }}
        />
      )}
      <RecordClient id={id} initialRecord={record ?? undefined} />
    </>
  );
}
