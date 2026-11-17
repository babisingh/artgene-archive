import {
  FUNCTION_LABELS,
  MOLECULE_LABELS,
  SUBJECT_LABELS,
  glyphPath,
} from "../lib/catalogue";

/**
 * The plate: a small mark that gives a record a face.
 *
 * It is deliberately an icon rather than an illustration. A reader finds the
 * record they want by reading the title, so a plate that competes with the
 * title for attention costs more than it gives, and the first version did
 * exactly that at 300px wide.
 *
 * What is drawn depends on how much room there is:
 *
 *   mark  one drawing only: the function emblem, or the medium hallmark when
 *         the record is not classified. At 52px a composition is mush, and
 *         the function is what distinguishes one record from another anyway.
 *   hero  the subject engraving with the emblem on it and the hallmark
 *         stamped in the corner, where a record has a subject and the page
 *         has room for it. Otherwise the same single drawing.
 *
 * Most records are not classified, so most plates are a single hallmark. That
 * is not an error state and is not drawn as one: every record has a molecule
 * type, so every record has a plate.
 *
 * The drawings and the reasoning behind the sets are in
 * public/glyphs/README.md.
 */

export type PlateSize = "mark" | "hero";

interface PlateProps {
  moleculeType: string;
  functionClass?: string | null;
  subjectClass?: string | null;
  size?: PlateSize;
}

/** One sentence describing the plate, for a screen reader and on hover. */
export function describePlate(
  moleculeType: string,
  functionClass?: string | null,
  subjectClass?: string | null,
): string {
  const molecule = MOLECULE_LABELS[moleculeType] ?? moleculeType;
  const fn = functionClass ? FUNCTION_LABELS[functionClass] ?? functionClass : null;
  const subject = subjectClass ? SUBJECT_LABELS[subjectClass] ?? subjectClass : null;

  if (fn && subject) return `${fn}, acting on a ${subject.toLowerCase()}. ${molecule}.`;
  if (fn) return `${fn}. ${molecule}.`;
  if (subject) return `Acts on a ${subject.toLowerCase()}. ${molecule}.`;
  return `${molecule}. Not yet classified.`;
}

export function Plate({
  moleculeType,
  functionClass,
  subjectClass,
  size = "mark",
}: PlateProps) {
  const subject = glyphPath("subject", subjectClass);
  const fn = glyphPath("function", functionClass);
  const hallmark = glyphPath("medium", moleculeType);

  const description = describePlate(moleculeType, functionClass, subjectClass);
  // Both class names are written out in full on purpose. Tailwind 3 drops
  // rules in `@layer components` whose class it cannot find as a literal
  // string while scanning the source, so a template literal like
  // `plate-${size}` makes `.plate-mark` and `.plate-hero` vanish from the
  // built stylesheet with no error anywhere. The first version of this
  // component did that, and the plate silently took whatever width its
  // container happened to give it.
  const className = size === "hero" ? "plate plate-hero" : "plate plate-mark";
  const composed = size === "hero" && subject !== null;
  // What stands alone when there is no composition: the function if the
  // record has one, else what it is made of.
  const solo = fn ?? hallmark;

  return (
    <div
      className={className}
      role="img"
      aria-label={description}
      title={description}
    >
      {composed ? (
        <>
          <img className="plate-ground" src={subject as string} alt="" aria-hidden="true" />
          {fn ? (
            <span className="plate-figure">
              <img src={fn} alt="" aria-hidden="true" />
            </span>
          ) : null}
          {hallmark ? (
            <img className="plate-stamp" src={hallmark} alt="" aria-hidden="true" />
          ) : null}
        </>
      ) : solo ? (
        <img className="plate-solo" src={solo} alt="" aria-hidden="true" />
      ) : null}
    </div>
  );
}
