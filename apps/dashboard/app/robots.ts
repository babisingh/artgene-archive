import type { MetadataRoute } from "next";

const SITE = (process.env.SITE_URL ?? "https://artgene-archive.org").replace(/\/+$/, "");

/**
 * Everything public may be crawled. Two things are kept out: /review, an
 * operator's page that needs a key, and /api/, the proxy, which serves data
 * rather than pages. The sitemap says where every record is.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/review", "/api/"] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
