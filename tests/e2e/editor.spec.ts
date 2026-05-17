import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Phase 2 acceptance journey (IMPLEMENTATION_PLAN.md §2 Done):
 *
 *   - Open editor for a bundled project
 *   - Edit a field via the properties panel (transient + commit on blur)
 *   - Undo restores prior state
 *   - Export downloads canonical JSON, byte-identical to the seed when
 *     the project hasn't been mutated.
 */

test.beforeEach(async ({ page }) => {
  // Make sure no leftover drafts skew the test.
  await page.addInitScript(() => {
    try {
      localStorage.removeItem("arcviz:draft:booking");
      localStorage.removeItem("arcviz:draft:payments");
    } catch {
      /* ignore */
    }
  });
});

test("edit → undo round-trips at user-meaningful granularity", async ({ page }) => {
  await page.goto("/edit/p/booking/d/context");

  await expect(page.locator('[data-id="booking-web"]')).toBeVisible();
  await page.locator('[data-id="booking-web"]').click();

  const nameInput = page.locator("aside").getByRole("textbox").first();
  await expect(nameInput).toHaveValue("Booking Web");

  await nameInput.fill("Renamed Web");
  await nameInput.blur();
  await expect(nameInput).toHaveValue("Renamed Web");

  // History should show 1 in past after the commit.
  await expect(page.getByText(/1\s*in past/)).toBeVisible();

  // Undo via the toolbar button.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("aside").getByRole("textbox").first()).toHaveValue(
    "Booking Web",
  );
  await expect(page.getByText(/0\s*in past/)).toBeVisible();
  await expect(page.getByText(/1\s*in future/)).toBeVisible();
});

test("export of an unmodified seed is byte-identical to disk", async ({ page }) => {
  // Use the in-page canonical serializer rather than triggering the download —
  // the result of serializeProject(store.projects.booking) IS what Export
  // writes to disk, so this checks the same code path.
  await page.goto("/edit/p/booking/d/context");
  await expect(page.locator('[data-id="booking-web"]')).toBeVisible();

  // Wait for the dev-only window globals to load (store + serializer).
  await page.waitForFunction(
    () => Boolean((window as unknown as { __arcvizSerialize?: unknown }).__arcvizSerialize),
  );
  const exported = await page.evaluate(() => {
    const w = window as unknown as {
      __arcvizStore: { getState: () => { projects: Record<string, unknown> } };
      __arcvizSerialize: (p: unknown) => string;
    };
    return w.__arcvizSerialize(w.__arcvizStore.getState().projects["booking"]);
  });

  const seed = readFileSync(join(process.cwd(), "public", "projects", "booking.json"), "utf8");
  expect(exported).toBe(seed);
});

test("auto-arrange dynamically imports elkjs and writes positions", async ({ page }) => {
  await page.goto("/edit/p/booking/d/context");
  await expect(page.locator('[data-id="booking-web"]')).toBeVisible();

  const xBefore = await page.evaluate(() => {
    const store = (window as unknown as { __arcvizStore: { getState: () => any } }).__arcvizStore;
    return store.getState().projects.booking.diagrams[0].nodes.find(
      (n: { id: string }) => n.id === "booking-web",
    ).position.x;
  });

  await page.getByRole("button", { name: /Auto-arrange/ }).click();
  // ELK runs asynchronously after the dyn-import; wait for the layout to settle.
  await expect(page.getByText(/1\s*in past/)).toBeVisible({ timeout: 10_000 });

  const xAfter = await page.evaluate(() => {
    const store = (window as unknown as { __arcvizStore: { getState: () => any } }).__arcvizStore;
    return store.getState().projects.booking.diagrams[0].nodes.find(
      (n: { id: string }) => n.id === "booking-web",
    ).position.x;
  });

  // Position should change (ELK reflows the graph).
  expect(xAfter).not.toBe(xBefore);
});

test("mode toggle flips Present ↔ Edit while preserving project + diagram", async ({ page }) => {
  await page.goto("/edit/p/booking/d/context");
  await expect(page.getByRole("tab", { name: "Edit", selected: true })).toBeVisible();

  await page.getByRole("tab", { name: "Present" }).click();
  await expect(page).toHaveURL(/\/p\/booking\/d\/context$/);
  await expect(page.getByRole("tab", { name: "Present", selected: true })).toBeVisible();

  await page.getByRole("tab", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/edit\/p\/booking\/d\/context$/);
});
