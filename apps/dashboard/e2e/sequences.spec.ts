/**
 * E2E tests for the public catalogue: the browse page at /sequences and one
 * record at /sequences/<accession>.
 *
 * What is worth testing here is that a visitor with no key can find a record
 * and read it: that the list shows what each row claims to show, that every
 * filter actually narrows the query the archive is asked, that the empty,
 * error and not-found states say which of the three happened, and that a
 * record page says where the sequence came from and what the archive holds.
 *
 * No backend: Playwright intercepts the Next proxy route at /api/proxy, which
 * is where lib/catalogue.ts sends every request. The fixtures below are shaped
 * as CatalogueListItem and CatalogueRecord in lib/catalogue.ts.
 *
 * Assertions are scoped to the <main> landmark, because the site footer links
 * to "Browse the catalogue" and "Submit a sequence" too, and the Next dev
 * overlay adds buttons of its own. Where a string legitimately appears twice
 * in the page's own content, that is said at the assertion.
 *
 * This file used to test a certificate registry: a sortable table of
 * certificates, a Register modal, and per-gate accordions with pLDDT charts.
 * None of that UI exists in the app any more, and those tests are gone rather
 * than weakened — see the PR that rewrote this file.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";

const LIST = "**/api/proxy/catalogue?*";
const RECORD = "**/api/proxy/catalogue/*";

/** The page's own content, without the shared header, footer and dev overlay. */
function main(page: Page): Locator {
  return page.getByRole("main");
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

const SECOND = listItem({
  registry_id: "AG-2026-000004",
  title: "A ribozyme written to cut one messenger and no other",
  subtitle: null,
  molecule_type: "rna",
  function_class: "enzyme",
  record_kind: "submission",
  generating_model: "RNAgen-1",
  wet_lab_validated: false,
  hosting_decision: "withheld",
  container: null,
  published_on: null,
});

function record(over: Record<string, unknown> = {}) {
  return {
    registry_id: "AGC-2026-000021",
    title: "Proteins built around a letter life never had",
    subtitle: "Seven designs carrying a non-canonical residue reached the bench.",
    // Both summary fields are plain text split into paragraphs on a blank line.
    summary:
      "Living things build their proteins from twenty building blocks.\n\nThis group added a twenty-first, and seven of their designs worked.",
    technical_summary:
      "Seven de novo binders incorporating a non-canonical residue were expressed and assayed.",
    molecule_type: "protein",
    function_class: "binder",
    subject_class: "receptor",
    status: "published",
    visibility: "public",
    record_kind: "catalogue",
    biosafety_class: "none",
    hosting_decision: "held",
    hosting_reason: "The data licence permits redistribution.",
    license_resolution: "redistributable",
    citation_only: false,
    created_at: "2026-11-18T09:00:00Z",
    published_at: "2026-11-18T09:00:00Z",
    gates: [
      {
        gate_family: "attribution",
        gate_key: "complete",
        outcome: "pass",
        detail: "Four authors captured, one corresponding.",
      },
      {
        gate_family: "biosafety",
        gate_key: "screening",
        outcome: "pass",
        detail: null,
      },
      {
        gate_family: "license",
        gate_key: "redistribution",
        outcome: "warn",
        detail: "The article licence and the data licence differ.",
      },
    ],
    source: {
      title: "Expanding the genetic alphabet in designed binders",
      url: "https://www.biorxiv.org/content/10.1101/2026.09.30.000000",
      doi: "10.1101/2026.09.30.000000",
      container: "bioRxiv",
      published_on: "2026-10-04",
      peer_reviewed: false,
      version: "v2",
      article_license: "CC-BY-4.0",
      data_license: "CC-BY-4.0",
      authors: [
        {
          full_name: "Ada Okonkwo",
          orcid: "0000-0002-1825-0097",
          affiliation: "Institute for Protein Design",
          is_corresponding: true,
        },
        {
          full_name: "Jun Watanabe",
          orcid: null,
          affiliation: "Kyoto Institute of Chemistry",
          is_corresponding: false,
        },
      ],
    },
    design: {
      generating_model: "Boltz-2",
      model_version: "2.1",
      model_availability: "open weights",
      design_method: "hallucination then filtering",
      design_target: "a receptor ectodomain",
      n_designed: 480,
      n_tested: 24,
      n_functional: 7,
      assays: ["SPR", "yeast display"],
      expression_host: "ECOLI",
      wet_lab_validated: true,
    },
    accessions: [
      {
        database: "pdb",
        accession: "9XYZ",
        url: "https://www.rcsb.org/structure/9XYZ",
      },
    ],
    sequence: {
      molecule_type: "protein",
      length: 214,
      sha3_256: "c".repeat(64),
      held: true,
      withheld: false,
    },
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Serve a list page and collect the URLs asked for, so a test can assert on
 * the query the filters actually sent rather than only on what came back.
 */
async function mockList(
  page: Page,
  items: unknown[],
  count = items.length,
): Promise<string[]> {
  const asked: string[] = [];
  await page.route(LIST, async (route) => {
    asked.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items, count, offset: 0, limit: 20 }),
    });
  });
  return asked;
}

async function mockRecord(page: Page, body: unknown, status = 200) {
  await page.route(RECORD, async (route) => {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

/** One query parameter of the most recent list request. */
function lastAsked(asked: string[], param: string): string | null {
  if (asked.length === 0) return null;
  return new URL(asked[asked.length - 1]).searchParams.get(param);
}

// ---------------------------------------------------------------------------
// Browsing the catalogue
// ---------------------------------------------------------------------------

test.describe("the browse page", () => {
  test("lists the records the archive returns, with their accessions", async ({
    page,
  }) => {
    await mockList(page, [listItem(), SECOND]);
    await page.goto("/sequences");

    await expect(
      page.getByRole("heading", { name: "Browse the catalogue" }),
    ).toBeVisible();

    await expect(
      main(page).getByText("Proteins built around a letter life never had", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      main(page).getByText("A ribozyme written to cut one messenger and no other", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      main(page).getByText("AGC-2026-000021", { exact: true }),
    ).toBeVisible();
    await expect(
      main(page).getByText("AG-2026-000004", { exact: true }),
    ).toBeVisible();

    // The subtitle is the one line saying what the work is. The second record
    // has none, and the row is shorter rather than padded.
    await expect(
      main(page).getByText(
        "Seven designs carrying a non-canonical residue reached the bench.",
        { exact: true },
      ),
    ).toBeVisible();
  });

  test("says which slice of the catalogue is on screen", async ({ page }) => {
    await mockList(page, [listItem(), SECOND]);
    await page.goto("/sequences");

    await expect(
      main(page).getByText("Showing 1 to 2 of 2 records"),
    ).toBeVisible();
  });

  test("marks a record tested at the bench, and one whose sequence is withheld", async ({
    page,
  }) => {
    await mockList(page, [listItem(), SECOND]);
    await page.goto("/sequences");

    // One of the two records carries each badge, and only one.
    await expect(
      main(page).getByText("Wet-lab validated", { exact: true }),
    ).toHaveCount(1);
    await expect(
      main(page).getByText("Sequence withheld", { exact: true }),
    ).toHaveCount(1);
  });

  test("names what a record does before what it is made of", async ({ page }) => {
    // molecule_type reads "Protein" for most of the archive, so the meta line
    // leads with the function class. The order is the behaviour under test.
    await mockList(page, [listItem()]);
    await page.goto("/sequences");

    await expect(
      main(page).getByText(/Binder.*Protein.*bioRxiv.*4 October 2026/).first(),
    ).toBeVisible();
  });

  test("the two kinds of record are told apart on sight", async ({ page }) => {
    await mockList(page, [listItem(), SECOND]);
    await page.goto("/sequences");

    await expect(
      main(page).getByText("Catalogued", { exact: true }),
    ).toHaveCount(1);
    await expect(
      main(page).getByText("Deposited", { exact: true }),
    ).toHaveCount(1);
  });

  test("carries a search into the catalogue query and into the URL", async ({
    page,
  }) => {
    const asked = await mockList(page, [listItem()]);
    await page.goto("/sequences");
    await expect(main(page).getByText("Showing 1 to 1 of 1 record")).toBeVisible();

    await main(page).getByLabel("Search the catalogue").fill("ribozyme");
    await main(page).getByRole("button", { name: "Search" }).click();

    await expect(page).toHaveURL(/\?q=ribozyme/);
    await expect.poll(() => lastAsked(asked, "q")).toBe("ribozyme");
  });

  test("each filter narrows the query the archive is asked", async ({ page }) => {
    const asked = await mockList(page, [listItem()]);
    await page.goto("/sequences");
    await expect(main(page).getByText("Showing 1 to 1 of 1 record")).toBeVisible();

    await main(page).getByLabel("Kind of record").selectOption("submission");
    await expect.poll(() => lastAsked(asked, "kind")).toBe("submission");

    await main(page).getByLabel("Molecule type").selectOption("rna");
    await expect.poll(() => lastAsked(asked, "molecule_type")).toBe("rna");

    await main(page).getByLabel("Generating model").fill("Boltz-2");
    await main(page).getByLabel("Generating model").blur();
    await expect.poll(() => lastAsked(asked, "model")).toBe("Boltz-2");

    // click() rather than check(): the box is controlled by the URL, so its
    // state arrives with the navigation the click causes.
    await main(page).getByLabel("Wet-lab validated only").click();
    await expect.poll(() => lastAsked(asked, "validated")).toBe("true");
    await expect(main(page).getByLabel("Wet-lab validated only")).toBeChecked();

    // Every filter is in the URL, so a narrowed view can be linked to.
    const url = new URL(page.url());
    expect(url.searchParams.get("kind")).toBe("submission");
    expect(url.searchParams.get("molecule_type")).toBe("rna");
    expect(url.searchParams.get("model")).toBe("Boltz-2");
    expect(url.searchParams.get("validated")).toBe("true");
  });

  test("a filter from the URL is applied and shown in the controls", async ({
    page,
  }) => {
    const asked = await mockList(page, [SECOND]);
    await page.goto("/sequences?q=ribozyme&molecule_type=rna&validated=true");

    await expect(
      main(page).getByText("A ribozyme written to cut one messenger and no other", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(main(page).getByLabel("Search the catalogue")).toHaveValue(
      "ribozyme",
    );
    await expect(main(page).getByLabel("Molecule type")).toHaveValue("rna");
    await expect(main(page).getByLabel("Wet-lab validated only")).toBeChecked();

    expect(lastAsked(asked, "q")).toBe("ribozyme");
    expect(lastAsked(asked, "molecule_type")).toBe("rna");
    expect(lastAsked(asked, "validated")).toBe("true");
  });

  test("tells a narrowed search apart from an empty archive", async ({ page }) => {
    await mockList(page, [], 0);
    await page.goto("/sequences?q=nothing-matches-this");

    await expect(main(page).getByText("No records match")).toBeVisible();
    await expect(
      main(page).getByRole("link", { name: "Clear all filters" }),
    ).toBeVisible();

    await page.goto("/sequences");
    await expect(
      main(page).getByText("No records are published yet"),
    ).toBeVisible();
    await expect(
      main(page).getByRole("link", { name: "Submit a sequence" }),
    ).toBeVisible();
  });

  test("pages through a catalogue larger than one page", async ({ page }) => {
    const items = Array.from({ length: 20 }, (_, i) =>
      listItem({
        registry_id: `AGC-2026-${String(i + 1).padStart(6, "0")}`,
        title: `Record number ${i + 1}`,
      }),
    );
    const asked = await mockList(page, items, 25);
    await page.goto("/sequences");

    await expect(
      main(page).getByText("Showing 1 to 20 of 25 records"),
    ).toBeVisible();
    await expect(main(page).getByText("Page 1 of 2")).toBeVisible();
    await expect(
      main(page).getByRole("button", { name: "Previous" }),
    ).toBeDisabled();

    await main(page).getByRole("button", { name: "Next" }).click();

    await expect.poll(() => lastAsked(asked, "offset")).toBe("20");
    await expect(main(page).getByText("Page 2 of 2")).toBeVisible();
    await expect(
      main(page).getByRole("button", { name: "Previous" }),
    ).toBeEnabled();
  });

  test("says the catalogue could not be read rather than showing an empty list", async ({
    page,
  }) => {
    await page.route(LIST, async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: "The archive is down for maintenance." }),
      });
    });
    await page.goto("/sequences");

    await expect(
      main(page).getByText(/The catalogue could not be read/),
    ).toBeVisible();
    await expect(
      main(page).getByText(/The archive is down for maintenance\./),
    ).toBeVisible();
    // An error is not an empty archive, and must not read like one.
    await expect(
      main(page).getByText("No records are published yet"),
    ).toHaveCount(0);
  });

  test("a row opens the record behind it", async ({ page }) => {
    await mockList(page, [listItem()]);
    await mockRecord(page, record());
    await page.goto("/sequences");

    await main(page)
      .getByRole("link", { name: /Proteins built around a letter life/ })
      .click();

    await expect(page).toHaveURL("/sequences/AGC-2026-000021");
    await expect(
      page.getByRole("heading", {
        name: "Proteins built around a letter life never had",
      }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// One record
// ---------------------------------------------------------------------------

test.describe("a record page", () => {
  test("names the record, what it does and who wrote it", async ({ page }) => {
    await mockRecord(page, record());
    await page.goto("/sequences/AGC-2026-000021");

    await expect(
      page.getByRole("heading", {
        name: "Proteins built around a letter life never had",
      }),
    ).toBeVisible();
    await expect(main(page).getByText("Browse / AGC-2026-000021")).toBeVisible();
    await expect(
      main(page).getByText(/Binder.*acts on a receptor in a membrane/).first(),
    ).toBeVisible();
    await expect(
      main(page).getByText("Ada Okonkwo", { exact: true }),
    ).toBeVisible();
    await expect(
      main(page).getByTitle(
        "The authors reported testing this sequence at the bench.",
      ),
    ).toBeVisible();
    await expect(main(page).getByText("Protein", { exact: true })).toBeVisible();
  });

  test("shows three authors and opens the rest with their affiliations", async ({
    page,
  }) => {
    await mockRecord(page, record());
    await page.goto("/sequences/AGC-2026-000021");

    // Affiliations are out of the by-line until asked for: a long author list
    // otherwise pushes the science below the fold.
    await expect(
      main(page).getByText("Institute for Protein Design"),
    ).toHaveCount(0);

    await main(page).getByRole("button", { name: "Show all 2 authors" }).click();

    await expect(
      main(page).getByText("Institute for Protein Design", { exact: true }),
    ).toBeVisible();
    await expect(
      main(page).getByText("Kyoto Institute of Chemistry", { exact: true }),
    ).toBeVisible();
    await expect(
      main(page).getByText(/Corresponding author: Ada Okonkwo/),
    ).toBeVisible();
    await expect(
      main(page).getByRole("link", { name: "Ada Okonkwo" }),
    ).toHaveAttribute("href", "https://orcid.org/0000-0002-1825-0097");
  });

  test("gives the plain-words summary and the paper's own words, with the paper linked", async ({
    page,
  }) => {
    await mockRecord(page, record());
    await page.goto("/sequences/AGC-2026-000021");

    await expect(
      page.getByRole("heading", { name: "In plain words" }),
    ).toBeVisible();
    await expect(
      main(page).getByText(
        "This group added a twenty-first, and seven of their designs worked.",
        { exact: true },
      ),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "In the paper’s words" }),
    ).toBeVisible();
    await expect(
      main(page).getByText(
        /Seven de novo binders incorporating a non-canonical residue/,
      ),
    ).toBeVisible();

    // The citation link is built from the record's own source rather than
    // written into the prose, so every record gets a working link.
    await expect(
      main(page).getByRole("link", {
        name: "Expanding the genetic alphabet in designed binders",
      }),
    ).toHaveAttribute("href", "https://doi.org/10.1101/2026.09.30.000000");
  });

  test("reports how many designs were made, tested and worked", async ({ page }) => {
    await mockRecord(page, record());
    await page.goto("/sequences/AGC-2026-000021");

    const glance = page.getByRole("complementary", { name: "At a glance" });
    await expect(glance.getByText("Designed", { exact: true })).toBeVisible();
    await expect(glance.getByText("480", { exact: true })).toBeVisible();
    await expect(glance.getByText("Tested at the bench")).toBeVisible();
    await expect(glance.getByText("24", { exact: true })).toBeVisible();
    await expect(glance.getByText("Worked", { exact: true })).toBeVisible();
    await expect(glance.getByText("7", { exact: true })).toBeVisible();
    await expect(glance.getByText("E. coli", { exact: true })).toBeVisible();
    await expect(glance.getByText("SPR, yeast display")).toBeVisible();

    // The same three numbers again in the Design section, as one sentence.
    await expect(
      main(page).getByText(/480\s*designed.*24\s*tested.*7\s*functional/).first(),
    ).toBeVisible();
    await expect(
      main(page).getByText("hallucination then filtering", { exact: true }),
    ).toBeVisible();
    await expect(
      main(page).getByText(
        "Yes, the authors reported testing it at the bench",
        { exact: true },
      ),
    ).toBeVisible();
  });

  test("lists the screening lines and their outcomes without explaining them away", async ({
    page,
  }) => {
    await mockRecord(page, record());
    await page.goto("/sequences/AGC-2026-000021");

    await expect(page.getByRole("heading", { name: "Screening" })).toBeVisible();
    await expect(
      main(page).getByText("Attribution", { exact: true }),
    ).toBeVisible();
    await expect(
      main(page).getByText("Biosafety screening", { exact: true }),
    ).toBeVisible();
    await expect(
      main(page).getByText("Licence and redistribution", { exact: true }),
    ).toBeVisible();
    await expect(main(page).getByText("pass", { exact: true })).toHaveCount(2);
    await expect(main(page).getByText("warn", { exact: true })).toHaveCount(1);
    await expect(
      main(page).getByText(/Screening is a filter, not a safety guarantee/),
    ).toBeVisible();
  });

  test("says what the archive holds, and offers a citation to copy", async ({
    page,
  }) => {
    await mockRecord(page, record());
    await page.goto("/sequences/AGC-2026-000021");

    await expect(
      main(page).getByText("The sequence data, under the licence above.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(main(page).getByText("214 residues", { exact: true })).toBeVisible();
    await expect(main(page).getByText("c".repeat(64), { exact: true })).toBeVisible();

    await expect(
      main(page).getByText(
        /Ada Okonkwo, Jun Watanabe\. \(2026\)\..*ArtGene Archive AGC-2026-000021\./,
      ),
    ).toBeVisible();
    await expect(
      main(page).getByRole("button", { name: "Copy citation" }),
    ).toBeVisible();
  });

  test("says plainly when the sequence itself is withheld", async ({ page }) => {
    await mockRecord(
      page,
      record({
        hosting_decision: "withheld",
        hosting_reason: "The licence does not permit redistribution.",
        sequence: {
          molecule_type: "protein",
          length: 214,
          sha3_256: "c".repeat(64),
          held: false,
          withheld: true,
        },
      }),
    );
    await page.goto("/sequences/AGC-2026-000021");

    await expect(
      page.getByRole("heading", { name: "The sequence is withheld" }),
    ).toBeVisible();
    // The reason is given twice: in this notice, and beside the hosting
    // decision in the Availability list.
    await expect(
      main(page).getByText("The licence does not permit redistribution.", {
        exact: true,
      }),
    ).toHaveCount(2);
    await expect(
      main(page).getByText(
        "The citation, the length and a checksum. Not the sequence data.",
        { exact: true },
      ),
    ).toBeVisible();
    // The record is still listed, so a withheld sequence does not read as
    // work that never happened.
    await expect(
      page.getByRole("heading", {
        name: "Proteins built around a letter life never had",
      }),
    ).toBeVisible();
  });

  test("links out to the same sequence in other databases", async ({ page }) => {
    await mockRecord(page, record());
    await page.goto("/sequences/AGC-2026-000021");

    await expect(
      page.getByRole("heading", { name: "In other databases" }),
    ).toBeVisible();
    await expect(main(page).getByRole("link", { name: "9XYZ" })).toHaveAttribute(
      "href",
      "https://www.rcsb.org/structure/9XYZ",
    );
  });

  test("distinguishes an unknown accession from an unpublished one, and offers a way back", async ({
    page,
  }) => {
    await mockList(page, [], 0);
    await mockRecord(page, { detail: "Record not found" }, 404);
    await page.goto("/sequences/AGC-2026-999999");

    await expect(
      page.getByRole("heading", { name: "No such record" }),
    ).toBeVisible();
    await expect(
      main(page).getByText(
        /Either that accession does not exist, or the record has not been/,
      ),
    ).toBeVisible();

    await main(page).getByRole("link", { name: "Browse the catalogue" }).click();
    await expect(page).toHaveURL("/sequences");
  });

  test("repeats the archive's words when a record cannot be read", async ({
    page,
  }) => {
    await mockRecord(page, { detail: "The archive is down for maintenance." }, 503);
    await page.goto("/sequences/AGC-2026-000021");

    await expect(
      page.getByRole("heading", { name: "This record could not be read" }),
    ).toBeVisible();
    await expect(
      main(page).getByText("The archive is down for maintenance.", { exact: true }),
    ).toBeVisible();
  });
});
