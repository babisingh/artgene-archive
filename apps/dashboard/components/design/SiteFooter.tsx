import Link from "next/link";
import { BrandGlyph } from "./BrandGlyph";

/**
 * The footer claims nothing the archive does not do.
 *
 * What the old one carried is gone: two mirror hostnames that do not exist, a
 * version and build stamp nothing updates, and a blanket "Open Data under
 * CC-BY-4.0" line. That last was the worst of them, because each record
 * carries its own licence and some are citation only.
 */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <div className="brand" style={{ marginBottom: 14 }}>
              <BrandGlyph size={24} />
              ArtGene <em>Archive</em>
            </div>
            <p className="small muted" style={{ margin: 0, maxWidth: 340 }}>
              A public catalogue of AI-designed biological sequences. Every
              sequence is screened for biosafety before it is listed.
            </p>
          </div>

          <div>
            <h2>Archive</h2>
            <ul>
              <li>
                <Link href="/sequences">Browse the catalogue</Link>
              </li>
              <li>
                <Link href="/submit">Submit a sequence</Link>
              </li>
              <li>
                <Link href="/data">API and data</Link>
              </li>
            </ul>
          </div>

          <div>
            <h2>About</h2>
            <ul>
              <li>
                <Link href="/about">How the archive works</Link>
              </li>
              <li>
                <Link href="/about#biosafety">Biosafety policy</Link>
              </li>
              <li>
                <Link href="/about#corrections">Corrections and removal</Link>
              </li>
              <li>
                <a href="mailto:b@genethropic.com">b@genethropic.com</a>
              </li>
              <li>
                <a
                  href="https://github.com/babisingh/artgene-archive"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Source on GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          Each record carries its own licence, shown on the record. The
          archive makes no blanket licence claim over what it catalogues.
        </div>
      </div>
    </footer>
  );
}
