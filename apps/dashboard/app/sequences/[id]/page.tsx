import type { Metadata } from "next";
import { RecordClient } from "../../../components/record/RecordClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: id,
    description: `Record ${id} in the ArtGene Archive catalogue of AI-designed biological sequences.`,
  };
}

export default async function RecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RecordClient id={id} />;
}
