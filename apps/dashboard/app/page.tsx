import Link from "next/link";
import { Counter } from "../components/design/Counter";
import { Ticker } from "../components/design/Ticker";
import { Helix } from "../components/design/Helix";
import { CodonGrid } from "../components/design/CodonGrid";
import { CertSeal } from "../components/design/CertSeal";
import { PillarIcon } from "../components/design/PillarIcon";

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const TICKER_ITEMS = [
  { id: "AG-2026-018427", name: "Thermostable carbonic anhydrase variant",  org: "ETH Zürich · Platt Lab",  time: "3 min ago"  },
  { id: "AG-2026-018426", name: "CRISPR-Cas13d gRNA scaffold",              org: "Broad Institute",          time: "14 min ago" },
  { id: "AG-2026-018425", name: "GLP-1R agonist mimetic",                   org: "Institut Pasteur",         time: "22 min ago" },
  { id: "AG-2026-018424", name: "Anti-malarial antibody H3",                org: "GlaxoSmithKline",          time: "38 min ago" },
  { id: "AG-2026-018423", name: "Plastic-degrading MHETase",                org: "Kyoto University",         time: "1 hr ago"   },
  { id: "AG-2026-018422", name: "Synthetic promoter SP-Δ14",               org: "Wyss Institute",           time: "2 hr ago"   },
];

const STATS = [
  { n: 100, label: "Sequences certified",         sub: "across 10 countries"       },
  { n: 40,   label: "AI Generating models tracked",   sub: "7 institutions"           },
  { n: 12,    label: "Biosafety review panels",     sub: "3-tier gated"             },
  { n: 15,  label: "Citations referencing AG-IDs", sub: "peer-reviewed, 2026 YTD" },
];

const PILLARS: { n: string; title: string; icon: "shield" | "wm" | "cert" | "star"; body: string }[] = [
  {
    n: "01", title: "Biosafety screening", icon: "shield",
    body: "Three automated gates run on every deposit: structural confidence (ESMFold pLDDT), off-target homology (BLAST + ToxinPred2), and ecological risk (HGT + DriftRadar). Flagged records route to a human panel within 24h.",
  },
  {
    n: "02", title: "Codon watermark", icon: "wm",
    body: "Synonymous codon substitution encodes a 128-bit institutional signature into the coding sequence. The watermark survives translation and is recoverable from re-sequenced DNA - provenance that travels with the molecule.",
  },
  {
    n: "03", title: "Tamper-evident certificate", icon: "cert",
    body: "Each deposit issues a signed JSON certificate anchored to a Merkle ledger. The AG-ID, the sequence hash, the model, and the biosafety scorecard are all cryptographically bound. Trust but verify.",
  },
  {
    n: "04", title: "Contributor recognition", icon: "star",
    body: "Researchers, labs and institutions accumulate a verifiable public record of depositions. First-deposit priority is time-stamped and permanent. Models themselves are credited as generative provenance.",
  },
];

const PROCESS_STEPS = [
  { n: "01", t: "Submit",  d: "FASTA, GenBank or raw sequence. Metadata is optional but encouraged." },
  { n: "02", t: "Gate α",  d: "Structural confidence — ESMFold pLDDT, RFDiffusion plausibility." },
  { n: "03", t: "Gate β",  d: "Off-target screen — BLAST vs. pathogen DB, ToxinPred2 inference." },
  { n: "04", t: "Gate γ",  d: "Ecological risk — HGT probability, DriftRadar invasiveness score." },
  { n: "05", t: "Certify", d: "Watermark embedded, AG-ID minted, certificate anchored to ledger." },
];

const PARTNERS = [
  "WELLCOME TRUST-mock", "NIH-mock", "EMBL-EBI-mock", "DDBJ-mock", "SecureBio-mock", "Center-C",
  "CZI-mock", "BROAD--mock", "PASTEUR-mock", "Anthropic-mock", "RIKEN-mock", "EU-mock",
];

// ---------------------------------------------------------------------------
// Page (Server Component — Counter is the only client island)
// ---------------------------------------------------------------------------

export default function HomePage() {
  return (
    <div className="route">

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 0 40px", position: "relative" }}>
        <div className="wrap grid-12" style={{ alignItems: "start", gap: 48 }}>

          {/* Left — text */}
          <div style={{ gridColumn: "span 7" }}>
            <div className="eyebrow mb-16" style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ width: 24, height: "0.5px", background: "var(--ink-3)" }} />
              ArtGene Consortium · Volume I · 2026
            </div>
            <h1 className="display" style={{ fontSize: "clamp(24px, 5vw, 60px)", margin: "0 0 28px" }}>
              A public archive<br />
              for sequences that<br />
              <em style={{ fontStyle: "italic", color: "var(--accent)" }}>nature</em> never wrote.
            </h1>
            <p className="lede" style={{ maxWidth: 620, margin: "0 0 36px" }}>
              Generative models now produce proteins, genes and regulatory elements faster than the
              scientific community can catalogue. ArtGene Archive is the first dedicated registry
              for AI-designed biological sequences — providing watermarking, biosafety certification,
              and an auditable chain of custody from model to bench to publication,
              while sepearting naturally occuring sequences from the ones created by
              humans in collaboration with AI.
              Art(ificial)-gene Archive only store sequences that pass multiple biosecurity screening gates (See demo).

            </p>
            <div className="flex gap-12 hero-cta" style={{ alignItems: "center", flexWrap: "wrap" }}>
              <Link href="/register" className="btn btn-primary">
                Deposit a sequence
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1" />
                </svg>
              </Link>
              <Link href="/registry" className="btn btn-ghost">
                View an example record
              </Link>
              <a
                href="#"
                className="mono hero-cta-link"
                style={{ fontSize: 11.5, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase", marginLeft: 16 }}
              >
                ↳ Read the founding paper (PDF, 2.1 MB)
              </a>
            </div>
          </div>

          {/* Right — helix (hidden on mobile via .hero-visual CSS class) */}
          <div className="hero-visual" style={{ gridColumn: "span 5", position: "relative" }}>
            <div className="helix-wrap">
              <Helix />
            </div>
            <div style={{ position: "absolute", bottom: 0, left: 0, fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", lineHeight: 1.7 }}>
              Figure 01<br />
              <span style={{ color: "var(--ink-4)" }}>Idealised helix, rendered from<br />a watermarked 648 bp fragment.</span>
            </div>
          </div>

        </div>
      </section>

      {/* ── LIVE TICKER ───────────────────────────────────────────────────── */}
      <Ticker items={TICKER_ITEMS} />

      {/* ── STATS STRIP ───────────────────────────────────────────────────── */}
      <section className="wrap" style={{ padding: "64px 0 40px" }}>
        {/* stats-grid CSS class handles display:grid and responsive columns */}
        <div className="stats-grid">
          {STATS.map((s, i) => (
            <div key={i} style={{
              padding: "32px 28px 28px",
              borderRight: i < 3 ? "0.5px solid var(--rule)" : "none",
              borderBottom: "0.5px solid var(--rule)",
            }}>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
                {String(i + 1).padStart(2, "0")} / {s.label}
              </div>
              <div className="serif" style={{ fontSize: 56, letterSpacing: "-0.02em", lineHeight: 1, color: "var(--ink)" }}>
                <Counter to={s.n} />
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 10 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── MISSION / EDITORIAL ───────────────────────────────────────────── */}
      <section className="wrap" style={{ padding: "72px 0" }}>
        {/* mission-grid CSS class handles responsive two-column → single-column */}
        <div className="mission-grid">

          <div>
            <div className="eyebrow mb-16">§ 01 — Thesis</div>
            <h2 className="display" style={{ fontSize: 30, margin: 0 }}>
              What GenBank was to the sequencing machine, <br /> ArtGene Archive is to the <em>generative model</em>.
            </h2>
          </div>

          <div style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--ink-2)" }}>
            <p style={{ marginTop: 0 }}>
              In 1982 a small group at the National Institutes of Health recognised that automated
              sequencers had begun to produce DNA data faster than journals or institutions could
              track. The response - a public, federated, machine-readable catalogue became the
              scaffolding of modern biology.
            </p>
            <p>
              <br />
              Forty-four years later we stand at a structurally identical moment. A frontier model
              can now propose a functional enzyme in milliseconds. A graduate student with a laptop
              and a credit card can order it as DNA before lunch. The community has no shared
              infrastructure to know which sequences were machine-designed, who designed them, what
              safety checks were applied, or whether they were ever observed in nature.
            </p>
            <p>
              <br />
              <strong>ArtGene Archive is that infrastructure.</strong> We provide a dedicated deposit
              path, automated three-gate biosafety screening (more under development), cryptographic watermarking via codon
              steganography, tamper-evident certification, and formal recognition for contributors.
              Deposits are free. Records are public. The registry will be governed by an international
              consortium.
            </p>
            <p className="mono" style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 28, paddingLeft: 18, borderLeft: "2px solid var(--accent)" }}>
              The absence of this infrastructure is a biosecurity risk today. Its presence could
              accelerate safe, citizen-driven biological innovations at the scale the moment demands.
            </p>
          </div>

        </div>
      </section>

      <hr className="hr" />

      {/* ── FOUR PILLARS ──────────────────────────────────────────────────── */}
      <section className="wrap" style={{ padding: "30px 0" }}>
        <div className="flex between center mb-20 pillars-header">
          <div>
            <div className="eyebrow mb-8">§ 02 — What the archive does</div>
            <h2 className="display" style={{ fontSize: 44, margin: 0 }}>Four pillars.</h2>
          </div>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Automated · open · auditable
          </div>
        </div>

        {/* pillars-grid CSS class handles display:grid and responsive columns */}
        <div className="pillars-grid">
          {PILLARS.map((p, i) => (
            <div key={p.n} style={{ padding: "36px 32px 40px", borderRight: i < 3 ? "0.5px solid var(--rule)" : "none" }}>
              <div style={{ height: 56, display: "flex", alignItems: "center", marginBottom: 18 }}>
                <PillarIcon kind={p.icon} />
              </div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--accent)", letterSpacing: "0.14em", marginBottom: 10 }}>{p.n}</div>
              <h3 className="serif" style={{ fontSize: 24, margin: "0 0 12px", letterSpacing: "-0.01em" }}>{p.title}</h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)", margin: 0 }}>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── WATERMARK SHOWCASE ────────────────────────────────────────────── */}
      <section style={{ background: "var(--paper-3)", padding: "88px 0" }}>
        <div className="wrap grid-12" style={{ alignItems: "center", gap: 48 }}>

          {/* Left — copy */}
          <div style={{ gridColumn: "span 5" }}>
            <div className="eyebrow mb-16">§ 03 — On codon steganography</div>
            <h2 className="display" style={{ fontSize: 44, margin: "0 0 20px" }}>
              An invisible<br />signature, <em>baked<br />into the molecule.</em>
            </h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.65, color: "var(--ink-2)", marginBottom: 20 }}>
              Because most amino acids are encoded by multiple synonymous codons, a coding sequence
              can carry arbitrary information without altering the protein it produces. ArtGene
              exploits this redundancy to embed a 128-bit institutional signature — a fingerprint
              that persists across plasmid transfer, re-synthesis, and publication.
            </p>
            <p style={{ fontSize: 15.5, lineHeight: 1.65, color: "var(--ink-2)" }}>
              Re-sequence the molecule in any lab on earth and our verifier will return the AG-ID,
              the depositing institution, and the original certificate — or fail cleanly and tell
              you it cannot.
            </p>
            <Link href="/getting-started" className="btn btn-ghost mt-24">
              Read the technical specification →
            </Link>
          </div>

          {/* Right — visualisation */}
          <div style={{ gridColumn: "7 / 13" }}>
            <div style={{ background: "var(--paper-2)", border: "0.5px solid var(--rule)", borderRadius: 6, padding: 28 }}>
              <div className="flex between center mb-16">
                <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Watermark · 128-bit · recovered
                </div>
                <span className="badge badge-verify badge-dot">Verified</span>
              </div>
              <div style={{ aspectRatio: "2 / 1", marginBottom: 16 }}>
                <CodonGrid rows={8} cols={16} />
              </div>
              <div className="seq-block" style={{ fontSize: 11, padding: "14px 16px" }}>
                <div><span className="idx">001</span>ATG<span className="wm">GCT</span>AAG<span className="wm">CCG</span>TAT<span className="wm">GAA</span>AAC<span className="wm">TGG</span>CTG<span className="wm">CAC</span>GAC</div>
                <div><span className="idx">031</span>TTC<span className="wm">ATC</span>GTG<span className="wm">AAA</span>GAT<span className="wm">CTG</span>GCC<span className="wm">AGC</span>CAG<span className="wm">TTT</span>CCG</div>
                <div><span className="idx">061</span>AAT<span className="wm">GTG</span>TAC<span className="wm">CGC</span>GAA<span className="wm">ATG</span>CTG<span className="wm">CAT</span>GCG<span className="wm">AGC</span>ACC</div>
              </div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)", marginTop: 12, letterSpacing: "0.04em" }}>
                HIGHLIGHTED TRIPLETS CARRY THE SIGNATURE. PROTEIN SEQUENCE IS UNCHANGED.
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── BIOSAFETY PROCESS ─────────────────────────────────────────────── */}
      <section className="wrap" style={{ padding: "88px 0" }}>
        <div className="eyebrow mb-16">§ 04 — Deposit pathway</div>
        <h2 className="display" style={{ fontSize: 44, margin: "0 0 48px" }}>
          From upload to bio-screening to certificate<br /><em>in one seamless pipeline.</em>
        </h2>

        {/* process-steps CSS class handles display:grid and responsive columns */}
        <div className="process-steps">
          {/* Connecting rule — hidden on mobile via .process-connector CSS class */}
          <div className="process-connector" style={{ position: "absolute", top: 24, left: "10%", right: "10%", height: "0.5px", background: "var(--rule)" }} aria-hidden="true" />

          {PROCESS_STEPS.map((s) => (
            <div key={s.n} style={{ position: "relative" }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: "var(--paper)", border: "0.5px solid var(--ink)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 18, fontFamily: "var(--mono)", fontSize: 12,
                position: "relative", zIndex: 1,
              }}>
                {s.n}
              </div>
              <div className="serif" style={{ fontSize: 22, marginBottom: 8 }}>{s.t}</div>
              <div style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.55 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CERT SHOWCASE ─────────────────────────────────────────────────── */}
      <section style={{ background: "var(--ink)", color: "var(--paper)", padding: "96px 0" }}>
        <div className="wrap grid-12" style={{ alignItems: "center", gap: 48 }}>

          <div style={{ gridColumn: "span 5", display: "flex", justifyContent: "center" }}>
            <CertSeal size={280} />
          </div>

          <div style={{ gridColumn: "7 / 13" }}>
            <div className="eyebrow mb-16" style={{ color: "rgba(250,250,246,0.6)" }}>§ 05 — The certificate</div>
            <h2 className="display" style={{ fontSize: 48, margin: "0 0 24px", color: "var(--paper)" }}>
              Every record is signed.<br />Every signature is<br />
              <em style={{ color: "var(--accent)" }}>public and verifiable.</em>
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: "rgba(250,250,246,0.75)", maxWidth: 540, marginBottom: 32 }}>
              ArtGene certificates are signed JSON objects anchored to a public Merkle ledger.
              Any record can be verified offline with our open-source CLI. No vendor lock-in.
              No gatekeeping. No ambiguity about who deposited what, when, and under what biosafety conditions.
            </p>
            <div style={{ background: "rgba(250,250,246,0.06)", border: "0.5px solid rgba(250,250,246,0.2)", borderRadius: 6, padding: "20px 24px", fontFamily: "var(--mono)", fontSize: 11.5, lineHeight: 1.8, color: "rgba(250,250,246,0.8)", letterSpacing: "0.02em", overflowX: "auto" }}>
              <div style={{ color: "var(--accent)" }}>// Verify any record</div>
              <div>$ artgene verify AG-2026-018427</div>
              <div style={{ color: "rgba(250,250,246,0.5)" }}>{"  ↳ hash: a9f0c3e8...b41d — OK"}</div>
              <div style={{ color: "rgba(250,250,246,0.5)" }}>{"  ↳ sig: ETH-ZURICH-PLATT-LAB — OK"}</div>
              <div style={{ color: "rgba(250,250,246,0.5)" }}>{"  ↳ ledger: block 148,902 — OK"}</div>
              <div style={{ color: "var(--accent)" }}>{"  ✓ certificate valid · 2026-04-18T14:22Z"}</div>
            </div>
          </div>

        </div>
      </section>

      {/* ── ENDORSEMENTS ──────────────────────────────────────────────────── */}
      <section className="wrap" style={{ padding: "88px 0" }}>
        <div className="eyebrow mb-16" style={{ textAlign: "center" }}>§ 06 — Governance &amp; partners</div>
        <h2 className="display" style={{ fontSize: 36, textAlign: "center", margin: "0 auto 48px", maxWidth: 720 }}>
          ArtGene Archive is operated as public-interest infrastructure. Let's build it together.
        </h2>
        {/* partners-grid CSS class handles display:grid and responsive columns */}
        <div className="partners-grid">
          {PARTNERS.map((name, i) => (
            <div key={i} style={{
              padding: "28px 20px", height: 96,
              borderRight: i % 6 < 5 ? "0.5px solid var(--rule)" : "none",
              borderBottom: i < 6 ? "0.5px solid var(--rule)" : "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.12em", color: "var(--ink-3)",
            }}>
              {name}
            </div>
          ))}
        </div>
        <div className="mono" style={{ textAlign: "center", marginTop: 24, fontSize: 10.5, color: "var(--ink-4)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Collaborators · Charter signatories · Funding partners
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section style={{ background: "var(--paper-3)", padding: "80px 0", borderTop: "0.5px solid var(--rule)" }}>
        <div className="wrap-narrow" style={{ textAlign: "center" }}>
          <h2 className="display" style={{ fontSize: 54, margin: "0 0 20px" }}>
            Deposit your first sequence.
          </h2>
          <p className="lede" style={{ margin: "0 auto 32px", maxWidth: 560 }}>
            The registry is free to use, open by default, and takes less than a minute for a standard
            deposit. No institutional account is required to read; one API key is required to deposit.
          </p>
          <div className="flex gap-12" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/register" className="btn btn-primary">Begin deposit →</Link>
            <Link href="/getting-started" className="btn btn-ghost">Read the documentation</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
