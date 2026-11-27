import type { MetadataRoute } from "next";

/**
 * The map search engines read: the public pages, and every published record.
 *
 * Made when it is asked for rather than when the site is built, so a record
 * published today is in the next crawl without a redeploy, and a build never
 * depends on the API being reachable. It asks the API the same way the proxy
 * does for an anonymous visitor: GET /catalogue with the read-only key, which
 * returns published records and nothing else.
 *
 * If the API cannot be reached, the map still lists the public pages, so a
 * crawler is never handed an error in place of a sitemap.
 */
export const dynamic = "force-dynamic";

const SITE = (process.env.SITE_URL ?? "https://artgene-archive.org").replace(/\/+$/, "");
const API_URL = (process.env.API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const READ_KEY = process.env.PUBLIC_READ_API_KEY ?? process.env.API_KEY ?? "";

/** The API's largest page, and a ceiling well under a sitemap's 50,000 entries. */
const PAGE = 200;
const MOST = 10_000;

/** The pages anyone can open. /review is an operator's page and is left out. */
const PUBLIC_PAGES = ["/", "/sequences", "/submit", "/about", "/data"];

type Listed = { registry_id: string; published_at?: string | null };
type ListPage = { count?: number; items?: Listed[] };

async function publishedRecords(): Promise<Listed[]> {
  const records: Listed[] = [];
  for (let offset = 0; offset < MOST; offset += PAGE) {
    const response = await fetch(`${API_URL}/api/v1/catalogue/?limit=${PAGE}&offset=${offset}`, {
      headers: READ_KEY ? { "x-api-key": READ_KEY } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`the catalogue answered ${response.status}`);
    const page = (await response.json()) as ListPage;
    const items = page.items ?? [];
    records.push(...items);
    if (items.length < PAGE || (page.count !== undefined && records.length >= page.count)) break;
  }
  return records;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = PUBLIC_PAGES.map((path) => ({
    url: path === "/" ? `${SITE}/` : `${SITE}${path}`,
  }));

  let records: Listed[] = [];
  try {
    records = await publishedRecords();
  } catch (error) {
    console.warn(`sitemap: the record list could not be read (${error instanceof Error ? error.message : error})`);
  }

  return [
    ...pages,
    ...records
      .filter((record) => /^AGC?-\d{4}-\d{6}$/.test(record.registry_id))
      .map((record) => ({
        url: `${SITE}/sequences/${record.registry_id}`,
        ...(record.published_at ? { lastModified: record.published_at } : {}),
      })),
  ];
}
