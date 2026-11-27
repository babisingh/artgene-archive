import type { MetadataRoute } from "next";

import { publishedRecords, recordUrl, SITE } from "../lib/record-server";

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

/** The pages anyone can open. /review is an operator's page and is left out. */
const PUBLIC_PAGES = ["/", "/sequences", "/submit", "/about", "/data"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = PUBLIC_PAGES.map((path) => ({
    url: path === "/" ? `${SITE}/` : `${SITE}${path}`,
  }));

  let records: Awaited<ReturnType<typeof publishedRecords>> = [];
  try {
    records = await publishedRecords();
  } catch (error) {
    console.warn(`sitemap: the record list could not be read (${error instanceof Error ? error.message : error})`);
  }

  return [
    ...pages,
    ...records.map((record) => ({
      url: recordUrl(record.registry_id),
      ...(record.published_at ? { lastModified: record.published_at } : {}),
    })),
  ];
}
