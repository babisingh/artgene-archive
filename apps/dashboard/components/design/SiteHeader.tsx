"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApiKey } from "../../lib/providers";
import { BrandGlyph } from "./BrandGlyph";
import { GovStrip } from "./GovStrip";

const navItems: { href: string; label: string; accent?: boolean }[] = [
  { href: "/", label: "Overview" },
  { href: "/registry", label: "Registry" },
  { href: "/register", label: "Deposit" },
  { href: "/about", label: "Charter" },
  { href: "/getting-started", label: "Docs" },
  { href: "/showcase", label: "Demo", accent: true },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { client } = useApiKey();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const { data } = useQuery({
    queryKey: ["cert-count-header"],
    queryFn: () => client.listCertificates(1, 0),
    staleTime: 60_000,
    retry: false,
  });

  // `count` is this page's length, and the query above asks for one row, so
  // reading it here always produced "1 SEQUENCES" no matter how many records
  // the registry held. `total` is the figure actually wanted.
  //
  // Falling back to null rather than to `count` is deliberate: against an API
  // that predates `total`, the badge renders nothing at all. An absent number
  // is honest, where the old one was confidently wrong.
  const count = data?.total ?? null;

  return (
    <>
      <GovStrip />
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="brand">
            <BrandGlyph />
            ArtGene <em>Archive</em>
          </Link>

          {/* Desktop nav */}
          <nav className="nav" aria-label="Main navigation">
            {navItems.map(({ href, label, accent }) => (
              <Link
                key={href}
                href={href}
                className={
                  accent
                    ? "btn btn-accent btn-sm"
                    : pathname === href
                      ? "active"
                      : ""
                }
                style={accent ? { background: "oklch(0.74 0.10 45)", borderColor: "oklch(0.74 0.10 45)" } : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="nav-meta">
            <span className="dot" aria-hidden />
            <span>
              LIVE{count !== null ? ` · ${count.toLocaleString()} SEQUENCES` : ""}
            </span>
          </div>

          {/* Mobile hamburger toggle */}
          <button
            className="nav-toggle"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            <span className="nav-toggle-bar" />
            <span className="nav-toggle-bar" />
            <span className="nav-toggle-bar" />
          </button>
        </div>
      </header>

      {/* Mobile nav drawer, rendered outside header so it covers full viewport */}
      <div className={`nav-drawer${mobileOpen ? " open" : ""}`} aria-label="Mobile navigation" aria-hidden={!mobileOpen}>
        {navItems.map(({ href, label, accent }) => (
          <Link
            key={href}
            href={href}
            className={
              accent
                ? "btn btn-accent"
                : pathname === href
                  ? "active"
                  : ""
            }
            style={accent ? { background: "oklch(0.74 0.10 45)", borderColor: "oklch(0.74 0.10 45)", borderRadius: "var(--radius-lg)", justifyContent: "center" } : undefined}
            onClick={() => setMobileOpen(false)}
          >
            {label}
          </Link>
        ))}
        <div className="nav-drawer-meta">
          <span className="dot" aria-hidden />
          <span>LIVE{count !== null ? ` · ${count.toLocaleString()} SEQUENCES` : ""}</span>
        </div>
      </div>
    </>
  );
}
