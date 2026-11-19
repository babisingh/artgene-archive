/**
 * E2E tests for the home page.
 *
 * Three of these tests used to live in sequences.spec.ts, where they described
 * a home page that announced the "ArtGene TINSEL Registry" and showed API
 * health badges. The home page is now the front of a public archive: what it
 * has to do is say what the archive is, state honestly how much is in it, and
 * get a visitor into the catalogue. The health badges are gone from the app
 * altogether, so nothing here tests them.
 *
 * No backend: Playwright intercepts the Next proxy route at /api/proxy. The
 * snapshot reads the catalogue list four times — once for the recent records
 * and once per count — so one route serves them all, keyed on the query.
 *
 * Assertions are scoped to the <main> landmark, because the footer repeats
 * several of these links and sentences.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";

const LIST = "**/api/proxy/catalogue?*";

/** The page's own content, without the shared header, footer and dev overlay. */
function main(page: Page): Locator {
  return page.getByRole("main");
}

function listItem(over: Record<string, unknown> = {}) {
  return {
    registry_id: "AGC-2026-000021",
    title: "Proteins built around a letter life never had",
    subtitle: "Seven designs carrying a non-canonical residue reached the bench.",
    status: "published",
    visibility: "public",
    molecule_type: "protein",
    function_class: "binder",
    subject_class: "receptor",
    hosting_decision: "held",
    biosafety_class: "none",
    record_kind: "catalogue",
    generating_model: "Boltz-2",
    wet_lab_validated: true,
    container: "bioRxiv",
    published_on: "2026-10-04",
    peer_reviewed: false,
    created_at: "2026-11-18T09:00:00Z",
    published_at: "2026-11-18T09:00:00Z",
    ...over,
  };
}

/**
 * Serve the snapshot's four reads. Each asks a different query, so which count
 * to return is decided from the query string: `kind` and `validated` pick out
 * the per-cell totals, and anything else is the catalogue as a whole.
 */
async function mockSnapshot(
  page: Page,
  options: {
    items: unknown[];
    total: number;
    catalogued?: number;
    deposited?: number;
    validated?: number;
  },
) {
  await page.route(LIST, async (route) => {
    const params = new URL(route.request().url()).searchParams;
    const count =
      params.get("kind") === "catalogue"
        ? (options.catalogued ?? 0)
        : params.get("kind") === "submission"
          ? (options.deposited ?? 0)
          : params.get("validated") === "true"
            ? (options.validated ?? 0)
            : options.total;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: options.items,
        count,
        offset: 0,
        limit: 5,
      }),
    });
  });
}

test.describe("the home page", () => {
  test("says what the archive is and links into the catalogue", async ({ page }) => {
    await mockSnapshot(page, { items: [listItem()], total: 1, catalogued: 1 });
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /A public archive for sequences that/ }),
    ).toBeVisible();
    await expect(
      main(page).getByText(
        /Every sequence is screened for biosafety before it is listed/,
      ),
    ).toBeVisible();
    await expect(
      main(page).getByRole("link", { name: "Browse with filters" }),
    ).toHaveAttribute("href", "/sequences");
  });

  test("counts what is in the catalogue and shows the newest records", async ({
    page,
  }) => {
    await mockSnapshot(page, {
      items: [
        listItem(),
        listItem({
          registry_id: "AG-2026-000004",
          title: "A ribozyme written to cut one messenger and no other",
        }),
      ],
      total: 137,
      catalogued: 120,
      deposited: 17,
      validated: 44,
    });
    await page.goto("/");

    await expect(main(page).getByText("137", { exact: true })).toBeVisible();
    await expect(main(page).getByText("records listed", { exact: true })).toBeVisible();
    await expect(main(page).getByText("120", { exact: true })).toBeVisible();
    await expect(
      main(page).getByText("catalogued from publications", { exact: true }),
    ).toBeVisible();
    await expect(main(page).getByText("17", { exact: true })).toBeVisible();
    await expect(
      main(page).getByText("deposited with the archive", { exact: true }),
    ).toBeVisible();
    await expect(main(page).getByText("44", { exact: true })).toBeVisible();
    await expect(
      main(page).getByText("tested at the bench", { exact: true }),
    ).toBeVisible();

    await expect(page.getByRole("heading", { name: "Recently added" })).toBeVisible();
    await expect(
      main(page).getByRole("link", { name: /Proteins built around a letter life/ }),
    ).toBeVisible();
    await expect(
      main(page).getByRole("link", { name: /A ribozyme written to cut one messenger/ }),
    ).toBeVisible();
    await expect(
      main(page).getByRole("link", { name: "Browse the whole catalogue" }),
    ).toHaveAttribute("href", "/sequences");
  });

  test("says the archive is empty rather than showing a grid of zeros", async ({
    page,
  }) => {
    await mockSnapshot(page, { items: [], total: 0 });
    await page.goto("/");

    await expect(
      main(page).getByText("No records are published yet"),
    ).toBeVisible();
    await expect(
      main(page).getByRole("link", { name: "Submit a sequence" }),
    ).toBeVisible();
    await expect(main(page).getByText("records listed")).toHaveCount(0);
  });

  test("says so when the catalogue cannot be read, without hiding the rest of the page", async ({
    page,
  }) => {
    await page.route(LIST, async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: "The archive is down for maintenance." }),
      });
    });
    await page.goto("/");

    await expect(
      main(page).getByText(/The catalogue could not be read just now/),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /A public archive for sequences that/ }),
    ).toBeVisible();
  });

  test("the search box carries the query into Browse", async ({ page }) => {
    await mockSnapshot(page, { items: [listItem()], total: 1, catalogued: 1 });
    await page.goto("/");

    await main(page).getByLabel("Search the catalogue").fill("Boltz-2");
    await main(page).getByRole("button", { name: "Search" }).click();

    await expect(page).toHaveURL("/sequences?q=Boltz-2");
  });

  test("explains how a sequence gets in, and the two kinds of record", async ({
    page,
  }) => {
    await mockSnapshot(page, { items: [listItem()], total: 1, catalogued: 1 });
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "How a sequence gets in" }),
    ).toBeVisible();
    await expect(
      main(page).getByText("Found or submitted", { exact: true }),
    ).toBeVisible();
    await expect(
      main(page).getByText("Licence checked", { exact: true }),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Two kinds of record" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Catalogued from published work" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Deposited with the archive" }),
    ).toBeVisible();
  });
});
