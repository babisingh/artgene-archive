"use client";

import { useState } from "react";
import type { Author } from "../../lib/catalogue";

/**
 * The authors of a paper, without burying the paper.
 *
 * A Nature-sized author list is thirty or more names, and repeating each one's
 * affiliation inline means the same department is printed twenty times before
 * a reader reaches anything about the work. That is what this page used to do,
 * and it pushed the science below the fold on every catalogue record.
 *
 * So: three names and a count by default. Expanded, every name is shown with a
 * superscript into a deduplicated, numbered affiliation list, which is how a
 * journal sets it and why a journal sets it that way.
 */

function orcidUrl(orcid: string): string {
  return `https://orcid.org/${orcid}`;
}

function AuthorName({ author, index }: { author: Author; index: number | null }) {
  const name = author.orcid ? (
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
  );

  return (
    <>
      {name}
      {index !== null ? <sup className="author-aff">{index}</sup> : null}
      {author.is_corresponding ? (
        <sup className="author-corr" title="Corresponding author">
          *
        </sup>
      ) : null}
    </>
  );
}

export function AuthorList({ authors }: { authors: Author[] }) {
  const [expanded, setExpanded] = useState(false);

  if (authors.length === 0) return null;

  // One entry per distinct affiliation, in the order the authors appear, so
  // the numbering reads the way the by-line does.
  const affiliations: string[] = [];
  for (const author of authors) {
    if (author.affiliation && !affiliations.includes(author.affiliation)) {
      affiliations.push(author.affiliation);
    }
  }
  const indexOf = (author: Author): number | null =>
    author.affiliation ? affiliations.indexOf(author.affiliation) + 1 : null;

  const corresponding = authors.filter((a) => a.is_corresponding);
  const shown = 3;
  const rest = authors.length - shown;

  if (!expanded) {
    return (
      <div className="authors">
        <p className="authors-line">
          {authors.slice(0, shown).map((author, i) => (
            <span key={`${author.full_name}-${i}`}>
              {i > 0 ? ", " : ""}
              {author.full_name}
            </span>
          ))}
          {rest > 0 ? (
            <span className="muted">
              {" "}
              and {rest} {rest === 1 ? "other" : "others"}
            </span>
          ) : null}
        </p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpanded(true)}>
          {authors.length === 1
            ? "Show the author"
            : `Show all ${authors.length} authors`}
        </button>
      </div>
    );
  }

  return (
    <div className="authors">
      <p className="authors-line">
        {authors.map((author, i) => (
          <span key={`${author.full_name}-${i}`}>
            {i > 0 ? "; " : ""}
            <AuthorName author={author} index={indexOf(author)} />
          </span>
        ))}
      </p>

      {affiliations.length > 0 ? (
        <ol className="authors-aff">
          {affiliations.map((affiliation) => (
            <li key={affiliation}>{affiliation}</li>
          ))}
        </ol>
      ) : null}

      {corresponding.length > 0 ? (
        <p className="authors-corr">
          <span aria-hidden="true">*</span>{" "}
          {corresponding.length === 1 ? "Corresponding author: " : "Corresponding authors: "}
          {corresponding.map((a) => a.full_name).join(", ")}
        </p>
      ) : null}

      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpanded(false)}>
        Hide the full list
      </button>
    </div>
  );
}
