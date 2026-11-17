import Link from "next/link";
import { Accession } from "./Accession";
import { Plate } from "./Plate";
import {
  FUNCTION_LABELS,
  MOLECULE_LABELS,
  formatDate,
  type CatalogueListItem,
} from "../lib/catalogue";

/**
 * One record in the browse gallery: the plate first, then the words.
 *
 * The meta line deliberately leads with what the record *does* rather than
 * what it is made of. Molecule type reads "Protein" for the great majority of
 * the archive, so putting it first made every card open the same way; it is
 * still shown, after the thing that actually distinguishes one record from
 * another, and the plate says it again in the corner.
 */
export function RecordCard({ item }: { item: CatalogueListItem }) {
  const molecule = MOLECULE_LABELS[item.molecule_type] ?? item.molecule_type;
  const fn = item.function_class
    ? FUNCTION_LABELS[item.function_class] ?? item.function_class
    : null;
  const published = formatDate(item.published_on ?? item.published_at);

  const meta: string[] = [];
  if (fn) meta.push(fn);
  meta.push(molecule);
  if (item.container) meta.push(item.container);
  if (published) meta.push(published);

  return (
    <li>
      <Link href={`/sequences/${item.registry_id}`} className="record-card">
        <Plate
          moleculeType={item.molecule_type}
          functionClass={item.function_class}
          subjectClass={item.subject_class}
        />
        <div className="record-card-body">
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
        </div>
      </Link>
    </li>
  );
}
