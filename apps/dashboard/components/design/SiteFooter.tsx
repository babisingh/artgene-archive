import Link from "next/link";
import { BrandGlyph } from "./BrandGlyph";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <div className="brand" style={{ fontSize: 22, marginBottom: 16 }}>
            <BrandGlyph size={28} />
            ArtGene <em>Archive</em>
          </div>
          <p style={{ color: "var(--ink-3)", fontSize: 13, lineHeight: 1.6, maxWidth: 340 }}>
            An open registry and provenance layer for AI-generated biological sequences. Operated by the ArtGene Consortium as a public-interest scientific infrastructure.
          </p>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)", letterSpacing: "0.08em", marginTop: 20, textTransform: "uppercase" }}>
            artgene-archive.org · est. 2026
          </div>
        </div>
        <div>
          <h5>Registry</h5>
          <ul>
            <li><Link href="/register">Deposit a sequence</Link></li>
            <li><Link href="/registry">Browse records</Link></li>
            <li><Link href="/sequences">My sequences</Link></li>
            <li><Link href="/getting-started">API &amp; downloads</Link></li>
          </ul>
        </div>
        <div>
          <h5>Institution</h5>
          <ul>
            <li><Link href="/about">Charter &amp; governance</Link></li>
            <li><Link href="/about#biosafety">Biosafety policy</Link></li>
            <li><Link href="/getting-started">Documentation</Link></li>
          </ul>
        </div>
        <div>
          <h5>Contact</h5>
          <ul>
            <li>
              <a href="mailto:b@genethropic.com">b@genethropic.com</a>
            </li>
            <li>
              <a href="https://github.com/babisingh/artgene-archive/issues" target="_blank" rel="noopener noreferrer">
                GitHub Issues
              </a>
            </li>
          </ul>
          <h5 style={{ marginTop: 24 }}>Mirrors</h5>
          <ul>
            <li>EU · mirror.XX/artgene</li>
            <li>JP · mirror.YY/artgene</li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 ArtGene Consortium · Open Data under CC-BY-4.0</span>
        <span>VERSION 1.3.0 · BUILD 2026.04-STABLE</span>
      </div>
    </footer>
  );
}
