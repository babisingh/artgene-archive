import type { Metadata } from "next";
import { Suspense } from "react";
import { BrowseClient } from "../../components/browse/BrowseClient";

export const metadata: Metadata = {
  title: "Browse the catalogue",
  description:
    "Search and filter the archive's records of AI-designed biological sequences.",
};

export default function SequencesPage() {
  // useSearchParams needs a Suspense boundary, and the fallback is what a
  // visitor sees for the moment before the filters hydrate.
  return (
    <Suspense
      fallback={
        <div className="wrap page">
          <h1 className="h1" style={{ fontSize: "clamp(28px, 5vw, 40px)" }}>
            Browse the catalogue
          </h1>
          <p className="muted small" role="status">
            Reading the catalogue.
          </p>
        </div>
      }
    >
      <BrowseClient />
    </Suspense>
  );
}
