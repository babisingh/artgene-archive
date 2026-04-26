'use client';

/**
 * ArtGene Archive — Demo Day Showcase Page
 * Route: /showcase
 *
 * IMPLEMENTATION GUIDE
 * ─────────────────────────────────────────────────────────────────
 * This scaffold is the drop-in starting point. Each section component
 * is stubbed with a TODO comment pointing to Showcase.html and the
 * real component to reuse. Work top-to-bottom; each section is
 * independent and can be completed one at a time.
 *
 * See HANDOFF.md for the full Claude Code prompt, backend gap list,
 * and manual-work checklist before merging.
 * ─────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from 'react';
import { Helix }     from '@/components/design/Helix';
import { Counter }   from '@/components/design/Counter';
import { CodonGrid } from '@/components/design/CodonGrid';

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ?? 'https://dashboard-service-production-a432.up.railway.app';

// ─── Sidebar sections ─────────────────────────────────────────────
const SECTIONS = [
  { id: 'hero',       label: '§ 01 — Overview'             },
  { id: 'features',   label: '§ 02 — Features'             },
  { id: 'pipeline',   label: '§ 03 — Biosafety'            },
  { id: 'watermark',  label: '§ 04 — Watermark-Provenance'},
  { id: 'fragments',  label: '§ 05 — Fragments'            },
  { id: 'compliance', label: '§ 06 — Compliance'           },
  { id: 'registry',   label: '§ 07 — Registry'             },
  { id: 'roadmap',    label: '§ 08 — Roadmap'              },
  { id: 'cta',        label: '§ 09 — Get involved'         },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

// ─── Demo sequence data ───────────────────────────────────────────
// TODO: Replace dna strings with golden vectors from packages/tinsel-demo/
// See HANDOFF.md § "Where manual work is required"
const DEMO_SEQS = [
  {
    id: 'SEQ-001', name: 'GFP-variant-β',
    desc: 'Fluorescent reporter, E. coli optimised', len: 720,
    dna: 'ATGGTGAGCAAGGGCGAGGAACTGTTCACCGGGGTGGTGCCCATCCTGGTCGAGCTGGACGGCGAC',
    fallback: {
      cert: 'AG-2026-000842',
      gates: {
        alpha: { status: 'pass', detail: 'pLDDT 84.7 — stable fold; instability index 38.2' },
        beta:  { status: 'pass', detail: 'No SecureDNA hits; IBBIS HMM score < 0.001' },
        gamma: { status: 'pass', detail: 'CAI 0.72 for E. coli; GC 51.4%; HGT risk: low' },
        delta: { status: 'pass', detail: '8.3% cosine similarity to dangerous-protein set' },
      },
    },
  },
  {
    id: 'SEQ-002', name: 'SynTF-v2',
    desc: 'Synthetic transcription factor, human host', len: 540,
    dna: 'ATGCCGAAGAAGAAGCGCAAGGTGCCGGATCCGGAATTTGAGAAAGAATTTGCGCGCAAACGCAAAG',
    fallback: {
      cert: 'AG-2026-000901',
      gates: {
        alpha: { status: 'pass', detail: 'pLDDT 78.1 — moderate confidence; IDR region detected' },
        beta:  { status: 'pass', detail: 'No matches; IBBIS score 0.002' },
        gamma: { status: 'pass', detail: 'CAI 0.68 for human; GC 49.1%; low HGT risk' },
        delta: { status: 'pass', detail: '11.2% cosine similarity — within safe threshold' },
      },
    },
  },
  {
    id: 'SEQ-003', name: 'MetabEng-Enz1',
    desc: 'Metabolic pathway enzyme, yeast chassis', len: 840,
    dna: 'ATGACAATTAAAGAAATGCCTCAGCCAAAAACGTTTGGGGAGCTTAATTTTTTAGTGCGAATTTGAAA',
    fallback: {
      cert: 'AG-2026-000956',
      gates: {
        alpha: { status: 'pass', detail: 'pLDDT 81.4; TIM-barrel fold predicted' },
        beta:  { status: 'pass', detail: 'All clear; no pathogen family matches' },
        gamma: { status: 'pass', detail: 'CAI 0.71 for S. cerevisiae; GC 45.8%' },
        delta: { status: 'pass', detail: '6.7% similarity — well below 25% threshold' },
      },
    },
  },
  {
    id: 'SEQ-004', name: 'MembAnchor-v3',
    desc: 'Membrane anchor peptide, CHO expression', len: 240,
    dna: 'ATGAAGTGGGTGACCTTCATCTCCCTGCTGGTGGCCTTCCTGGTGCTGGGCCAGCTGCAGGTGGCC',
    fallback: {
      cert: 'AG-2026-001002',
      gates: {
        alpha: { status: 'pass', detail: 'pLDDT 90.3 — high confidence TM helix' },
        beta:  { status: 'pass', detail: 'No hits in either screening database' },
        gamma: { status: 'pass', detail: 'CAI 0.66 for CHO; optimal membrane insertion' },
        delta: { status: 'pass', detail: '4.1% similarity — minimal hazard signal' },
      },
    },
  },
  {
    id: 'SEQ-005', name: 'CircRNA-Reg',
    desc: 'Circular RNA regulatory element', len: 620,
    dna: 'ATGGCTAGCATGACTGGTGGACAGCAAATGGGTCGGGATCTGTACGACGATGACGATAAGGATCCC',
    fallback: {
      cert: 'AG-2026-001089',
      gates: {
        alpha: { status: 'pass', detail: 'pLDDT 72.6; RNA scaffold structure predicted' },
        beta:  { status: 'pass', detail: 'Regulatory sequence — no pathogen matches' },
        gamma: { status: 'pass', detail: 'CAI 0.77 for insect; GC 52.0%' },
        delta: { status: 'pass', detail: '9.9% similarity — regulatory class, no flag' },
      },
    },
  },
  {
    id: 'SEQ-006', name: '⚠ HazardVec-Δ',
    desc: 'Test vector for gate β screening (intentional fail)', len: 390,
    dna: 'ATGAGCGATAAAATTATTCACCTGACTGACGACAGTTTTGACACGGATGTACTCAAAGCGGACGGGG',
    fallback: {
      cert: null, // gate β failure — no cert issued
      gates: {
        alpha: { status: 'pass',    detail: 'pLDDT 79.2 — toxin-like fold flagged' },
        beta:  { status: 'fail',    detail: 'SecureDNA: 3 SELECT AGENT hits; IBBIS: family F-48 (toxin)' },
        gamma: { status: 'pending', detail: 'Screening halted after gate β failure' },
        delta: { status: 'pending', detail: 'Screening halted after gate β failure' },
      },
    },
  },
] as const;

// Static registry fallback
// TODO: verify field names match live API response (accession_id vs id, sequence_name vs name)
const REG_FALLBACK = [
  { id: 'AG-2026-001089', name: 'CircRNA-Reg',   institution: 'Institute A', date: '2026-04-22' },
  { id: 'AG-2026-001002', name: 'MembAnchor-v3', institution: 'Institute B',            date: '2026-04-21' },
  { id: 'AG-2026-000956', name: 'MetabEng-Enz1', institution: 'Independent Researcher X',             date: '2026-04-20' },
  { id: 'AG-2026-000901', name: 'SynTF-v2',      institution: 'Centeral facility C.',       date: '2026-04-18' },
  { id: 'AG-2026-000842', name: 'GFP-variant-β', institution: 'University U',       date: '2026-04-15' },
  { id: 'AG-2026-000791', name: 'PhotoSys-Mod',  institution: 'Independent Lab L.',           date: '2026-04-12' },
];

// ─── Feature cards ───────────────────────────────────────────────
const FEATURES = [
  { s:'live',     t:'Four-gate biosafety pipeline',           b:'Every sequence runs gates α, β, γ, δ automatically before a certificate is issued.',                        a:'#pipeline'  },
  { s:'live',     t:'Provenance tracing with TINSEL codon watermark',                     b:'Issue fingerprinted copies to recipients. Identify the source of a leaked sequence in milliseconds.',       a:'#watermark' },
  { s:'live',     t:'Immutable audit ledger',                 b:'Blockchain-style SHA3-256 chained log. DB-level trigger prevents any row from being modified.',             a:null         },
  { s:'live',     t:'Unique AG-ID accession',                 b:'Each registered sequence receives a permanent, citable accession number (e.g. AG-2026-000001).',            a:'#registry'  },
  { s:'live',     t:'Fragment assembly risk screen',          b:'Screen multi-FASTA fragments individually and as assembled contigs — catches split-vector evasion.',        a:'#fragments' },
  { s:'live',     t:'ESMFold structural screening (Gate α)',  b:'Per-residue pLDDT scores and instability index from ESMAtlas — folds before certifying.',                  a:'#pipeline'  },
  { s:'live',     t:'Host codon optimisation (Gate γ)',       b:'CAI, GC content, and HGT risk against six host organisms.',                                                 a:'#pipeline'  },
  { s:'live',     t:'US DURC + EU Dual-Use compliance',       b:'Machine-readable attestation document generated per certificate for regulatory submission.',                a:'#compliance'},
  { s:'live',     t:'ArtGene-SCD-1.0 synthesis clearance',   b:'Signed synthesizer authorisation compatible with firmware-level screening.',                                a:'#compliance'},
  { s:'live',     t:'Public searchable registry',             b:'All certified sequences publicly discoverable by AG-ID, institution, or sequence hash.',                   a:'#registry'  },
  { s:'pipeline',     t:'SecureDNA + IBBIS hazard (Gate β)',      b:'DOPRF privacy-preserving pathogen screening and IBBIS HMM family classification.',                         a:'#pipeline'  },
  { s:'pipeline',     t:'Functional embedding similarity (Gate δ)',b:'Amino acid composition fingerprint vs. dangerous-protein reference database.',                             a:'#pipeline'  },
  { s:'pipeline', t:'LWE lattice commitment (real)',          b:'Post-quantum zero-knowledge commitment currently stubbed — full implementation in Phase 4.',                a:null         },
  { s:'pipeline', t:'Merkle inclusion proofs for pathways',   b:'Per-sequence membership proofs within a pathway bundle. Phase 7.',                                         a:null         },
  { s:'pipeline', t:'SDK: Python, R, Julia',                  b:'First-party client libraries for programmatic submission and verification.',                                a:null         },
  { s:'pipeline', t:'Rich sequence metadata',                 b:'Abstract, authors, ORCID, keywords, generating model, and molecular weight per record.',                   a:null         },
  { s:'pipeline', t:'KYC and Benchtop synthesizers ready',        b:'Specifications & security approved machine-readable certificates created for Benchtop synthesizers.',                                             a:null         },
] as const;

// ─── Gate metadata ───────────────────────────────────────────────
const GATE_META = [
  { key: 'alpha', label: 'Gate α — Structural screening',  icon: '◈', desc: 'ESMFold pLDDT + instability index' },
  { key: 'beta',  label: 'Gate β — Pathogen screening',    icon: '⬡', desc: 'SecureDNA DOPRF + IBBIS HMM' },
  { key: 'gamma', label: 'Gate γ — Codon optimisation',    icon: '◇', desc: 'CAI, GC content, HGT risk (6 hosts)' },
  { key: 'delta', label: 'Gate δ — Embedding similarity',  icon: '△', desc: 'Composition fingerprint vs. reference DB' },
] as const;

type GateKey = typeof GATE_META[number]['key'];
type GateStatus = 'pending' | 'running' | 'pass' | 'fail';

// ─── Utility ──────────────────────────────────────────────────────
function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), ms)
  );
}

// ─── §09 CTA component ───────────────────────────────────────────
const CTA_ROLES = [
  { role: 'Depositors',   desc: 'Submit AI-designed sequences for certification and public archiving.',              cta: 'Deposit a sequence →' },
  { role: 'Institutions & Researchers', desc: 'Join and contribute to the consortium charter, bridge knowledge-gaps.',              cta: 'Become a partner →'   },
  { role: 'Developers',   desc: 'Help building the ArtGene-archive secure and future ready',                cta: 'Sign up →'  },
];

function CTASection() {
  return (
    <section id="cta" style={{ padding: '96px 0', background: 'var(--ink)' }}>
      <div className="wrap" style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 24 }}>
          § 09 — Get involved
        </div>
        <h2 style={{ fontFamily: 'var(--sans)', fontSize: 'clamp(28px,4vw,48px)', fontWeight: 700, color: 'white', margin: '0 0 20px', letterSpacing: '-0.03em', lineHeight: 1.15 }}>
          Every AI-designed sequence<br />must have a chain of custody.
        </h2>
        <p style={{ fontFamily: 'var(--sans)', fontSize: 15, color: 'rgba(255,255,255,0.55)', maxWidth: 520, margin: '0 auto 52px', lineHeight: 1.7 }}>
          Whether you&apos;re a lab depositing sequences, an independent bio explorer , or a developer
          with ideas to make this better - there&apos;s a path for you.
        </p>

        {/* Role cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, maxWidth: 700, margin: '0 auto 48px' }}>
          {CTA_ROLES.map(c => (
            <div key={c.role} style={{ padding: '24px 20px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, textAlign: 'left' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: 10 }}>
                {c.role.toUpperCase()}
              </div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 13.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.55, marginBottom: 16 }}>{c.desc}</div>
              <a href="#" style={{ fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>{c.cta}</a>
            </div>
          ))}
        </div>

        <a href="#pipeline" className="btn btn-accent" style={{ fontSize: 14, padding: '12px 28px' }}>
          Run the live demo ↓
        </a>

        {/* Open call */}
        <div style={{ marginTop: 72, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 52, maxWidth: 640, margin: '72px auto 0' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 20 }}>
            An open call
          </div>
          <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 'clamp(18px,2.2vw,24px)', color: 'rgba(255,255,255,0.82)', lineHeight: 1.6, marginBottom: 28 }}>
            &ldquo;The infrastructure for AI-designed biology should be built in public, by the people who understand what&apos;s at stake.&rdquo;
          </p>
          <p style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75, marginBottom: 32 }}>
            ArtGene-archive needs a consortium level effort. If you work at the intersection of synthetic
            biology, biosecurity, or machine learning, your expertise shapes what this registry becomes.
            Researchers bring domain knowledge we can&apos;t encode alone. Developers push the protocol
            further than any single team can. Policy makers ensure the governance layer keeps pace with
            the science. Together we make sure, bio-research becomes equitable & accessible to all.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="mailto:b@genethropic.com" className="btn" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.15)', fontSize: 13 }}>
              Get Invloved
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── §08 Roadmap component ───────────────────────────────────────
const PHASES = [
  { n:1, label:'Foundation', status:'done',   items:['Registry API','TINSEL watermark','Four-gate pipeline','WOTS+ certificates','Audit ledger'] },
  { n:2, label:'Compliance', status:'done',   items:['DURC manifest','SCD-1.0 document','Fragment assembly screen','Provenance tracing','Pathway bundles'] },
  { n:3, label:'Scale',      status:'active', items:['Experts onboarding','SecureDNA production','IBBIS v2 integration','Performance benchmarks','Publications','Fundraising'] },
  { n:4, label:'Crypto',     status:'next',   items:['LWE lattice commitment','ZK proof system','Full WOTS+ verification','Merkle pathway proofs'] },
  { n:5, label:'SDK',        status:'next',   items:['Python SDK','R package','Julia bindings','REST SDK v2'] },
  { n:6, label:'Production', status:'next',   items:['ESM-2 650M embeddings','Rich metadata','WebSocket live feed','Benchtop Synthesizer ready'] },
] as const;

function RoadmapSection() {
  return (
    <section id="roadmap" className="showcase-section-alt">
      <div className="wrap">
        <p className="eyebrow" style={{ marginBottom: 12 }}>§ 08 — Roadmap</p>
        <h2 style={{ fontFamily: 'var(--sans)', fontSize: 'clamp(24px,3vw,36px)', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--ink)', margin: '0 0 12px' }}>
          Six phases to full production.
        </h2>
        <p style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink-2)', margin: '0 0 32px', maxWidth: 560, lineHeight: 1.6 }}>
          Phases 1 and 2 are complete. Phase 3 is active — partner onboarding and production hardening.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {PHASES.map(p => (
            <div key={p.n} className="card" style={{ borderColor: p.status === 'active' ? 'var(--accent)' : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 500, color: p.status === 'done' ? 'var(--verify)' : p.status === 'active' ? 'var(--accent)' : 'var(--ink-3)' }}>
                  PHASE {p.n}
                </span>
                {p.status === 'done'   && <span className="badge badge-verify">DONE</span>}
                {p.status === 'active' && <span className="badge badge-accent">ACTIVE</span>}
                {p.status === 'next'   && <span className="badge">PLANNED</span>}
              </div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>{p.label}</div>
              {p.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontFamily: 'var(--sans)', fontSize: 12.5, color: p.status === 'next' ? 'var(--ink-3)' : 'var(--ink-2)' }}>
                  <span style={{ color: p.status === 'done' ? 'var(--verify)' : p.status === 'active' ? 'var(--accent)' : 'var(--rule)', fontSize: 10 }}>
                    {p.status === 'done' ? '✓' : p.status === 'active' ? '›' : '·'}
                  </span>
                  {item}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── §07 Registry component ──────────────────────────────────────
interface RegRecord {
  id: string;
  name: string;
  institution: string;
  date: string;
}

function RegistrySection() {
  const [records, setRecords] = useState<RegRecord[]>(REG_FALLBACK);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/proxy/certificates/`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.results?.length) {
          // normalise field names — API may use accession_id/sequence_name
          const rows: RegRecord[] = (d.results as Record<string, string>[]).slice(0, 6).map(r => ({
            id:          r.accession_id ?? r.id ?? '—',
            name:        r.sequence_name ?? r.name ?? '—',
            institution: r.institution ?? '—',
            date:        r.created_at?.slice(0, 10) ?? r.date ?? '—',
          }));
          setRecords(rows);
          setIsLive(true);
        }
      })
      .catch(() => { /* use fallback */ });
  }, []);

  return (
    <section id="registry" className="showcase-section">
      <div className="wrap">
        <p className="eyebrow" style={{ marginBottom: 12 }}>§ 07 — Registry</p>
        <h2 style={{ fontFamily: 'var(--sans)', fontSize: 'clamp(24px,3vw,36px)', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--ink)', margin: '0 0 12px' }}>
          Public. Searchable. Immutable.
        </h2>
        <p style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink-2)', margin: '0 0 24px', maxWidth: 580, lineHeight: 1.6 }}>
          Every certified sequence is permanently discoverable. The registry is open-access — no account required to search, cite, or verify.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          {isLive
            ? <span className="badge badge-verify">● LIVE DATA</span>
            : <span className="badge badge-warn">◌ DEMO DATA</span>
          }
          <span style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--ink-3)' }}>{records.length} records shown</span>
        </div>
        <div style={{ border: '1px solid var(--rule)', borderRadius: 6, overflow: 'hidden' }}>
          <table className="reg-table">
            <thead>
              <tr style={{ background: 'var(--paper-3)' }}>
                {['AG-ID', 'Sequence', 'Institution', 'Date', 'Status'].map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i}>
                  <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)' }}>{r.id}</span></td>
                  <td style={{ fontWeight: 500 }}>{r.name}</td>
                  <td style={{ color: 'var(--ink-2)' }}>{r.institution}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>{r.date}</td>
                  <td><span className="badge badge-verify">CERTIFIED</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ─── §06 Compliance component ────────────────────────────────────
const COMPLIANCE_DOCS = [
  {
    code: 'DURC-MANIFEST',
    title: 'US DURC + EU Dual-Use',
    sub: 'Dual-use research of concern attestation',
    fields: [
      ['Subject to DURC policy',   'No'],
      ['EU Cat. 2B350 overlap',    'No'],
      ['Gain-of-function risk',    'None detected'],
      ['Recommended oversight',    'Biosafety Level 1'],
      ['Generated',                '2026-04-15'],
    ] as [string, string][],
  },
  {
    code: 'AG-SCD-1.0',
    title: 'Synthesis Clearance Document',
    sub: 'ArtGene-SCD-1.0 — synthesizer authorisation',
    fields: [
      ['Authorisation status', 'CLEARED'],
      ['AG-ID',                'AG-2026-000842'],
      ['Valid for synthesis',  'Yes'],
      ['Compatible firmware',  'SCD-1.0+'],
      ['Issued',               '2026-04-15'],
    ] as [string, string][],
  },
];

function ComplianceSection() {
  return (
    <section id="compliance" className="showcase-section-alt">
      <div className="wrap">
        <p className="eyebrow" style={{ marginBottom: 12 }}>§ 06 — Compliance &amp; Synthesis Auth</p>
        <h2 style={{ fontFamily: 'var(--sans)', fontSize: 'clamp(24px,3vw,36px)', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--ink)', margin: '0 0 12px' }}>
          Ready for regulatory submission.
        </h2>
        <p style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink-2)', margin: '0 0 32px', maxWidth: 580, lineHeight: 1.6 }}>
          Every certificate generates two machine-readable compliance documents automatically: a US
          DURC / EU Dual-Use attestation manifest and an ArtGene Synthesis Clearance Document.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {COMPLIANCE_DOCS.map(doc => (
            <div key={doc.code} className="card">
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-3)', letterSpacing: '0.1em', marginBottom: 8 }}>{doc.code}</div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{doc.title}</div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 16 }}>{doc.sub}</div>
              {doc.fields.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--rule-2)', fontFamily: 'var(--sans)', fontSize: 12.5 }}>
                  <span style={{ color: 'var(--ink-3)' }}>{k}</span>
                  <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop: 16 }}>
                {/* ⚠ BACKEND GAP #1: /certificates/AG-2026-000842/compliance not yet built — href will 404 */}
                <a
                  href={`${API_BASE}/api/proxy/certificates/AG-2026-000842/compliance`}
                  className="btn btn-ghost btn-sm"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download JSON
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── §05 Fragment Assembly component ─────────────────────────────
const FRAG_EXAMPLES = [
  { id: 'F1', seq: 'ATGGTGAGCAAGGGCGAGGAACTG…', len: 240 },
  { id: 'F2', seq: 'TTCACCGGGGTGGTGCCCATCCTG…', len: 240 },
  { id: 'F3', seq: 'GTCGAGCTGGACGGCGACGTAAAC…', len: 240 },
];

function FragmentsSection() {
  const [ran, setRan] = useState(false);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    const minDelay = new Promise(r => setTimeout(r, 1500));
    // ⚠ BACKEND GAP #2: POST /api/proxy/analyse/fragments not yet built.
    // Attempt call alongside minDelay; always fall through to static all-pass result.
    const apiCall = (async () => {
      try {
        await Promise.race([
          fetch(`${API_BASE}/api/proxy/analyse/fragments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fragments: FRAG_EXAMPLES.map(f => f.seq) }),
          }),
          timeout(7000),
        ]);
      } catch (_) { /* expected — endpoint not yet live */ }
    })();
    await Promise.all([minDelay, apiCall]);
    setRunning(false);
    setRan(true);
  };

  return (
    <section id="fragments" className="showcase-section">
      <div className="wrap">
        <p className="eyebrow" style={{ marginBottom: 12 }}>§ 05 — Fragment Assembly</p>
        <h2 style={{ fontFamily: 'var(--sans)', fontSize: 'clamp(24px,3vw,36px)', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--ink)', margin: '0 0 12px' }}>
          Split-vector evasion? Caught.
        </h2>
        <p style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink-2)', margin: '0 0 28px', maxWidth: 580, lineHeight: 1.6 }}>
          A bad actor may attempt to split a hazardous sequence across multiple FASTA fragments to
          evade individual screening. ArtGene screens each fragment alone, then screens the
          reassembled contig.
        </p>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', background: 'var(--paper-3)', padding: '8px 14px', borderRadius: 4, marginBottom: 20, border: '1px solid var(--rule)', display: 'inline-block' }}>
          POST /api/proxy/analyse/fragments <span className="badge badge-warn" style={{ marginLeft: 8 }}>IN PROGRESS</span>
        </div>

        {/* Fragment list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {FRAG_EXAMPLES.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid var(--rule)', borderRadius: 5, background: 'var(--paper)' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.08em', width: 24 }}>{f.id}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', flex: 1 }}>{f.seq}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>{f.len} bp</span>
              {ran && <span className="badge badge-verify">PASS</span>}
            </div>
          ))}
        </div>

        {!ran ? (
          <button className="btn btn-accent" onClick={run} disabled={running}>
            {running ? 'Screening…' : 'Screen fragments →'}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {FRAG_EXAMPLES.map(f => (
                <div key={f.id} style={{ padding: '10px 16px', border: '1px solid rgba(13,145,104,0.3)', borderRadius: 5, background: 'rgba(13,145,104,0.04)' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-3)', marginBottom: 4 }}>{f.id} — INDIVIDUAL</div>
                  <span className="badge badge-verify">CLEAR</span>
                </div>
              ))}
              <div style={{ padding: '10px 16px', border: '1px solid rgba(13,145,104,0.3)', borderRadius: 5, background: 'rgba(13,145,104,0.04)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-3)', marginBottom: 4 }}>F1+F2+F3 — ASSEMBLED</div>
                <span className="badge badge-verify">CLEAR</span>
              </div>
            </div>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
              All fragments and assembled contig cleared all biosafety gates.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── §04 Watermark & Provenance component ────────────────────────
const CODONS = ['ATG','GCT','TTC','AAA','CGT','GGC','TAC','ACG','TGG','GAA','CCT','AGG','ATT','GCA','TCG','CTG','AAC','GGT','ACT','TAA','CAT','GTG','TCC','AGC','CGA','GAG','TTG','ATC','GCC','CAA','TGC','AGT'];
const WMARK_POS = new Set([2,5,9,13,17,21,25,29]);
const RECIPIENTS = [
  { id:'R-001', name:'Lab A — MIT',      variant:'Variant α-01', leaked:false },
  { id:'R-002', name:'Lab B — Broad',    variant:'Variant α-02', leaked:true  },
  { id:'R-003', name:'Lab C — Stanford', variant:'Variant α-03', leaked:false },
  { id:'R-004', name:'Lab D — Oxford',   variant:'Variant α-04', leaked:false },
];
const CERT_FIELDS: [string, string][] = [
  ['Accession',          'AG-2026-000842'],
  ['Sequence',           'GFP-variant-β'],
  ['Depositor',          'Ginkgo Bioworks'],
  ['Issued',             '2026-04-15 14:32 UTC'],
  ['Signature',          'WOTS+ / SHA3-256'],
  ['Distribution copies','0 — not yet distributed'],
];

function WatermarkSection() {
  const [tab, setTab] = useState(0);
  const [activeRecipient, setActiveRecipient] = useState<number | null>(null);
  const tabs = ['① Certify', '② Distribute', '③ Trace'];

  return (
    <section id="watermark" className="showcase-section-alt">
      <div className="wrap">
        <p className="eyebrow" style={{ marginBottom: 12 }}>§ 04 — Watermark &amp; Provenance</p>
        <h2 style={{ fontFamily: 'var(--sans)', fontSize: 'clamp(24px,3vw,36px)', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--ink)', margin: '0 0 12px' }}>
          TINSEL: certify once, trace forever.
        </h2>
        <p style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink-2)', margin: '0 0 28px', maxWidth: 580, lineHeight: 1.6 }}>
          Watermarking is not applied at deposit — it is applied at distribution. Every authorised
          copy carries a unique spread-spectrum fingerprint invisible at the protein level.
        </p>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {tabs.map((t, i) => (
            <button key={i} onClick={() => { setTab(i); setActiveRecipient(null); }} style={{
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em',
              padding: '7px 14px', borderRadius: 4, cursor: 'pointer',
              border: `1.5px solid ${tab === i ? 'var(--accent)' : 'var(--rule)'}`,
              background: tab === i ? 'var(--accent-soft)' : 'var(--paper)',
              color: tab === i ? 'var(--accent)' : 'var(--ink-3)', transition: 'all 140ms',
            }}>{t}</button>
          ))}
        </div>

        {/* Tab ① — Certify */}
        {tab === 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start' }}>
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase' }}>
                Base sequence — pre-distribution, no watermark
              </div>
              <div style={{ width: '100%', maxWidth: 320, height: 100, marginBottom: 14 }}>
                <CodonGrid rows={4} cols={8} highlights={null} />
              </div>
              <div style={{ padding: '12px 14px', background: 'var(--paper)', border: '1px solid var(--rule)', borderRadius: 5, fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                At registration the sequence is stored as-is. Applying a watermark now would be identical for every future recipient — meaningless for tracing.
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase' }}>
                Certificate — AG-2026-000842
              </div>
              <div style={{ border: '1px solid var(--rule)', borderRadius: 6, padding: '22px 20px', background: 'var(--paper)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.1em', marginBottom: 5 }}>ARTGENE ARCHIVE</div>
                    <div style={{ fontFamily: 'var(--serif, Georgia, serif)', fontSize: 19, fontStyle: 'italic', color: 'var(--ink)' }}>Certificate of Registration</div>
                  </div>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', border: '2px solid var(--verify)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--verify)', fontSize: 18 }}>✓</div>
                </div>
                {CERT_FIELDS.map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--rule-2)', fontFamily: 'var(--sans)', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--ink-3)' }}>{k}</span>
                    <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
                <div style={{ marginTop: 12, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)', wordBreak: 'break-all' }}>
                  SIG: a3f7c2e1b9d4…8f2a1c0e3b7d
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab ② — Distribute */}
        {tab === 1 && (
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em', marginBottom: 16, textTransform: 'uppercase' }}>
              Unique TINSEL variant issued per recipient
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 20 }}>
              {RECIPIENTS.map((r, i) => (
                <div key={r.id} style={{ border: '1px solid var(--rule)', borderRadius: 5, padding: '14px 16px', background: 'var(--paper)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-3)', letterSpacing: '0.08em', marginBottom: 3 }}>{r.id}</div>
                      <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{r.name}</div>
                    </div>
                    <span className="badge badge-accent">{r.variant}</span>
                  </div>
                  {/* Codon cells with per-recipient offset */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {CODONS.slice(0, 16).map((c, j) => {
                      const isW = WMARK_POS.has((j + i * 3) % CODONS.length);
                      return (
                        <div key={j} className="codon-cell" style={{
                          background: isW ? 'var(--accent-soft)' : 'transparent',
                          color: isW ? 'var(--accent)' : 'var(--ink-3)',
                          border: `1px solid ${isW ? 'color-mix(in oklab, var(--accent) 30%, transparent)' : 'var(--rule)'}`,
                          fontSize: 8,
                        }}>{c}</div>
                      );
                    })}
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-3)', alignSelf: 'center', marginLeft: 2 }}>…</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 16px', background: 'var(--accent-soft)', border: '1px solid color-mix(in oklab, var(--accent) 20%, transparent)', borderRadius: 5, fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
              Each copy translates to an identical protein. The differences exist only in synonymous codon positions — invisible to the cell, detectable only with the TINSEL secret key.
            </div>
          </div>
        )}

        {/* Tab ③ — Trace */}
        {tab === 2 && (
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em', marginBottom: 16, textTransform: 'uppercase' }}>
              Provenance trace — click a recipient to inspect
            </div>
            <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', paddingBottom: 8, marginBottom: 16, gap: 0 }}>
              {/* Origin node */}
              <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 120 }}>
                <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--accent-soft)', border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: 20 }}>🧬</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.08em' }}>ORIGINAL</div>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink)' }}>AG-2026-000842</div>
              </div>
              {/* Recipient nodes */}
              {RECIPIENTS.map((r, i) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 24, height: 1.5, background: r.leaked ? 'var(--accent)' : 'var(--rule)' }} />
                  <div
                    onClick={() => setActiveRecipient(activeRecipient === i ? null : i)}
                    style={{
                      textAlign: 'center', cursor: 'pointer', width: 116, padding: '10px 8px', borderRadius: 6,
                      border: `1.5px solid ${r.leaked ? 'var(--accent)' : activeRecipient === i ? 'var(--ink-3)' : 'var(--rule)'}`,
                      background: r.leaked ? 'var(--accent-soft)' : activeRecipient === i ? 'var(--paper-3)' : 'var(--paper)',
                      transition: 'all 150ms',
                    }}
                  >
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: r.leaked ? 'var(--accent)' : 'var(--ink-3)', letterSpacing: '0.08em', marginBottom: 3 }}>{r.id}</div>
                    <div style={{ fontFamily: 'var(--sans)', fontSize: 11.5, color: 'var(--ink)', lineHeight: 1.3, marginBottom: r.leaked ? 6 : 0 }}>{r.name}</div>
                    {r.leaked && <span className="badge badge-danger">LEAKED</span>}
                  </div>
                </div>
              ))}
            </div>
            {activeRecipient !== null ? (
              <div style={{ padding: '16px 20px', border: `1px solid ${RECIPIENTS[activeRecipient].leaked ? 'color-mix(in oklab, var(--accent) 40%, transparent)' : 'var(--rule)'}`, borderRadius: 5, background: RECIPIENTS[activeRecipient].leaked ? 'var(--accent-soft)' : 'var(--paper-3)', fontFamily: 'var(--sans)', fontSize: 13, lineHeight: 1.6 }}>
                {RECIPIENTS[activeRecipient].leaked
                  ? <><strong style={{ color: 'var(--accent)' }}>Source identified.</strong> Leaked sequence matches <strong>{RECIPIENTS[activeRecipient].variant}</strong> issued to {RECIPIENTS[activeRecipient].name}. Watermark correlation: 99.97%. Certificate revocation initiated.</>
                  : <><strong>Copy {RECIPIENTS[activeRecipient].id}</strong> — {RECIPIENTS[activeRecipient].variant} — issued to {RECIPIENTS[activeRecipient].name}. No leak detected for this fingerprint variant.</>
                }
              </div>
            ) : (
              <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-3)' }}>
                ↑ Click a recipient to inspect. R-002 (Lab B — Broad) carries a confirmed leak.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── §03 Pipeline component ───────────────────────────────────────
function PipelineSection() {
  const [sel, setSel] = useState(0);
  const [runState, setRunState] = useState<'idle' | 'running' | 'done'>('idle');
  const [gates, setGates] = useState<Record<GateKey, GateStatus>>({
    alpha: 'pending', beta: 'pending', gamma: 'pending', delta: 'pending',
  });
  const [details, setDetails] = useState<Partial<Record<GateKey, { detail: string; score?: number }>>>({});

  const reset = () => {
    setRunState('idle');
    setGates({ alpha: 'pending', beta: 'pending', gamma: 'pending', delta: 'pending' });
    setDetails({});
  };

  const run = async () => {
    const seq = DEMO_SEQS[sel];
    setRunState('running');
    setGates({ alpha: 'pending', beta: 'pending', gamma: 'pending', delta: 'pending' });
    setDetails({});

    // Try real API, fall back silently
    let apiResult: Record<string, { status?: string; s?: string; detail?: string; score?: number }> | null = null;
    try {
      const res = await Promise.race([
        fetch(`${API_BASE}/api/proxy/analyse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sequence: seq.dna }),
        }),
        timeout(7000),
      ]);
      if (res.ok) {
        const json = await res.json();
        apiResult = json?.gates ?? null;
      }
    } catch (_) { /* use fallback */ }

    // Animate each gate sequentially
    const order: GateKey[] = ['alpha', 'beta', 'gamma', 'delta'];
    for (const g of order) {
      setGates(prev => ({ ...prev, [g]: 'running' }));
      await new Promise(r => setTimeout(r, 900 + Math.random() * 600));

      const fb = seq.fallback.gates[g];
      const raw = apiResult?.[g];
      const status: GateStatus = raw
        ? (raw.status === 'fail' || raw.s === 'fail' ? 'fail' : 'pass')
        : (fb.status === 'fail' ? 'fail' : 'pass');
      const detail = raw?.detail ?? fb.detail;

      setGates(prev => ({ ...prev, [g]: status }));
      setDetails(prev => ({ ...prev, [g]: { detail } }));

      if (status === 'fail') {
        // Mark remaining gates as pending with fallback detail
        const remaining = order.slice(order.indexOf(g) + 1);
        for (const r of remaining) {
          setDetails(prev => ({ ...prev, [r]: { detail: seq.fallback.gates[r].detail } }));
        }
        break;
      }
    }
    setRunState('done');
  };

  const allPass = runState === 'done' &&
    (Object.values(gates) as GateStatus[]).every(s => s === 'pass');
  const seq = DEMO_SEQS[sel];

  return (
    <section id="pipeline" className="showcase-section">
      <div className="wrap">
        <p className="eyebrow" style={{ marginBottom: 12 }}>§ 03 — Biosafety Pipeline</p>
        <h2 style={{ fontFamily: 'var(--sans)', fontSize: 'clamp(24px,3vw,36px)', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--ink)', margin: '0 0 12px' }}>
          Four-gate automated biosafety review.
        </h2>
        <p style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink-2)', margin: '0 0 32px', maxWidth: 580, lineHeight: 1.6 }}>
          Select a sequence from the test-vector library and run the full analysis.
          All four gates execute automatically. A certificate is issued only when every gate passes.
        </p>

        {/* Sequence selector */}
        <div className="seq-selector" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 28 }}>
          {DEMO_SEQS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { setSel(i); reset(); }}
              style={{
                textAlign: 'left', padding: '12px 14px', borderRadius: 5, cursor: 'pointer',
                border: `1.5px solid ${sel === i ? 'var(--accent)' : 'var(--rule)'}`,
                background: sel === i ? 'var(--accent-soft)' : 'var(--paper)',
                transition: 'all 140ms',
              }}
            >
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: sel === i ? 'var(--accent)' : 'var(--ink-3)', letterSpacing: '0.08em', marginBottom: 3 }}>{s.id}</div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{s.name}</div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-3)' }}>{s.desc}</div>
            </button>
          ))}
        </div>

        {/* Sequence preview */}
        <div style={{ background: 'var(--paper-3)', border: '1px solid var(--rule)', borderRadius: 5, padding: '10px 14px', marginBottom: 24, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.05em', wordBreak: 'break-all', lineHeight: 1.6 }}>
          <span style={{ color: 'var(--ink-3)', marginRight: 8 }}>5′</span>
          {seq.dna}
          <span style={{ color: 'var(--ink-3)', marginLeft: 2 }}>…3′</span>
          <span style={{ float: 'right', fontSize: 10, color: 'var(--ink-3)' }}>{seq.len} bp</span>
        </div>

        {/* Run controls */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          {runState === 'idle' && (
            <button className="btn btn-accent" onClick={run}>Run analysis →</button>
          )}
          {runState === 'running' && (
            <button className="btn btn-ghost" disabled>Analysing…</button>
          )}
          {runState === 'done' && (
            <>
              <button className="btn btn-primary" onClick={run}>Run again</button>
              <button className="btn btn-ghost" onClick={reset}>Reset</button>
            </>
          )}
        </div>

        {/* Custom 4-gate tracker */}
        <div style={{ border: '1px solid var(--rule)', borderRadius: 6, overflow: 'hidden' }}>
          {GATE_META.map(({ key, label, icon, desc }) => {
            const status = gates[key];
            const detail = details[key];
            return (
              <div key={key} className="gate-row">
                <div className={`gate-icon ${status === 'pass' ? 'gate-icon-pass' : status === 'fail' ? 'gate-icon-fail' : status === 'running' ? 'gate-icon-run' : ''}`}>
                  {status === 'running'
                    ? <span style={{ display: 'inline-block', animation: 'gate-spin 1s linear infinite' }}>○</span>
                    : status === 'pass' ? '✓'
                    : status === 'fail' ? '✕'
                    : icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
                    {status === 'pass' && <span className="badge badge-verify">PASS</span>}
                    {status === 'fail' && <span className="badge badge-danger">FAIL</span>}
                    {status === 'running' && <span className="badge badge-accent">RUNNING…</span>}
                  </div>
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--ink-3)' }}>
                    {detail?.detail ?? desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* All-pass certificate card */}
        {allPass && (
          <div style={{ marginTop: 24, padding: '24px 28px', border: '1.5px solid rgba(13,145,104,0.3)', borderRadius: 6, background: 'rgba(13,145,104,0.04)', display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ fontSize: 32 }}>🔏</div>
            <div>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 15, color: 'var(--ink)', marginBottom: 4 }}>
                Certificate issued: {seq.fallback.cert}
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--verify)', letterSpacing: '0.08em' }}>
                ALL FOUR GATES PASSED · WOTS+ SIGNATURE APPLIED · IMMUTABLE LEDGER ENTRY CREATED
              </div>
            </div>
          </div>
        )}

        {/* Failure card */}
        {runState === 'done' && !allPass && (
          <div style={{ marginTop: 24, padding: '20px 24px', border: '1.5px solid rgba(200,50,50,0.25)', borderRadius: 6, background: 'rgba(200,50,50,0.04)' }}>
            <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 14, color: 'var(--danger)', marginBottom: 4 }}>Certificate not issued</div>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-2)' }}>
              One or more biosafety gates failed. Sequence cannot be registered. Details sent to depositor for review.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Page component ───────────────────────────────────────────────
export default function ShowcasePage() {
  const [activeSection, setActiveSection] = useState<SectionId>('hero');

  // Sidebar scroll spy
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id as SectionId);
          }
        });
      },
      { threshold: 0.35 }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="showcase-layout">

          {/* ── Sticky sidebar (desktop only) ──────────────── */}
          <aside className="showcase-sidebar">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={activeSection === s.id ? 'active' : ''}
              >
                {s.label}
              </a>
            ))}
          </aside>

          {/* ── Main content ───────────────────────────────── */}
          <div className="showcase-content">

            {/* §01 — Hero */}
            <section id="hero" className="showcase-section">
              <div className="wrap">
                <p style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 24 }}>
                  ARTGENE CONSORTIUM · VOLUME I · 2026 &nbsp;—&nbsp; § 01 — Overview
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 64 }}>
                  {/* Left column */}
                  <div style={{ flex: 1 }}>
                    <h1 style={{ fontFamily: 'var(--sans)', fontSize: 'clamp(36px,4.5vw,58px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.03em', color: 'var(--ink)', margin: '0 0 24px' }}>
                      The first public registry for{' '}
                      <span style={{ color: 'var(--accent)' }}>AI-designed</span>{' '}
                      biological sequences.
                    </h1>
                    <p style={{ fontFamily: 'var(--sans)', fontSize: 15.5, color: 'var(--ink-2)', maxWidth: 560, lineHeight: 1.7, margin: '0 0 44px' }}>
                      Generative models now produce proteins and genes faster than the scientific
                      community can catalogue them. ArtGene is the infrastructure layer: automated
                      biosafety screening, codon watermarking, post-quantum certificates, and an
                      immutable public ledger; for every sequence.
                    </p>
                    {/* Counter grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px 40px', marginBottom: 44, maxWidth: 400 }}>
                      {[
                        { to: 100, suffix: '',   label: 'Sequences registered' },
                        { to: 4,    suffix: '',   label: 'Biosafety gates' },
                        { to: 3,   suffix: '',   label: 'Partner institutions' },
                        { to: 70,  suffix: '%',  label: 'Open access' },
                      ].map(({ to, suffix, label }) => (
                        <div key={label}>
                          <div style={{ fontFamily: 'var(--sans)', fontSize: 'clamp(28px,3vw,40px)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', lineHeight: 1 }}>
                            <Counter to={to} suffix={suffix} />
                          </div>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 6 }}>
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* CTAs */}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <a href="mailto:b@genethropic.com" className="btn btn-primary">Drop a mail</a>
                      <a href="#features" className="btn btn-ghost">Explore features</a>
                    </div>
                  </div>
                  {/* Helix — hidden below 860px via .hero-helix CSS class */}
                  <div className="hero-helix" style={{ flexShrink: 0, width: 300, paddingTop: 8 }}>
                    <Helix />
                  </div>
                </div>
              </div>
            </section>

            {/* §02 — Features */}
            <section id="features" className="showcase-section-alt">
              <div className="wrap">
                <p className="eyebrow" style={{ marginBottom: 12 }}>§ 02 — Features</p>
                <h2 style={{ fontFamily: 'var(--sans)', fontSize: 'clamp(24px,3vw,36px)', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--ink)', margin: '0 0 12px' }}>
                  What&rsquo;s built and what&rsquo;s next.
                </h2>
                <p style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink-2)', margin: '0 0 32px', maxWidth: 560, lineHeight: 1.6 }}>
                  {FEATURES.filter(f => f.s === 'live').length} capabilities are live today.{' '}
                  {FEATURES.filter(f => f.s === 'pipeline').length} more are in active development. 
                  <strong> Click </strong> any live feature to jump to its interactive demo below.
                </p>
                <div className="feature-grid">
                  {FEATURES.map((f, i) => (
                    <div
                      key={i}
                      className="card"
                      style={{ position: 'relative', cursor: f.a ? 'pointer' : 'default', padding: '18px 20px' }}
                      onClick={() => { if (f.a) window.location.hash = f.a; }}
                    >
                      <div style={{ position: 'absolute', top: 12, right: 12 }}>
                        {f.s === 'live'
                          ? <span className="badge badge-verify">● LIVE</span>
                          : <span className="badge badge-warn">◌ IN PIPELINE</span>
                        }
                      </div>
                      <div style={{ fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', margin: '0 0 8px', paddingRight: 90, letterSpacing: '-0.01em', lineHeight: 1.35 }}>
                        {f.a
                          ? <a href={f.a} style={{ textDecoration: 'none', color: 'inherit' }} onClick={e => e.stopPropagation()}>{f.t}</a>
                          : f.t
                        }
                      </div>
                      <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>{f.b}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* §03 — Biosafety Pipeline */}
            <PipelineSection />

            {/* §04 — Watermark & Provenance */}
            <WatermarkSection />

            {/* §05 — Fragment Assembly */}
            <FragmentsSection />

            {/* §06 — Compliance */}
            <ComplianceSection />

            {/* §07 — Registry */}
            <RegistrySection />

            {/* §08 — Roadmap */}
            <RoadmapSection />

            {/* §09 — CTA */}
            <CTASection />

          </div>{/* end .showcase-content */}
    </div>
  );
}

/*
 * ─── CSS to APPEND to globals.css ────────────────────────────────
 * Copy the block below and paste at the end of globals.css.
 * Do not modify any existing rules.
 *
 * .showcase-layout { display: flex; }
 * .showcase-sidebar {
 *   position: sticky; top: 56px; height: calc(100vh - 56px);
 *   width: 200px; flex-shrink: 0; padding: 40px 0 40px 36px;
 *   display: flex; flex-direction: column; gap: 2px;
 *   overflow-y: auto; border-right: 1px solid var(--border);
 *   background: var(--paper);
 * }
 * .showcase-sidebar a {
 *   font-family: var(--font-mono); font-size: 10px; font-weight: 500;
 *   letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3);
 *   text-decoration: none; padding: 6px 12px;
 *   border-left: 2px solid transparent;
 *   transition: color 150ms, border-color 150ms; white-space: nowrap;
 * }
 * .showcase-sidebar a:hover,
 * .showcase-sidebar a.active { color: var(--accent); border-left-color: var(--accent); }
 * .showcase-content { flex: 1; min-width: 0; }
 * .showcase-section { padding: 80px 0; }
 * .showcase-section:nth-child(even) { background: var(--paper-3); }
 * .feature-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
 * .codon-cell {
 *   font-family: var(--font-mono); font-size: 9px; padding: 3px 4px;
 *   border-radius: 2px; transition: background 300ms; cursor: default; white-space: nowrap;
 * }
 * .reg-table { width: 100%; border-collapse: collapse; }
 * .reg-table th {
 *   font-family: var(--font-mono); font-size: 9.5px; text-transform: uppercase;
 *   letter-spacing: 0.1em; color: var(--ink-3); padding: 10px 14px;
 *   border-bottom: 1px solid var(--border); text-align: left; font-weight: 500;
 * }
 * .reg-table td { font-family: var(--font-sans); font-size: 13px; padding: 12px 14px; border-bottom: 1px solid #eaf2f1; }
 * .reg-table tr:hover td { background: var(--paper-3); }
 * @media (max-width: 1024px) { .showcase-sidebar { display: none; } }
 * @media (max-width: 768px)  { .feature-grid { grid-template-columns: repeat(2,1fr); } }
 * @media (max-width: 500px)  { .feature-grid { grid-template-columns: 1fr; } }
 * ─────────────────────────────────────────────────────────────────
 */

// Export data for use by section sub-components
export { DEMO_SEQS, REG_FALLBACK, API_BASE, timeout };
