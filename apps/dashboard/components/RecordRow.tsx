import Link from "next/link";
import { Accession } from "./Accession";
import {
  MOLECULE_LABELS,
  formatDate,
  type CatalogueListItem,
} from "../lib/catalogue";

/**
 * One row in a list of records, used on the home page and on Browse.
 *
 * Every field shown comes from the list response. Where the API returns null,
 * the line is left out rather than filled with a placeholder.
 */
export function RecordRow({ item }: { item: CatalogueListItem }) {
  const molecule = MOLECULE_LABELS[item.molecule_type] ?? item.molecule_type;
  const published = formatDate(item.published_on ?? item.published_at);

  const meta: string[] = [molecule];
  if (item.generating_model) meta.push(item.generating_model);
  if (item.container) meta.push(item.container);
  if (published) meta.push(published);

  return (
    <li>
      <Link href={`/sequences/${item.registry_id}`} className="record-row">
        <div className="record-head">
          <Accession id={item.registry_id} kind={item.record_kind} />
          {item.wet_lab_validated ? (
            <span
              className="badge badge-verify"
              title="The authors reported testing this sequence at the bench."
            >
              Wet-lab validated
            </span>
          ) : null}
          {item.hosting_decision === "withheld" ? (
            <span
              className="badge badge-warn"
              title="The sequence itself is not held by the archive."
            >
              Sequence withheld
            </span>
          ) : null}
        </div>
        <p className="record-title">{item.title}</p>
        <div className="record-meta">
          {meta.map((part, index) => (
            <span key={index}>
              {index > 0 ? <span className="sep">&middot; </span> : null}
              {part}
            </span>
          ))}
        </div>
      </Link>
    </li>
  );
}
