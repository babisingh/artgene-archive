/**
 * E2E tests for the Sequence Registry pages.
 *
 * These tests use msw-style route mocking via Playwright's network interception
 * so no real backend is required.
 */

import { test, expect, type Page } from "@playwright/test";

const API = "http://localhost:8000/api/v1";

// ---------------------------------------------------------------------------
// Fixture: mock API responses
// ---------------------------------------------------------------------------

const MOCK_CERTS = {
  items: [
    {
      registry_id: "AG-2026-000001",
      status: "CERTIFIED",
      tier: "STANDARD",
      chi_squared: 1.2345,
      owner_id: "researcher@example.com",
      host_organism: "ecoli",
      timestamp: "2026-04-01T12:00:00Z",
    },
    {
      registry_id: "AG-2026-000002",
      status: "FAILED",
      tier: "REJECTED",
      chi_squared: null,
      owner_id: "lab@biotech.org",
      host_organism: "yeast",
      timestamp: "2026-04-02T09:30:00Z",
    },
  ],
  count: 2,
  offset: 0,
  limit: 100,
};

const MOCK_CERT_DETAIL = {
  registry_id: "AG-2026-000001",
  status: "CERTIFIED",
  tier: "STANDARD",
  chi_squared: 1.2345,
  owner_id: "researcher@example.com",
  org_id: "11111111-1111-1111-1111-111111111111",
  ethics_code: "ETHICS-001",
  sequence_type: "protein",
  host_organism: "ecoli",
  timestamp: "2026-04-01T12:00:00Z",
  certificate_hash: "a".repeat(128),
  watermark_metadata: null,
  consequence_report: {
    overall_status: "pass",
    gate1: {
      status: "pass",
      plddt_mean: 87.3,
      plddt_low_fraction: 0.05,
      delta_mfe: 0.4,
      message: "Structural analysis passed",
    },
    gate2: {
      status: "pass",
      blast_hits: 0,
      toxin_probability: 0.07,
      allergen_probability: 0.12,
      message: "Off-target screening passed",
    },
    gate3: {
      status: "pass",
      pathogen_hits: 0,
      hgt_score: 3.2,
      escape_probability: 0.04,
      message: "Ecological risk passed",
    },
    skipped_gates: [],
    run_gates: [1, 2, 3],
  },
};

const MOCK_HEALTH = {
  status: "ok",
  version: "1.0.0",
  env: "development",
  db: "connected",
  vault: "connected",
};

const MOCK_REGISTER_RESPONSE = {
  status: "CERTIFIED",
  registry_id: "AG-2026-000003",
  tier: "STANDARD",
  chi_squared: 0.9876,
  consequence_report: MOCK_CERT_DETAIL.consequence_report,
  message: "Sequence certified — AG-2026-000003",
};

async function mockAllRoutes(page: Page) {
  await page.route(`${API}/health`, (route) =>
    route.fulfill({ json: MOCK_HEALTH })
  );
  await page.route(`${API}/certificates/**`, (route) => {
    const url = route.request().url();
    if (url.includes("AG-2026-000001")) {
      return route.fulfill({ json: MOCK_CERT_DETAIL });
    }
    return route.fulfill({ json: MOCK_CERTS });
  });
  await page.route(`${API}/register`, (route) =>
    route.fulfill({ status: 201, json: MOCK_REGISTER_RESPONSE })
  );
}

// ---------------------------------------------------------------------------
// Home page tests
// ---------------------------------------------------------------------------

test.describe("Home page", () => {
  test("renders hero section with navigation links", async ({ page }) => {
    await mockAllRoutes(page);
    await page.goto("/");

    await expect(page.getByText("ArtGene TINSEL Registry")).toBeVisible();
    await expect(page.getByRole("link", { name: /View Registry/i })).toBeVisible();
  });

  test("shows health status badges when API is available", async ({ page }) => {
    await mockAllRoutes(page);
    await page.goto("/");

    // Wait for health check to resolve
    await expect(page.getByText(/DB connected/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Vault connected/i)).toBeVisible();
  });

  test("shows quick-link cards", async ({ page }) => {
    await mockAllRoutes(page);
    await page.goto("/");

    await expect(page.getByText("Sequence Registry")).toBeVisible();
    await expect(page.getByText("Pathway Bundles")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Sequences (registry) page tests
// ---------------------------------------------------------------------------

test.describe("Sequence Registry page", () => {
  test("renders page heading and Register button", async ({ page }) => {
    await mockAllRoutes(page);
    await page.goto("/sequences");

    await expect(page.getByText("Sequence Registry")).toBeVisible();
    await expect(page.getByTestId("register-btn")).toBeVisible();
  });

  test("displays certificate rows from API", async ({ page }) => {
    await mockAllRoutes(page);
    await page.goto("/sequences");

    await expect(page.getByText("AG-2026-000001")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("AG-2026-000002")).toBeVisible();
  });

  test("shows CERTIFIED and FAILED status badges", async ({ page }) => {
    await mockAllRoutes(page);
    await page.goto("/sequences");

    await expect(page.getByText("CERTIFIED")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("FAILED")).toBeVisible();
  });

  test("sorts table by clicking column header", async ({ page }) => {
    await mockAllRoutes(page);
    await page.goto("/sequences");

    // Click Registered column to sort
    await page.getByRole("columnheader", { name: /Registered/i }).click();

    // Table should still show rows after sort
    await expect(page.getByText("AG-2026-000001")).toBeVisible();
  });

  test("opens Register modal when button clicked", async ({ page }) => {
    await mockAllRoutes(page);
    await page.goto("/sequences");

    await page.getByTestId("register-btn").click();
    await expect(page.getByText("Register New Sequence")).toBeVisible({ timeout: 3000 });
  });

  test("Register modal has required form fields", async ({ page }) => {
    await mockAllRoutes(page);
    await page.goto("/sequences");

    await page.getByTestId("register-btn").click();

    await expect(page.getByText("FASTA Sequence")).toBeVisible();
    await expect(page.getByText("Owner ID")).toBeVisible();
    await expect(page.getByText("Ethics Code")).toBeVisible();
    await expect(page.getByText("Host Organism")).toBeVisible();
  });

  test("closes Register modal on Cancel", async ({ page }) => {
    await mockAllRoutes(page);
    await page.goto("/sequences");

    await page.getByTestId("register-btn").click();
    await expect(page.getByText("Register New Sequence")).toBeVisible({ timeout: 3000 });

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Register New Sequence")).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Certificate detail page tests
// ---------------------------------------------------------------------------

test.describe("Certificate detail page", () => {
  test("renders registry ID in breadcrumb", async ({ page }) => {
    await mockAllRoutes(page);
    await page.goto("/sequences/AG-2026-000001");

    await expect(page.getByText("AG-2026-000001")).toBeVisible({ timeout: 5000 });
  });

  test("shows CERTIFIED status badge", async ({ page }) => {
    await mockAllRoutes(page);
    await page.goto("/sequences/AG-2026-000001");

    await expect(page.getByText("CERTIFIED")).toBeVisible({ timeout: 5000 });
  });

  test("shows certificate metadata fields", async ({ page }) => {
    await mockAllRoutes(page);
    await page.goto("/sequences/AG-2026-000001");

    await expect(page.getByText("researcher@example.com")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("ETHICS-001")).toBeVisible();
  });

  test("shows gate accordions for all 3 gates", async ({ page }) => {
    await mockAllRoutes(page);
    await page.goto("/sequences/AG-2026-000001");

    await expect(page.getByText("Gate 1 — Structural Analysis")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Gate 2 — Off-Target Screening")).toBeVisible();
    await expect(page.getByText("Gate 3 — Ecological Risk Assessment")).toBeVisible();
  });

  test("expands gate 1 accordion to show pLDDT chart", async ({ page }) => {
    await mockAllRoutes(page);
    await page.goto("/sequences/AG-2026-000001");

    await page.getByText("Gate 1 — Structural Analysis").click();
    await expect(page.getByText("Structural analysis passed")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("pLDDT mean")).toBeVisible();
  });

  test("Back to registry link navigates to /sequences", async ({ page }) => {
    await mockAllRoutes(page);
    await page.goto("/sequences/AG-2026-000001");

    await page.getByRole("link", { name: /Back to registry/i }).first().click();
    await expect(page).toHaveURL("/sequences");
  });
});
