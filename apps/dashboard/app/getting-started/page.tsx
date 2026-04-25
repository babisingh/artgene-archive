import Link from "next/link";

// ---------------------------------------------------------------------------
// Sidebar nav sections
// ---------------------------------------------------------------------------

const NAV = [
  { id: "quick-start",       label: "Quick start",           active: true  },
  { id: "deposit-lifecycle", label: "Deposit lifecycle",      active: false },
  { id: "cli-reference",     label: "CLI reference",          active: false },
  { id: "rest-api",          label: "REST API",               active: false },
  { id: "biosafety-gates",   label: "Biosafety gates",        active: false },
  { id: "watermark-protocol",label: "Watermark protocol",     active: false },
  { id: "ledger-spec",       label: "Ledger spec",            active: false },
  { id: "sdks",              label: "SDKs (Python, R, Julia)",active: false },
];

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mono mb-8" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre
      className="mono"
      style={{
        margin: 0,
        background: "var(--paper)",
        padding: 16,
        border: "0.5px solid var(--rule)",
        borderRadius: 3,
        fontSize: 12.5,
        color: "var(--ink)",
        lineHeight: 1.7,
        overflowX: "auto",
        whiteSpace: "pre",
      }}
    >
      {children}
    </pre>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GettingStartedPage() {
  return (
    <div className="wrap" style={{ padding: "64px 0 96px" }}>
      <div className="grid-12" style={{ gap: 48, alignItems: "start" }}>

        {/* ── Sticky sidebar nav ──────────────────────────────── */}
        <aside style={{ gridColumn: "span 3", position: "sticky", top: 110 }}>
          <div
            className="mono mb-16"
            style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}
          >
            Documentation
          </div>
          {NAV.map(({ id, label, active }) => (
            <a
              key={id}
              href={`#${id}`}
              style={{
                display: "block",
                fontSize: 13,
                padding: "8px 0 8px 12px",
                color: active ? "var(--accent)" : "var(--ink-2)",
                borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                textDecoration: "none",
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              {label}
            </a>
          ))}
        </aside>

        {/* ── Main content ────────────────────────────────────── */}
        <main style={{ gridColumn: "span 9", minWidth: 0 }}>

          {/* ── Quick start ─────────────────────────────────── */}
          <section id="quick-start" style={{ marginBottom: 64 }}>
            <SectionEyebrow>Quick start · ≈ 3 minutes</SectionEyebrow>
            <h1
              className="display"
              style={{ fontSize: "clamp(32px, 4vw, 48px)", margin: "0 0 20px" }}
            >
              Deposit from the command line.
            </h1>
            <p className="lede" style={{ margin: "0 0 32px" }}>
              (Feature under development). The ArtGene CLI handles authentication, FASTA validation, biosafety screening,
              and certificate retrieval in a single command. Read records without an API key;
              deposits require a free institutional key.
            </p>

            <div className="card mb-24">
              <SectionEyebrow>Install</SectionEyebrow>
              <CodeBlock>{`$ pip install artgene
$ artgene auth login`}</CodeBlock>
            </div>

            <div className="card mb-24">
              <SectionEyebrow>Deposit a sequence</SectionEyebrow>
              <CodeBlock>{`$ artgene deposit my-sequence.fasta \\
    --model "ESM-3 v2.1" \\
    --host "E. coli BL21(DE3)" \\
    --license CC-BY-4.0

  ↳ validating FASTA         ✓
  ↳ gate α · structural      ✓ 0.91
  ↳ gate β · off-target      ✓ 0.97
  ↳ gate γ · ecological      ✓ 0.88
  ↳ watermark embedded       ✓ 128-bit
  ↳ certificate minted       ✓ AG-2026-018428
  ↳ anchored to ledger       ✓ block 148903`}</CodeBlock>
            </div>

            <div className="card">
              <SectionEyebrow>Verify any record</SectionEyebrow>
              <CodeBlock>{`$ artgene verify AG-2026-018427
  ✓ certificate valid`}</CodeBlock>
            </div>
          </section>

          {/* ── Deposit lifecycle ───────────────────────────── */}
          <section id="deposit-lifecycle" style={{ marginBottom: 64 }}>
            <div style={{ borderTop: "0.5px solid var(--rule)", paddingTop: 40, marginBottom: 32 }}>
              <SectionEyebrow>Deposit lifecycle</SectionEyebrow>
              <h2 className="display" style={{ fontSize: 32, margin: "8px 0 20px" }}>
                How a deposit becomes a certificate.
              </h2>
            </div>

            {([
              {
                step: "01",
                title: "Prepare your sequence",
                body: (
                  <>
                    ArtGene Archive accepts protein-coding sequences in standard{" "}
                    <strong>FASTA format</strong>. The sequence must be at least 10 characters.
                    Longer sequences (300+ amino acids) provide more synonymous codon positions
                    for fingerprinting.
                    <div className="card mt-16">
                      <CodeBlock>{`>MyProtein | Homo sapiens\nMKTIIALSYIFCLVFA…`}</CodeBlock>
                    </div>
                  </>
                ),
                cta: null,
              },
              {
                step: "02",
                title: "Fill in the deposit form",
                body: (
                  <>
                    Go to the{" "}
                    <Link href="/register" style={{ color: "var(--accent)", textDecoration: "underline" }}>
                      Register
                    </Link>{" "}
                    page and provide sequence metadata — name, molecule type, expression host,
                    generating model, and an ethics approval code.
                    <ul style={{ marginTop: 8, marginLeft: 20, fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.7 }}>
                      <li><strong style={{ color: "var(--ink)" }}>Owner ID</strong> — your email or researcher username.</li>
                      <li><strong style={{ color: "var(--ink)" }}>Ethics Code</strong> — IRB / ethics committee approval reference.</li>
                      <li><strong style={{ color: "var(--ink)" }}>Host Organism</strong> — expression system calibrates gate thresholds.</li>
                    </ul>
                  </>
                ),
                cta: { href: "/register", label: "Open deposit form →" },
              },
              {
                step: "03",
                title: "Three biosafety gates run automatically",
                body: (
                  <>
                    After submission the pipeline runs α → β → γ gates. All must pass for
                    a certificate to be issued. Gate α failure short-circuits the remaining gates.
                  </>
                ),
                cta: { href: "#biosafety-gates", label: "Read gate details →" },
              },
              {
                step: "04",
                title: "Receive your certificate and AG-ID",
                body: (
                  <>
                    A successful run returns a <strong>Certificate</strong> with a unique
                    registry ID (e.g.{" "}
                    <code className="mono" style={{ fontSize: 12, background: "var(--paper-3)", padding: "1px 4px", borderRadius: 2 }}>
                      AG-2026-000001
                    </code>
                    ). The certificate records the SHA3-512 hash, gate outcomes, and watermark
                    carrier positions for auditing.
                  </>
                ),
                cta: { href: "/registry", label: "Browse registry →" },
              },
              {
                step: "05",
                title: "Issue per-recipient distribution copies",
                body: (
                  <>
                    From the sequence detail page, issue fingerprinted copies for each
                    recipient. Each copy embeds a unique codon pattern — same protein,
                    different synonymous codons. Paste any leaked copy into the{" "}
                    <Link href="/verify" style={{ color: "var(--accent)", textDecoration: "underline" }}>
                      Verify Source
                    </Link>{" "}
                    page to identify the origin.
                  </>
                ),
                cta: null,
              },
            ] as const).map(({ step, title, body, cta }) => (
              <div
                key={step}
                style={{ display: "flex", gap: 24, marginBottom: 32, paddingBottom: 32, borderBottom: "0.5px solid var(--rule-2)" }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 11, color: "var(--accent)", letterSpacing: "0.14em",
                    textTransform: "uppercase", flexShrink: 0, paddingTop: 4, width: 28,
                  }}
                >
                  {step}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
                    {title}
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.65 }}>
                    {body}
                  </div>
                  {cta && (
                    <Link
                      href={cta.href}
                      className="btn btn-ghost btn-sm"
                      style={{ marginTop: 12, display: "inline-flex" }}
                    >
                      {cta.label}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </section>

          {/* ── Biosafety gates ─────────────────────────────── */}
          <section id="biosafety-gates" style={{ marginBottom: 64 }}>
            <div style={{ borderTop: "0.5px solid var(--rule)", paddingTop: 40, marginBottom: 32 }}>
              <SectionEyebrow>Biosafety gates</SectionEyebrow>
              <h2 className="display" style={{ fontSize: 32, margin: "8px 0 20px" }}>
                Three sequential checks.
              </h2>
              <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.65, marginBottom: 0 }}>
                Gates run in order. A hard FAIL at any gate prevents the next from running.
                Results are stored in the certificate for auditing.
              </p>
            </div>

            {([
              {
                letter: "α",
                title: "Structural confidence",
                tags: ["ESMFold pLDDT", "LinearFold ΔMFE"],
                detail:
                  "Uses ESMFold-derived pLDDT scores to assess predicted folding confidence and RNA minimum free energy (ΔMFE). Sequences predicted to fold into dangerous prion-like or amyloid-prone structures are flagged.",
                outcome: "Fail → gates β and γ are skipped.",
              },
              {
                letter: "β",
                title: "Off-target homology",
                tags: ["BLAST", "ToxinPred2", "SecureDNA", "IBBIS"],
                detail:
                  "Amino acid composition analysis: Kyte-Doolittle hydropathy (GRAVY), cationic/amphipathic toxin scoring, allergen probability estimation, and a curated k-mer screen for known antimicrobial peptide scaffolds. Full BLAST screening against pathogen and toxin databases is in development.",
                outcome:
                  "Toxin probability > 0.30, allergen > 0.40, or k-mer matches to known toxic scaffolds → FAIL. Allergen > 0.30 → WARN.",
              },
              {
                letter: "γ",
                title: "Ecological risk",
                tags: ["HGT scoring", "DriftRadar"],
                detail:
                  "Horizontal Gene Transfer (HGT) propensity scoring and DriftRadar ecological-spread modelling estimate environmental containment risk.",
                outcome: "High HGT score or escape probability → WARN or FAIL.",
              },
            ] as const).map(({ letter, title, tags, detail, outcome }) => (
              <div
                key={letter}
                className="card"
                style={{ marginBottom: 16, display: "grid", gridTemplateColumns: "48px 1fr", gap: 20 }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  border: "0.5px solid var(--ink)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, color: "var(--accent)", flexShrink: 0,
                }}>
                  {letter}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                    {title}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="mono"
                        style={{ fontSize: 10.5, padding: "2px 7px", background: "var(--paper-3)", border: "0.5px solid var(--rule)", borderRadius: 2, color: "var(--ink-3)", letterSpacing: "0.05em" }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6, margin: "0 0 8px" }}>{detail}</p>
                  <p style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", margin: 0 }}>{outcome}</p>
                </div>
              </div>
            ))}
          </section>

          {/* ── FAQ ─────────────────────────────────────────── */}
          <section id="faq">
            <div style={{ borderTop: "0.5px solid var(--rule)", paddingTop: 40, marginBottom: 32 }}>
              <SectionEyebrow>FAQ</SectionEyebrow>
              <h2 className="display" style={{ fontSize: 32, margin: "8px 0 0" }}>
                Frequently asked questions.
              </h2>
            </div>

            {([
              {
                q: "Can I register RNA or DNA sequences?",
                a: "ArtGene currently requires protein-coding sequences provided as FASTA. The DNA sequence is synthesised via codon optimisation when a distribution copy is issued.",
              },
              {
                q: "What is Provenance Tracing?",
                a: "After registering a sequence, you can issue fingerprinted distribution copies for each recipient from the sequence detail page. Each copy embeds a unique codon pattern (same protein, different synonymous codons). If a copy leaks, paste it on the Verify Source page to identify which recipient it came from.",
              },
              {
                q: "What does CERTIFIED vs REJECTED mean?",
                a: "CERTIFIED means the sequence passed all applicable biosafety gates and has been issued a certificate with a registry ID. REJECTED means one or more gates returned a hard FAIL, and the sequence cannot be registered until the safety concern is resolved.",
              },
              {
                q: "Where can I find my Organisation UUID?",
                a: "Your organisation UUID is assigned by the ArtGene platform administrator when your institution is onboarded. Contact your system administrator if you do not have it.",
              },
              {
                q: "How is the certificate hash computed?",
                a: "The certificate hash is a SHA3-512 digest of the canonical certificate JSON (excluding the hash field itself). It can be used to verify that a certificate has not been tampered with.",
              },
            ] as const).map(({ q, a }) => (
              <div
                key={q}
                style={{ borderTop: "0.5px solid var(--rule-2)", padding: "20px 0" }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>{q}</div>
                <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>{a}</p>
              </div>
            ))}

            {/* Bottom CTA */}
            <div
              className="card"
              style={{ marginTop: 40, textAlign: "center", padding: "40px 32px" }}
            >
              <div className="eyebrow mb-8">Ready to deposit?</div>
              <h3 className="display" style={{ fontSize: 28, margin: "0 0 12px" }}>
                Register a sequence now.
              </h3>
              <p style={{ fontSize: 14, color: "var(--ink-3)", marginBottom: 24 }}>
                Deposits are free for public records. A certificate is issued in under two minutes.
              </p>
              <Link href="/register" className="btn btn-primary">
                Open deposit form →
              </Link>
            </div>
          </section>

        </main>
      </div>{/* end grid-12 */}
    </div>
  );
}
