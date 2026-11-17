import {
  FUNCTION_LABELS,
  MOLECULE_LABELS,
  SUBJECT_LABELS,
  glyphPath,
} from "../lib/catalogue";

/**
 * The plate: how a record looks before it is read.
 *
 * Three drawings, doing three different jobs. The subject engraving is the
 * ground, the function emblem is the figure acting on it, and the medium
 * hallmark is stamped in the corner at the same size on every record, so the
 * eye learns that corner and stops reading it consciously.
 *
 * Most records are not classified yet, and a blank frame would be worse than
 * no frame, so the plate degrades deliberately rather than by accident:
 *
 *   function + subject  the full composition
 *   function only       the emblem alone, centred
 *   subject only        the engraving alone
 *   neither             the hallmark alone, enlarged
 *
 * The last case is not an error state and is not drawn as one. Every record
 * has a molecule type, so every record has a plate.
 *
 * The drawings and the reasoning behind the sets are in
 * public/glyphs/README.md.
 */

export type PlateSize = "card" | "hero";

interface PlateProps {
  moleculeType: string;
  functionClass?: string | null;
  subjectClass?: string | null;
  size?: PlateSize;
}

/** One sentence describing the whole plate, for a screen reader. */
function describe(
  moleculeType: string,
  functionClass?: string | null,
  subjectClass?: string | null,
): string {
  const molecule = MOLECULE_LABELS[moleculeType] ?? moleculeType;
  const fn = functionClass ? FUNCTION_LABELS[functionClass] ?? functionClass : null;
  const subject = subjectClass ? SUBJECT_LABELS[subjectClass] ?? subjectClass : null;

  if (fn && subject) return `${fn} acting on a ${subject.toLowerCase()}. ${molecule}.`;
  if (fn) return `${fn}. ${molecule}.`;
  if (subject) return `Acts on a ${subject.toLowerCase()}. ${molecule}.`;
  return `${molecule}. Not yet classified.`;
}

export function Plate({
  moleculeType,
  functionClass,
  subjectClass,
  size = "card",
}: PlateProps) {
  const subject = glyphPath("subject", subjectClass);
  const fn = glyphPath("function", functionClass);
  const hallmark = glyphPath("medium", moleculeType);

  // What stands alone in the middle when there is no engraving to stand on.
  const solo = fn ?? hallmark;

  return (
    <div
      className={`plate plate-${size}`}
      role="img"
      aria-label={describe(moleculeType, functionClass, subjectClass)}
    >
      {subject ? (
        <>
          <img className="plate-ground" src={subject} alt="" aria-hidden="true" />
          {fn ? (
            <span className="plate-figure">
              <img src={fn} alt="" aria-hidden="true" />
            </span>
          ) : null}
        </>
      ) : solo ? (
        <img className="plate-solo" src={solo} alt="" aria-hidden="true" />
      ) : null}

      {/* The stamp is omitted only when it is already the solo drawing, so it
          is never shown twice on one plate. */}
      {hallmark && (subject || fn) ? (
        <img className="plate-stamp" src={hallmark} alt="" aria-hidden="true" />
      ) : null}
    </div>
  );
}

/**
 * What the plate is showing, in words, for the record page.
 *
 * Kept beside the drawing rather than inside it, because a plate that is
 * mistaken for a picture of the molecule is worse than no plate: these are
 * house drawings of a class of thing, not depictions of this sequence.
 */
export function PlateCaption({
  functionClass,
  subjectClass,
}: {
  functionClass?: string | null;
  subjectClass?: string | null;
}) {
  const fn = functionClass ? FUNCTION_LABELS[functionClass] ?? functionClass : null;
  const subject = subjectClass ? SUBJECT_LABELS[subjectClass] ?? subjectClass : null;

  if (!fn && !subject) {
    return (
      <p className="plate-caption">
        This record has not been classified yet, so the plate shows only what it
        is made of.
      </p>
    );
  }

  return (
    <p className="plate-caption">
      {fn ? <strong>{fn}</strong> : null}
      {fn && subject ? ", acting on " : null}
      {!fn && subject ? "Acts on " : null}
      {subject ? <strong>{subject.toLowerCase()}</strong> : null}.{" "}
      <span className="plate-caption-note">
        A house drawing of that class of thing, not a depiction of this sequence.
      </span>
    </p>
  );
}
