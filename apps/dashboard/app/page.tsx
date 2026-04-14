"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useApiKey } from "../lib/providers";

// ── DNA Double Helix graphic for hero ────────────────────────────────────

function DnaHelix() {
  // Mathematically derived node positions for a double helix
  // Strand 1: M50,0 C100,47 100,93 50,140 C0,187 0,233 50,280
  // Strand 2: M50,0 C 0,47  0,93 50,140 C100,187 100,233 50,280
  const s1: [number, number][] = [[50,0],[75,35],[88,70],[75,105],[50,140],[25,175],[12,210],[25,245],[50,280]];
  const s2: [number, number][] = [[50,0],[25,35],[12,70],[25,105],[50,140],[75,175],[88,210],[75,245],[50,280]];
  const rungs: [number,number,number,number][] = [
    [25,35,75,35],[12,70,88,70],[25,105,75,105],
    [25,175,75,175],[12,210,88,210],[25,245,75,245],
  ];

  return (
    <svg viewBox="0 0 100 280" width="80" height="224" aria-hidden="true">
      <defs>
        <linearGradient id="hg1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#bfdbfe" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
        <linearGradient id="hg2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ede9fe" />
          <stop offset="100%" stopColor="#c4b5fd" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Strand 1 */}
      <path d="M50,0 C100,47 100,93 50,140 C0,187 0,233 50,280"
        stroke="url(#hg1)" strokeWidth="3" fill="none" strokeLinecap="round" filter="url(#glow)" />
      {/* Strand 2 */}
      <path d="M50,0 C0,47 0,93 50,140 C100,187 100,233 50,280"
        stroke="url(#hg2)" strokeWidth="3" fill="none" strokeLinecap="round" filter="url(#glow)" />

      {/* Rungs — wider = more opaque */}
      {rungs.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="white" strokeWidth="1.5"
          opacity={(x2 - x1) > 60 ? 0.55 : 0.32} />
      ))}

      {/* Strand 1 nodes */}
      {s1.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4.5" fill="#93c5fd" opacity="0.95" filter="url(#glow)" />
      ))}

      {/* Strand 2 nodes (skip first — shared with s1) */}
      {s2.slice(1).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.5" fill="#ddd6fe" opacity="0.88" />
      ))}
    </svg>
  );
}

// ── Step slide illustrations ──────────────────────────────────────────────

function IconKey() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">
      <circle cx="28" cy="38" r="17" stroke="white" strokeWidth="5" fill="none" />
      <circle cx="28" cy="38" r="8"  stroke="white" strokeWidth="4" fill="none" />
      <rect x="43" y="33" width="32" height="10" rx="5" fill="white" />
      <rect x="56" y="43" width="6"  height="9"  rx="2.5" fill="white" />
      <rect x="67" y="43" width="6"  height="13" rx="2.5" fill="white" />
    </svg>
  );
}

function IconFasta() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">
      <rect x="12" y="8"  width="52" height="66" rx="5" stroke="white" strokeWidth="4" fill="none" />
      <path d="M53,8 L64,19 L53,19 Z" fill="white" opacity="0.45" />
      {/* Header line > */}
      <text x="19" y="35" fontFamily="monospace" fontSize="11" fill="white" opacity="0.95" fontWeight="bold">&gt; Seq_A</text>
      {/* Base sequence lines */}
      <text x="19" y="48" fontFamily="monospace" fontSize="9"  fill="white" opacity="0.75">ATCGATCG</text>
      <text x="19" y="59" fontFamily="monospace" fontSize="9"  fill="white" opacity="0.65">GCTAGCTA</text>
      <text x="19" y="70" fontFamily="monospace" fontSize="9"  fill="white" opacity="0.55">TTAACCGG</text>
    </svg>
  );
}

function IconForm() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">
      <rect x="8"  y="10" width="64" height="60" rx="7" stroke="white" strokeWidth="4" fill="none" />
      <rect x="16" y="24" width="48" height="9"  rx="4" fill="white" opacity="0.22" stroke="white" strokeWidth="1.5" />
      <rect x="16" y="39" width="32" height="9"  rx="4" fill="white" opacity="0.22" stroke="white" strokeWidth="1.5" />
      <rect x="24" y="57" width="32" height="9"  rx="4.5" fill="white" opacity="0.82" />
      {/* Up arrow on button */}
      <path d="M38,61 L40,58 L42,61" stroke="#1d4ed8" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <line x1="40" y1="58" x2="40" y2="63" stroke="#1d4ed8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconGates() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">
      {/* Gate 1 */}
      <circle cx="13" cy="38" r="11" stroke="white" strokeWidth="3" fill="white" fillOpacity="0.18" />
      <path d="M8.5,38 L12,42 L18.5,33" stroke="white" strokeWidth="2.5" fill="none"
        strokeLinecap="round" strokeLinejoin="round" />
      <text x="13" y="54" fontFamily="sans-serif" fontSize="7" fill="white" textAnchor="middle" opacity="0.75">G1</text>

      {/* Arrow 1→2 */}
      <path d="M25,38 L32,38 M29,35 L33,38 L29,41"
        stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Gate 2 */}
      <circle cx="40" cy="38" r="11" stroke="white" strokeWidth="3" fill="white" fillOpacity="0.18" />
      <path d="M35.5,38 L39,42 L45.5,33" stroke="white" strokeWidth="2.5" fill="none"
        strokeLinecap="round" strokeLinejoin="round" />
      <text x="40" y="54" fontFamily="sans-serif" fontSize="7" fill="white" textAnchor="middle" opacity="0.75">G2</text>

      {/* Arrow 2→3 */}
      <path d="M52,38 L59,38 M56,35 L60,38 L56,41"
        stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Gate 3 */}
      <circle cx="67" cy="38" r="11" stroke="white" strokeWidth="3" fill="white" fillOpacity="0.18" />
      <path d="M62.5,38 L66,42 L72.5,33" stroke="white" strokeWidth="2.5" fill="none"
        strokeLinecap="round" strokeLinejoin="round" />
      <text x="67" y="54" fontFamily="sans-serif" fontSize="7" fill="white" textAnchor="middle" opacity="0.75">G3</text>
    </svg>
  );
}

function IconCert() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">
      <rect x="8"  y="10" width="64" height="56" rx="6" stroke="white" strokeWidth="4" fill="none" />
      <rect x="13" y="15" width="54" height="46" rx="3" stroke="white" strokeWidth="1"
        fill="none" opacity="0.3" />
      {/* CERTIFIED bar */}
      <rect x="18" y="24" width="44" height="6"  rx="3" fill="white" opacity="0.85" />
      {/* Registry ID line */}
      <rect x="22" y="36" width="36" height="4"  rx="2" fill="white" opacity="0.45" />
      {/* Hash line */}
      <rect x="22" y="45" width="28" height="3"  rx="1.5" fill="white" opacity="0.3" />
      {/* Seal */}
      <circle cx="40" cy="59" r="7" stroke="white" strokeWidth="2.5" fill="none" />
      <circle cx="40" cy="59" r="3" fill="white" opacity="0.65" />
    </svg>
  );
}

// ── Steps carousel ────────────────────────────────────────────────────────

const SLIDES = [
  {
    step: "01",
    label: "Authenticate",
    title: "Set your API key",
    description:
      'Click "Set API Key" in the navigation bar and enter the key issued by your organisation administrator. This authenticates every submission and links your certificates to your institution. Nothing leaves your browser unencrypted.',
    gradient: "from-blue-500 to-blue-700",
    accent: "#2563eb",
    Icon: IconKey,
  },
  {
    step: "02",
    label: "Prepare",
    title: "Format your FASTA sequence",
    description:
      "Provide a protein-coding sequence in standard FASTA format (header line starting with >, followed by the amino acid sequence). Sequences of 300+ residues achieve STANDARD tier or higher, with maximum Reed-Solomon error-correction capacity.",
    gradient: "from-violet-500 to-violet-700",
    accent: "#7c3aed",
    Icon: IconFasta,
  },
  {
    step: "03",
    label: "Submit",
    title: "Register with metadata",
    description:
      "Fill in your Owner ID, Organisation UUID, IRB Ethics Code, and Host Organism on the Register page, then submit. The host organism selection calibrates biosafety gate thresholds for the intended expression system.",
    gradient: "from-emerald-500 to-teal-700",
    accent: "#047857",
    Icon: IconForm,
  },
  {
    step: "04",
    label: "Screening",
    title: "Three biosafety gates run automatically",
    description:
      "Gate 1 checks structural safety via ESMFold pLDDT scores and RNA ΔMFE. Gate 2 screens for toxins, allergens and select-agent similarity via BLAST. Gate 3 assesses horizontal gene transfer risk and ecological spread. A fail at Gate 1 skips Gates 2 and 3.",
    gradient: "from-amber-500 to-orange-600",
    accent: "#d97706",
    Icon: IconGates,
  },
  {
    step: "05",
    label: "Certified",
    title: "Receive your certificate",
    description:
      "On success, a unique Registry ID (e.g. AG-2026-000001) is issued with a SHA3-512 certificate hash, watermark tier, χ² codon bias score, and full gate report, forming a tamper-evident provenance record for regulatory submission or audit.",
    gradient: "from-rose-500 to-pink-700",
    accent: "#be123c",
    Icon: IconCert,
  },
];

function StepsCarousel() {
  const [slide, setSlide] = useState(0);
  const [visible, setVisible] = useState(true);

  function go(dir: number) {
    setVisible(false);
    setTimeout(() => {
      setSlide((s) => (s + dir + SLIDES.length) % SLIDES.length);
      setVisible(true);
    }, 180);
  }

  const current = SLIDES[slide]!;
  const { Icon } = current;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">How it works</h2>
        <span className="text-sm text-slate-400 dark:text-slate-500">
          {slide + 1} / {SLIDES.length}
        </span>
      </div>

      {/* Card */}
      <div className="card overflow-hidden shadow-lg">
        <div className="flex flex-col sm:flex-row min-h-[260px]">

          {/* Left — coloured panel */}
          <div className={`bg-gradient-to-br ${current.gradient} flex flex-col items-center justify-center
                           gap-4 px-8 py-8 sm:w-56 shrink-0`}>
            <div className="text-xs font-bold tracking-[0.2em] uppercase text-white/60">
              Step {current.step}
            </div>
            <div
              className="rounded-2xl bg-white/10 border border-white/20 p-4 shadow-inner"
              style={{ transition: "opacity 0.18s", opacity: visible ? 1 : 0 }}
            >
              <Icon />
            </div>
            <div className="text-sm font-semibold text-white/90 tracking-wide">
              {current.label}
            </div>
          </div>

          {/* Right — content panel */}
          <div
            className="flex flex-col justify-between p-8 flex-1"
            style={{ transition: "opacity 0.18s", opacity: visible ? 1 : 0 }}
          >
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {current.title}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[0.95rem]">
                {current.description}
              </p>
            </div>

            {/* Footer row: arrows + dots */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
              <div className="flex gap-2">
                <button
                  onClick={() => go(-1)}
                  aria-label="Previous step"
                  className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-600
                             flex items-center justify-center text-slate-500 dark:text-slate-400
                             hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  ‹
                </button>
                <button
                  onClick={() => go(1)}
                  aria-label="Next step"
                  className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-600
                             flex items-center justify-center text-slate-500 dark:text-slate-400
                             hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  ›
                </button>
              </div>

              {/* Dot indicators */}
              <div className="flex gap-2">
                {SLIDES.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setVisible(false); setTimeout(() => { setSlide(i); setVisible(true); }, 180); }}
                    aria-label={`Go to step ${i + 1}`}
                    className="w-2 h-2 rounded-full transition-all"
                    style={{
                      background: i === slide ? current.accent : undefined,
                    }}
                    data-active={i === slide}
                  >
                    <span className={`block w-2 h-2 rounded-full transition-all ${
                      i === slide
                        ? "scale-125"
                        : "bg-slate-300 dark:bg-slate-600"
                    }`} />
                  </button>
                ))}
              </div>

              {slide < SLIDES.length - 1 ? (
                <button
                  onClick={() => go(1)}
                  className="text-sm font-medium transition-colors"
                  style={{ color: current.accent }}
                >
                  Next →
                </button>
              ) : (
                <Link href="/register" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                  Register now →
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color = "blue",
}: {
  label: string; value: string | number; sub?: string;
  color?: "blue" | "green" | "amber" | "violet";
}) {
  const accent = {
    blue: "border-blue-500 dark:border-blue-400",
    green: "border-emerald-500 dark:border-emerald-400",
    amber: "border-amber-500 dark:border-amber-400",
    violet: "border-violet-500 dark:border-violet-400",
  }[color];
  return (
    <div className={`card p-5 border-l-4 ${accent}`}>
      <div className="text-3xl font-bold text-slate-900 dark:text-white">{value}</div>
      <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-1">{label}</div>
      {sub && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { client, apiKey } = useApiKey();

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: () => client.health(),
    retry: false,
  });

  const { data: certs } = useQuery({
    queryKey: ["certificates"],
    queryFn: () => client.listCertificates(100, 0),
    enabled: Boolean(apiKey),
  });

  const totalCerts = certs?.count ?? 0;
  const certified  = certs?.items.filter((c) => c.status === "CERTIFIED").length ?? 0;
  const failed     = certs?.items.filter((c) => c.status === "FAILED").length ?? 0;
  const tiers      = certs
    ? Object.entries(certs.items.reduce<Record<string, number>>((acc, c) => {
        acc[c.tier] = (acc[c.tier] ?? 0) + 1; return acc;
      }, {}))
    : [];

  return (
    <div className="space-y-16">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative rounded-2xl overflow-hidden shadow-xl">
        <div className="card border-0 bg-gradient-to-br from-blue-600 via-blue-700 to-violet-700
                        dark:from-blue-800 dark:via-blue-900 dark:to-violet-900 text-white
                        px-10 py-14 sm:px-16">

          {/* Background blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-violet-500/25 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="absolute top-1/2 left-1/2 w-60 h-60 -translate-x-1/2 -translate-y-1/2
                            rounded-full bg-indigo-400/10 blur-2xl" />
          </div>

          <div className="relative z-10 flex items-center justify-between gap-10">
            {/* Text */}
            <div className="max-w-xl space-y-5">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20
                              rounded-full px-3 py-1 text-xs font-semibold text-blue-100 tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                TINSEL Registry v1.0 - Now in beta
              </div>

              <h1 className="text-4xl sm:text-5xl font-extrabold leading-[1.1] tracking-tight">
                Cryptographic<br />provenance for<br />
                <span className="text-blue-200">synthetic DNA</span>
              </h1>

              <p className="text-blue-100 text-base leading-relaxed max-w-lg">
                ArtGene embeds invisible, tamper-evident watermarks into synthetic gene sequences
                and certifies them through automated biosafety screening, creating an auditable
                chain of custody from lab bench to regulatory submission.
              </p>

              <div className="flex flex-wrap gap-3 pt-1">
                <Link href="/register"
                  className="btn bg-white text-blue-700 hover:bg-blue-50 font-semibold shadow-md">
                  Register a Sequence →
                </Link>
                <Link href="/getting-started"
                  className="btn bg-white/10 border border-white/30 text-white hover:bg-white/20">
                  How it works
                </Link>
              </div>

              {!apiKey && (
                <p className="text-xs text-blue-200 pt-1">
                  Set your API key in the navigation bar to access the registry.
                </p>
              )}
            </div>

            {/* DNA helix graphic */}
            <div className="hidden lg:flex flex-col items-center gap-3 shrink-0 opacity-90 pr-4">
              <DnaHelix />
              <span className="text-xs text-blue-200/60 font-mono tracking-widest uppercase">
                TINSEL
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Service status ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 text-sm -mt-10">
        <span className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">
          Service status
        </span>
        {health ? (
          <>
            <span className={`badge ${health.db === "connected" ? "badge-pass" : "badge-fail"}`}>
              DB {health.db}
            </span>
            <span className={`badge ${health.vault === "connected" ? "badge-pass" : "badge-fail"}`}>
              Vault {health.vault}
            </span>
            <span className="badge badge-skip">{health.env}</span>
          </>
        ) : (
          <span className="badge badge-skip">Connecting…</span>
        )}
      </div>

      {/* ── Live stats ────────────────────────────────────────────────── */}
      {apiKey && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Registry Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Certificates" value={totalCerts} color="blue" />
            <StatCard label="Certified"           value={certified}  color="green" />
            <StatCard label="Failed / Rejected"   value={failed}     color="amber" />
            <StatCard label="Top Tier"
              value={tiers[0]?.[0] ?? "—"}
              sub={tiers[0] ? `${tiers[0][1]} sequences` : undefined}
              color="violet" />
          </div>
        </section>
      )}

      {/* ── Steps carousel ────────────────────────────────────────────── */}
      <StepsCarousel />

      {/* ── Why ArtGene ───────────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
            Why synthetic biology needs a provenance layer
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Synthetic gene sequences can be copied, modified, and misrepresented with no trace of
            their origin. As gene synthesis becomes cheaper and more accessible, the gap between
            legitimate research and potential misuse widens. ArtGene was built to close that gap.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              icon: "🔏",
              title: "Steganographic watermarking",
              body: "TINSEL encodes a cryptographically signed identity payload into the codon usage pattern of a protein, invisible to standard sequence analysis tools yet mathematically verifiable.",
            },
            {
              icon: "🛡️",
              title: "Three-gate biosafety screening",
              body: "Every sequence passes structural analysis, off-target toxin/allergen screening, and ecological risk assessment before a certificate is issued. No gate can be bypassed.",
            },
            {
              icon: "📜",
              title: "Immutable certificate chain",
              body: "Each certificate carries a SHA3-512 hash of its full provenance record, binding the watermarked sequence to the researcher, institution, ethics code, and timestamp.",
            },
          ].map(({ icon, title, body }) => (
            <div key={title} className="card p-6 space-y-3">
              <div className="text-3xl">{icon}</div>
              <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Quick navigation ──────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: "/register",        icon: "➕", title: "Register a Sequence", sub: "Submit a FASTA sequence for TINSEL watermarking and biosafety certification." },
          { href: "/sequences",       icon: "🧬", title: "Sequence Registry",   sub: "Browse all certified and rejected sequences with full gate reports." },
          { href: "/getting-started", icon: "📖", title: "Getting Started",     sub: "Step-by-step guide to the TINSEL workflow, χ² scoring, and tier system." },
        ].map(({ href, icon, title, sub }) => (
          <Link key={href} href={href}
            className="card p-5 hover:border-blue-400 dark:hover:border-blue-500 transition-colors group">
            <div className="text-2xl mb-2">{icon}</div>
            <div className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {title}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{sub}</div>
          </Link>
        ))}
      </section>

    </div>
  );
}
