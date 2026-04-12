import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "../lib/providers";
import "./globals.css";
import { Nav } from "./nav";

export const metadata: Metadata = {
  title: "ArtGene Dashboard",
  description: "TINSEL bioinformatics sequence registry platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent FOUC: apply dark class before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('theme');if(m==='dark'||(!m&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <Providers>
          <Nav />
          <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
            {children}
          </main>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 mt-16">
            <div className="container mx-auto px-4 max-w-7xl py-10">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">

                {/* Brand */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-lg">
                    <span>🧬</span>
                    <span>ArtGene</span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    Traceable Identity Notation for Sequence Encryption + Ledger.
                    Cryptographic provenance and automated biosafety certification
                    for synthetic gene sequences.
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    TINSEL Registry v1.0 &nbsp;·&nbsp; Beta
                  </p>
                </div>

                {/* Navigation */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Platform
                  </h3>
                  <ul className="space-y-2 text-sm">
                    {[
                      { href: "/", label: "Home" },
                      { href: "/register", label: "Register a Sequence" },
                      { href: "/sequences", label: "Sequence Registry" },
                      { href: "/getting-started", label: "Getting Started" },
                    ].map(({ href, label }) => (
                      <li key={href}>
                        <a
                          href={href}
                          className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Contact */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Contact
                  </h3>
                  <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0">✉️</span>
                      <span>
                        General enquiries:{" "}
                        <a
                          href="mailto:contact@artgene.bio"
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          contact@artgene.bio
                        </a>
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0">🔬</span>
                      <span>
                        Biosafety &amp; compliance:{" "}
                        <a
                          href="mailto:biosafety@artgene.bio"
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          biosafety@artgene.bio
                        </a>
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0">🐛</span>
                      <span>
                        Bug reports &amp; feature requests:{" "}
                        <a
                          href="https://github.com/babisingh/artgene-archive/issues"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          GitHub Issues
                        </a>
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0">📍</span>
                      <span>
                        ArtGene Bioinformatics Ltd.<br />
                        London, United Kingdom
                      </span>
                    </li>
                  </ul>
                </div>

              </div>

              {/* Bottom bar */}
              <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 dark:text-slate-500">
                <span>© {new Date().getFullYear()} ArtGene Bioinformatics Ltd. All rights reserved.</span>
                <span>
                  TINSEL is an experimental research platform.
                  Not for clinical or regulatory use without validation.
                </span>
              </div>
            </div>
          </footer>

        </Providers>
      </body>
    </html>
  );
}

