"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  const { data } = useQuery({
    queryKey: ["cert-count-header"],
    queryFn: () => client.listCertificates(1, 0),
    staleTime: 60_000,
    retry: false,
  });

  const count = data?.count ?? null;

  return (
    <>
      <GovStrip />
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="brand">
            <BrandGlyph />
            ArtGene <em>Archive</em>
          </Link>
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
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="nav-meta">
            <span className="dot" aria-hidden />
            <span>
              LIVE · {count !== null ? count.toLocaleString() : "—"} SEQUENCES
            </span>
          </div>
        </div>
      </header>
    </>
  );
}
