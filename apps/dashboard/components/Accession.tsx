import { accessionKind, KIND_LABEL, KIND_TOOLTIP, type RecordKind } from "../lib/catalogue";

/**
 * An accession and the badge that says what kind of record it is.
 *
 * The two prefixes mean different things and the difference matters to anyone
 * citing a record, so the badge travels with the accession everywhere it
 * appears. The short label carries a title tooltip with the full explanation;
 * the record page says it in full in prose as well.
 */
export function KindBadge({ kind }: { kind: RecordKind }) {
  return (
    <span
      className={kind === "catalogue" ? "badge" : "badge badge-accent"}
      title={KIND_TOOLTIP[kind]}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}

export function Accession({
  id,
  kind,
  showBadge = true,
}: {
  id: string;
  kind?: RecordKind;
  showBadge?: boolean;
}) {
  const resolved = kind ?? accessionKind(id);
  return (
    <>
      <span className="accession">{id}</span>
      {showBadge ? <KindBadge kind={resolved} /> : null}
    </>
  );
}
