/**
 * E2E tests for the editorial desk at /review.
 *
 * The page is the half of the publishing control that is not a permission: the
 * API refuses to publish for a catalogue:draft key, and this is where a person
 * with an operator key does it instead. What is worth testing here is that the
 * page sends what it says it sends, asks twice before anything public happens,
 * and repeats the archive's refusals in words.
 *
 * No backend: Playwright intercepts the Next proxy route, as sequences.spec.ts
 * does.
 */

import { test, expect, type Page } from "@playwright/test";

const KEY = "test-operator-key";

function record(over: Record<string, unknown> = {}) {
  return {
    registry_id: "AGC-2026-000021",
    title: "Proteins built around a letter life never had",
    subtitle: "Seven designs carrying a non-canonical residue reached the bench.",
    status: "draft",
    visibility: "private",
    molecule_type: "protein",
    function_class: "binder",
    subject_class: "receptor",
    hosting_decision: "held",
    biosafety_class: "none",
    record_kind: "catalogue",
    generating_model: "Boltz-2",
    wet_lab_validated: true,
    container: "bioRxiv",
    published_on: null,
    peer_reviewed: false,
    created_at: "2026-11-18T09:00:00Z",
    published_at: null,
    ...over,
  };
}

/** The list the page reads on unlock. */
async function mockQueue(page: Page, items: unknown[]) {
  await page.route("**/api/proxy/catalogue?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items,
        count: items.length,
        offset: 0,
        limit: 200,
      }),
    });
  });
}

/** Unlock without typing, for the tests that are not about the form. */
async function unlocked(page: Page) {
  await page.addInitScript((key) => {
    window.sessionStorage.setItem("artgene_api_key", key as string);
  }, KEY);
}

test.describe("the editorial desk", () => {
  test("asks for a key before it shows anything", async ({ page }) => {
    await page.goto("/review");
    await expect(page.getByLabel("Operator key")).toBeVisible();
    await expect(page.getByRole("button", { name: "Unlock" })).toBeVisible();
    // No queue is read until there is a key to read it with.
    await expect(page.getByText("waiting on you")).toHaveCount(0);
  });

  test("keeps the key in this tab only", async ({ page }) => {
    await mockQueue(page, [record()]);
    await page.goto("/review");
    await page.getByLabel("Operator key").fill(KEY);
    await page.getByRole("button", { name: "Unlock" }).click();

    await expect(page.getByText("One record is waiting on you.")).toBeVisible();

    const stored = await page.evaluate(() => ({
      session: window.sessionStorage.getItem("artgene_api_key"),
      local: window.localStorage.getItem("artgene_api_key"),
      cookie: document.cookie,
    }));
    expect(stored.session).toBe(KEY);
    expect(stored.local).toBeNull();
    expect(stored.cookie).not.toContain(KEY);
  });

  test("sorts records into queues and names what each one means", async ({ page }) => {
    await unlocked(page);
    await mockQueue(page, [
      record(),
      record({ registry_id: "AGC-2026-000019", status: "reviewed" }),
      record({ registry_id: "AGC-2026-000001", status: "published" }),
    ]);
    await page.goto("/review");

    await expect(page.getByText("2 records are waiting on you.")).toBeVisible();
    await expect(page.getByText("1 published")).toBeVisible();
    await expect(
      page.getByText("Filed by Genome Watch, and not yet read by you."),
    ).toBeVisible();
    await expect(page.getByText("Checked, and ready to go public.")).toBeVisible();
  });

  test("sends the key and the reason when a draft is staged", async ({ page }) => {
    await unlocked(page);
    await mockQueue(page, [record()]);

    let sent: { key: string | undefined; body: unknown } | null = null;
    await page.route("**/api/proxy/catalogue/*/status", async (route) => {
      sent = {
        key: route.request().headers()["x-api-key"],
        body: route.request().postDataJSON(),
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(record({ status: "staged" })),
      });
    });

    await page.goto("/review");
    await page.getByRole("button", { name: "Move it" }).click();
    await page.getByLabel("Why, in a line (optional)").fill("Read it twice.");
    await page.getByRole("button", { name: "Stage it" }).click();

    await expect(page.getByText("AGC-2026-000021 is now Staged.")).toBeVisible();
    expect(sent).not.toBeNull();
    expect(sent!.key).toBe(KEY);
    expect(sent!.body).toEqual({ status: "staged", reason: "Read it twice." });
  });

  test("will not publish on one press", async ({ page }) => {
    await unlocked(page);
    await mockQueue(page, [record({ status: "reviewed" })]);

    let calls = 0;
    await page.route("**/api/proxy/catalogue/*/status", async (route) => {
      calls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(record({ status: "published" })),
      });
    });

    await page.goto("/review");
    await page.getByRole("button", { name: "Move it" }).click();
    await page.getByRole("button", { name: "Publish it", exact: true }).click();

    // Armed, not fired.
    expect(calls).toBe(0);
    await expect(
      page.getByText("This puts the record on the public site. Press again to do it."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Yes, publish it" }).click();
    await expect(page.getByText("AGC-2026-000021 is now Published.")).toBeVisible();
    expect(calls).toBe(1);
  });

  test("repeats the archive's refusal when the key cannot publish", async ({ page }) => {
    await unlocked(page);
    await mockQueue(page, [record({ status: "reviewed" })]);
    await page.route("**/api/proxy/catalogue/*/status", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          detail: {
            code: "INSUFFICIENT_SCOPE",
            message:
              "Moving a record to 'published' requires the 'catalogue:publish' scope.",
            missing_scopes: ["catalogue:publish"],
          },
        }),
      });
    });

    await page.goto("/review");
    await page.getByRole("button", { name: "Move it" }).click();
    await page.getByRole("button", { name: "Publish it", exact: true }).click();
    await page.getByRole("button", { name: "Yes, publish it" }).click();

    await expect(
      page.getByText(/requires the 'catalogue:publish' scope\. This key cannot do it\./),
    ).toBeVisible();
  });

  test("says what to do when attribution is not finished", async ({ page }) => {
    await unlocked(page);
    await mockQueue(page, [record()]);
    await page.route("**/api/proxy/catalogue/*/status", async (route) => {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          detail: {
            code: "ATTRIBUTION_INCOMPLETE",
            message:
              "The attribution gate has not passed, so this record cannot leave draft",
            detail: "No authors captured.",
          },
        }),
      });
    });

    await page.goto("/review");
    await page.getByRole("button", { name: "Move it" }).click();
    await page.getByRole("button", { name: "Stage it" }).click();

    await expect(
      page.getByText(/cannot leave draft\. Fix the authors on the record first/),
    ).toBeVisible();
  });

  test("offers no way out of withdrawn", async ({ page }) => {
    await unlocked(page);
    await mockQueue(page, [record({ status: "withdrawn" })]);
    await page.goto("/review");

    // Withdrawn is terminal, so it is not one of the queues and the record
    // carries no buttons.
    await expect(page.getByText("Nothing is waiting.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Move it" })).toHaveCount(0);
  });
});
