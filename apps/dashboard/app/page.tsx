import Link from "next/link";
import { SearchBox } from "../components/SearchBox";
import { CatalogueSnapshot } from "../components/home/CatalogueSnapshot";

const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Found or submitted",
    body: "The archive reads papers and preprints for AI-designed sequences, and authors can also submit a sequence here directly.",
  },
  {
    n: "02",
    title: "Screened",
    body: "Every sequence is screened for biosafety before anything is stored or published.",
  },
  {
    n: "03",
    title: "Licence checked",
    body: "What the archive may hold depends on the licence. Where redistribution is not permitted, the record keeps the citation and a checksum, and not the sequence.",
  },
  {
    n: "04",
    title: "Reviewed, then listed",
    body: "A person reviews the record before it is published. Nothing is public until then.",
  },
];

export default function HomePage() {
  return (
    <div className="wrap page">
      <section>
        <h1 className="h1">
          A public archive for sequences that <em>nature</em> never wrote.
        </h1>
        <p className="lede" style={{ maxWidth: 680 }}>
          Generative models now design proteins, genes and regulatory elements
          faster than the literature can keep track of them. ArtGene Archive
          catalogues those sequences in one public place: the ones reported in
          papers and preprints, and the ones their authors deposit here
          directly. Every record says where the sequence came from, which model
          designed it, and whether it was tested at the bench. Every sequence is
          screened for biosafety before it is listed.
        </p>

        <div style={{ maxWidth: 560, marginBottom: 12 }}>
          <SearchBox />
        </div>
        <p className="xsmall muted">
          Searches titles, venues and model names. <Link href="/sequences" className="link">Browse with filters</Link> instead.
        </p>
      </section>

      <hr className="rule" />

      <CatalogueSnapshot />

      <hr className="rule" />

      <section>
        <h2 className="h2">How a sequence gets in</h2>
        <ol className="steps" style={{ marginTop: 28 }}>
          {STEPS.map((step) => (
            <li key={step.n}>
              <div className="step-n">{step.n}</div>
              <h3 className="h3">{step.title}</h3>
              <p className="small muted" style={{ margin: 0 }}>
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <hr className="rule" />

      <section>
        <h2 className="h2">Two kinds of record</h2>
        <div className="kinds" style={{ marginTop: 24 }}>
          <div className="card">
            <p className="mono small" style={{ margin: "0 0 10px", color: "var(--ink-3)" }}>
              AGC-0000-000000
            </p>
            <h3 className="h3">Catalogued from published work</h3>
            <p className="small muted" style={{ margin: 0 }}>
              The sequence was reported somewhere else, in a paper or a
              preprint. That publication is the primary record, and the archive
              entry cites it, credits its authors and links to it.
            </p>
          </div>
          <div className="card">
            <p className="mono small" style={{ margin: "0 0 10px", color: "var(--accent)" }}>
              AG-0000-000000
            </p>
            <h3 className="h3">Deposited with the archive</h3>
            <p className="small muted" style={{ margin: 0 }}>
              The sequence was submitted here by its authors, published nowhere
              else or not yet. The archive holds the primary copy and is the
              record you cite.
            </p>
          </div>
        </div>
        <p className="small muted" style={{ marginTop: 18, marginBottom: 0 }}>
          The prefix tells you which kind a record is, wherever you see an
          accession. <Link href="/about" className="link">More about how the archive works</Link>.
        </p>
      </section>
    </div>
  );
}
