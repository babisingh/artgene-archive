// Charter page — /about

const ARTICLES = [
  {
    numeral: "I.",
    title: "Openness",
    body: "All certified records are public, machine-readable, and available under CC-BY-4.0 by default. Mirrors in Hinxton, Mishima, and Bethesda ensure the registry is redundantly preserved.",
  },
  {
    numeral: "II.",
    title: "Neutrality",
    body: "The Archive does not recommend, endorse, or commercialize any generative model or depositor. The registry is agnostic to method and affiliation.",
  },
  {
    numeral: "III.",
    title: "Biosafety first",
    body: "Every deposit undergoes automated three-gate screening. Tier 3 records are never released publicly. The biosafety policy is reviewed by an independent panel annually.",
  },
  {
    numeral: "IV.",
    title: "Attribution, permanently",
    body: "First-deposit priority is recorded on a public Merkle ledger. Contributors and their institutions receive lasting, verifiable credit. Models themselves are credited as generative provenance.",
  },
  {
    numeral: "V.",
    title: "No lock-in",
    body: "The verification protocol is open-source. Certificates can be validated entirely offline. If the Consortium ceases to exist, the data remains readable.",
  },
];

const SIGNATORIES =
  "Wellcome Trust · EMBL-EBI · National Institutes of Health · DDBJ (Japan) · " +
  "Broad Institute · Arc Institute · Chan Zuckerberg Initiative · Institut Pasteur · " +
  "The Francis Crick Institute · RIKEN · UCSF · Wyss Institute · Kyoto University · ETH Zürich";

export default function AboutPage() {
  return (
    <div className="wrap-narrow" style={{ padding: "80px 0 96px" }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="eyebrow mb-16">§ Charter · adopted 14 February 2026</div>
      <h1
        className="display"
        style={{ fontSize: "clamp(36px, 6vw, 64px)", margin: "0 0 24px", lineHeight: 1.05 }}
      >
        A public-interest<br />registry for the<br /><em>machine-designed</em> biome.
      </h1>
      <p className="lede" style={{ margin: "24px 0 40px", maxWidth: 680 }}>
        ArtGene Archive is operated by the ArtGene Consortium — a non-profit federation of
        sequencing institutions, national biosafety authorities, and independent researchers.
        We do not sell access. We do not gate the scholarly record. Our commitments are
        published here in full.
      </p>

      {/* ── Articles ────────────────────────────────────────────── */}
      {ARTICLES.map((article) => (
        <div
          key={article.numeral}
          style={{
            borderTop: "0.5px solid var(--rule)",
            padding: "28px 0",
            display: "grid",
            gridTemplateColumns: "80px 1fr",
            gap: 24,
          }}
        >
          <div
            className="display"
            style={{ fontSize: 32, color: "var(--accent)", lineHeight: 1.1 }}
          >
            {article.numeral}
          </div>
          <div>
            <div
              className="display"
              style={{ fontSize: 26, marginBottom: 8, letterSpacing: "-0.01em" }}
            >
              {article.title}
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>
              {article.body}
            </p>
          </div>
        </div>
      ))}

      {/* ── Signatories ─────────────────────────────────────────── */}
      <div
        style={{
          marginTop: 48,
          padding: "32px 36px",
          background: "var(--paper-3)",
          border: "0.5px solid var(--rule)",
          borderRadius: 6,
        }}
      >
        <div className="eyebrow mb-8">Signatories</div>
        <div style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.7 }}>
          {SIGNATORIES}
        </div>
      </div>
    </div>
  );
}
