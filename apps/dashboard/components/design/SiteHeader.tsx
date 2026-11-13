"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandGlyph } from "./BrandGlyph";

const navItems: { href: string; label: string }[] = [
  { href: "/sequences", label: "Browse" },
  { href: "/submit", label: "Submit" },
  { href: "/about", label: "About" },
  { href: "/data", label: "API & data" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand">
          <BrandGlyph />
          ArtGene <em>Archive</em>
        </Link>

        <nav className="nav" aria-label="Main">
          {navItems.map(({ href, label }) => {
            const active =
              pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
