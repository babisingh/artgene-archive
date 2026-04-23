import Link from "next/link";

export default function GettingStartedPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-10">
      {/* Hero */}
      <div className="space-y-3">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Getting Started with ArtGene
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed">
          ArtGene certifies synthetic DNA sequences through automated biosafety screening and issues
          unique per-recipient codon fingerprints that enable provenance tracing if a distribution copy leaks.
        </p>
      </div>

      {/* Step-by-step */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">
          How it works
        </h2>

        {[
          {
            step: "1",
            title: "Set your API key",
            body: (
              <>
                Click <strong>Set API Key</strong> in the navigation bar and enter the key you were
                issued by your organisation administrator. The key is stored only in your browser session
                and is never sent to any third party.
              </>
            ),
            cta: null,
          },
          {
            step: "2",
            title: "Prepare your sequence",
            body: (
              <>
                ArtGene accepts protein-coding sequences in standard <strong>FASTA format</strong>.
                The sequence must be at least 10 characters. Longer sequences (300+ amino acids)
                provide more synonymous codon positions for fingerprinting.
                <br /><br />
                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs">
                  {">"}MyProtein | Homo sapiens<br />
                  MKTIIALSYIFCLVFA…
                </span>
              </>
            ),
            cta: null,
          },
          {
            step: "3",
            title: "Register your sequence",
            body: (
              <>
                Go to the <Link href="/register" className="text-blue-600 dark:text-blue-400 hover:underline">Register</Link> page
                and fill in the required metadata:
                <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-slate-600 dark:text-slate-400">
                  <li><strong>Owner ID</strong>: your email or researcher username.</li>
                  <li><strong>Organisation UUID</strong>: the UUID assigned to your institution.</li>
                  <li><strong>Ethics Code</strong>: IRB or ethics committee approval reference (e.g. <code>ERC-2026-001</code>).</li>
                  <li><strong>Host Organism</strong>: the intended expression system, which calibrates biosafety thresholds.</li>
                </ul>
              </>
            ),
            cta: { href: "/register", label: "Go to Register →" },
          },
          {
            step: "4",
            title: "Three biosafety gates run automatically",
            body: (
              <>
                After submission, the pipeline runs three sequential gates:
                <div className="mt-3 space-y-2">
                  {[
                    {
                      gate: "Gate 1: Structural Analysis",
                      detail: "Uses ESMFold-derived pLDDT scores to assess predicted folding confidence and RNA minimum free energy (ΔMFE). Sequences predicted to fold into dangerous prion-like or amyloid-prone structures are flagged.",
                      outcome: "If Gate 1 fails, Gates 2 and 3 are skipped (fail-fast).",
                    },
                    {
                      gate: "Gate 2: Composition-Based Heuristic Screen",
                      detail: "Amino acid composition analysis: Kyte-Doolittle hydropathy (GRAVY), cationic/amphipathic toxin scoring, allergen probability estimation, and a curated k-mer screen for known antimicrobial peptide scaffolds. Full BLAST screening against pathogen and toxin databases is in development (Phase 3).",
                      outcome: "Toxin probability above 0.30, allergen probability above 0.40, or k-mer matches to known toxic scaffolds trigger a FAIL. Allergen probability above 0.30 triggers a WARN.",
                    },
                    {
                      gate: "Gate 3: Ecological Risk",
                      detail: "Horizontal Gene Transfer (HGT) propensity scoring and DriftRadar ecological-spread modelling estimate environmental containment risk.",
                      outcome: "High HGT score or escape probability triggers a WARN or FAIL at this gate.",
                    },
                  ].map(({ gate, detail, outcome }) => (
                    <div key={gate} className="card p-4 space-y-1">
                      <div className="font-semibold text-sm text-slate-900 dark:text-white">{gate}</div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{detail}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 italic">{outcome}</p>
                    </div>
                  ))}
                </div>
              </>
            ),
            cta: null,
          },
          {
            step: "5",
            title: "Receive your certificate",
            body: (
              <>
                A successful registration returns a <strong>Certificate</strong> with a unique registry
                ID (e.g. <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">AG-2026-000001</code>).
                <br /><br />
                The certificate records:
                <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-slate-600 dark:text-slate-400">
                  <li><strong>Certificate hash</strong> (SHA3-512) for tamper-evidence.</li>
                  <li>Biosafety gate outcomes for auditing.</li>
                  <li>Provenance Tracing tab — issue per-recipient fingerprinted distribution copies.</li>
                </ul>
              </>
            ),
            cta: { href: "/sequences", label: "View Registry →" },
          },
        ].map(({ step, title, body, cta }) => (
          <div key={step} className="flex gap-5">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
              {step}
            </div>
            <div className="flex-1 space-y-2 pb-6 border-b border-slate-200 dark:border-slate-700 last:border-0">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
              <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{body}</div>
              {cta && (
                <Link href={cta.href} className="btn-primary inline-flex mt-2 text-sm py-1.5 px-3">
                  {cta.label}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>



      {/* FAQ */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">
          Frequently Asked Questions
        </h2>
        {[
          {
            q: "Can I register RNA or DNA sequences?",
            a: "ArtGene currently requires protein-coding sequences provided as FASTA. The DNA sequence is synthesised via codon optimisation when a distribution copy is issued.",
          },
          {
            q: "What is Provenance Tracing?",
            a: "After registering a sequence, you can issue fingerprinted distribution copies for each recipient from the sequence detail page. Each copy embeds a unique codon pattern (same protein, different synonymous codons). If a copy leaks, paste it on the Verify Source page to identify which recipient it came from.",
          },
          {
            q: "What does a CERTIFIED vs REJECTED status mean?",
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
        ].map(({ q, a }) => (
          <div key={q} className="card p-4 space-y-1">
            <div className="font-semibold text-sm text-slate-900 dark:text-white">{q}</div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{a}</p>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="card p-6 text-center space-y-3">
        <div className="text-2xl">🧬</div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Ready to register a sequence?</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Set your API key in the navigation bar, then head to the Register page.
        </p>
        <Link href="/register" className="btn-primary inline-flex">
          Register a Sequence →
        </Link>
      </div>
    </div>
  );
}
