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

import React, { useState, useEffect, useRef } from 'react';
import { SiteHeader } from '@/components/design/SiteHeader';
import { SiteFooter } from '@/components/design/SiteFooter';
import { GovStrip }   from '@/components/design/GovStrip';

// ─── TODO: uncomment as you implement each section ───────────────
// import { Helix }               from '@/components/design/Helix';
// import { Counter }             from '@/components/design/Counter';
// import { CodonGrid }           from '@/components/design/CodonGrid';
// import { GateProgressTracker } from '@/components/GateProgressTracker';
// import { CertBadge }           from '@/components/design/CertBadges';
// ─────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ?? 'https://dashboard-service-production-a432.up.railway.app';

// ─── Sidebar sections ─────────────────────────────────────────────
const SECTIONS = [
  { id: 'hero',       label: '§ 01 — Overview'             },
  { id: 'features',   label: '§ 02 — Features'             },
  { id: 'pipeline',   label: '§ 03 — Biosafety'            },
  { id: 'watermark',  label: '§ 04 — Watermark & Provenance'},
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
  { id: 'AG-2026-001089', name: 'CircRNA-Reg',   institution: 'Karolinska Institutet', date: '2026-04-22' },
  { id: 'AG-2026-001002', name: 'MembAnchor-v3', institution: 'ETH Zürich',            date: '2026-04-21' },
  { id: 'AG-2026-000956', name: 'MetabEng-Enz1', institution: 'MIT CSAIL',             date: '2026-04-20' },
  { id: 'AG-2026-000901', name: 'SynTF-v2',      institution: 'Broad Institute',       date: '2026-04-18' },
  { id: 'AG-2026-000842', name: 'GFP-variant-β', institution: 'Ginkgo Bioworks',       date: '2026-04-15' },
  { id: 'AG-2026-000791', name: 'PhotoSys-Mod',  institution: 'UC Berkeley',           date: '2026-04-12' },
];

// ─── Utility ──────────────────────────────────────────────────────
function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), ms)
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
    <>
      <GovStrip />
      <SiteHeader />
      <main>
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

            {/* §01 — Hero ────────────────────────────────── */}
            {/* TODO: Replace stub with HeroSection component */}
            {/* Components to use: Helix, Counter             */}
            {/* Copy: Showcase.html → HeroSection             */}
            <section id="hero">
              <div className="wrap">
                <p className="eyebrow">§ 01 — Overview</p>
                {/* REPLACE THIS STUB */}
                <h1>The first public registry for <span style={{ color: 'var(--accent)' }}>AI-designed</span> biological sequences.</h1>
              </div>
            </section>

            {/* §02 — Features ────────────────────────────── */}
            {/* TODO: Replace stub with FeaturesSection       */}
            {/* FEATURES array: Showcase.html → const FEATURES */}
            {/* Badge: badge-verify (LIVE) / badge-warn (PIPELINE) */}
            <section id="features">
              <div className="wrap">
                <p className="eyebrow">§ 02 — Features</p>
                {/* REPLACE THIS STUB */}
              </div>
            </section>

            {/* §03 — Biosafety Pipeline ──────────────────── */}
            {/* TODO: Replace stub with PipelineSection       */}
            {/* Component: GateProgressTracker                */}
            {/* API: POST ${API_BASE}/api/proxy/analyse        */}
            {/* Fallback: DEMO_SEQS[i].fallback               */}
            {/* ⚠ MANUAL: verify GateProgressTracker accepts  */}
            {/*   standalone usage (no wizard chrome)         */}
            <section id="pipeline">
              <div className="wrap">
                <p className="eyebrow">§ 03 — Biosafety</p>
                {/* REPLACE THIS STUB */}
              </div>
            </section>

            {/* §04 — Watermark & Provenance ──────────────── */}
            {/* TODO: Replace stub with WatermarkProvenanceSection */}
            {/* Three tabs: ① Certify / ② Distribute / ③ Trace    */}
            {/* Component: CodonGrid                               */}
            {/* No API call — all static demo data                 */}
            {/* ⚠ BACKEND GAP: distribution_copies field (#3)      */}
            {/* ⚠ BACKEND GAP: /distributions endpoint (#4)        */}
            {/* ⚠ BACKEND GAP: /trace endpoint (#5)                */}
            <section id="watermark">
              <div className="wrap">
                <p className="eyebrow">§ 04 — Watermark &amp; Provenance</p>
                {/* REPLACE THIS STUB */}
              </div>
            </section>

            {/* §05 — Fragment Assembly ───────────────────── */}
            {/* TODO: Replace stub with FragmentsSection      */}
            {/* API: POST ${API_BASE}/api/proxy/analyse/fragments */}
            {/* Fallback: all fragments + contig → pass       */}
            {/* ⚠ BACKEND GAP: endpoint not yet built (#2)    */}
            <section id="fragments">
              <div className="wrap">
                <p className="eyebrow">§ 05 — Fragments</p>
                {/* REPLACE THIS STUB */}
              </div>
            </section>

            {/* §06 — Compliance ──────────────────────────── */}
            {/* TODO: Replace stub with ComplianceSection     */}
            {/* API: GET ${API_BASE}/api/proxy/certificates/AG-2026-000842/compliance */}
            {/* Fallback: static card data in Showcase.html   */}
            {/* ⚠ BACKEND GAP: endpoint not yet built (#1)    */}
            <section id="compliance">
              <div className="wrap">
                <p className="eyebrow">§ 06 — Compliance</p>
                {/* REPLACE THIS STUB */}
              </div>
            </section>

            {/* §07 — Registry ────────────────────────────── */}
            {/* TODO: Replace stub with RegistrySection       */}
            {/* API: GET ${API_BASE}/api/proxy/certificates/  */}
            {/* Fallback: REG_FALLBACK                        */}
            {/* ⚠ MANUAL: verify response field names         */}
            {/*   (accession_id vs id, sequence_name vs name) */}
            <section id="registry">
              <div className="wrap">
                <p className="eyebrow">§ 07 — Registry</p>
                {/* REPLACE THIS STUB */}
              </div>
            </section>

            {/* §08 — Roadmap (fully static) ──────────────── */}
            {/* TODO: Replace stub with RoadmapSection        */}
            {/* All data in Showcase.html → phases array      */}
            <section id="roadmap">
              <div className="wrap">
                <p className="eyebrow">§ 08 — Roadmap</p>
                {/* REPLACE THIS STUB */}
              </div>
            </section>

            {/* §09 — CTA (fully static) ──────────────────── */}
            {/* TODO: Replace stub with CTASection            */}
            {/* background: var(--ink) dark band              */}
            {/* All copy verbatim from Showcase.html          */}
            <section id="cta">
              <div className="wrap">
                <p className="eyebrow">§ 09 — Get involved</p>
                {/* REPLACE THIS STUB */}
              </div>
            </section>

          </div>{/* end .showcase-content */}
        </div>{/* end .showcase-layout */}
      </main>
      <SiteFooter />
    </>
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
