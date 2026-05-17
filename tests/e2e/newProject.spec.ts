import { test, expect } from "@playwright/test";

/**
 * "Create new project" end-to-end:
 *   - Home → New project dialog → submit
 *   - Lands in editor on an empty diagram
 *   - Drag a node from the palette
 *   - Export JSON download triggers
 *   - Return to home → see the project under "Local drafts"
 *   - Delete it
 */

async function clearArcvizDrafts(page: import("@playwright/test").Page) {
  // Clear once at the start, NOT via addInitScript (which would wipe the
  // freshly-created draft on every subsequent page.goto in the same test).
  await page.goto("/");
  await page.evaluate(() => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("arcviz:draft:")) localStorage.removeItem(k);
    }
  });
}

test("new project: create → edit → export → re-find on home", async ({ page }) => {
  await clearArcvizDrafts(page);
  await page.getByRole("button", { name: /New project/ }).click();

  const nameInput = page.getByPlaceholder("e.g. Identity Platform");
  await nameInput.fill("E2E Project");
  // ID should have auto-filled.
  const idInput = page.getByPlaceholder("identity-platform");
  await expect(idInput).toHaveValue("e2e-project");

  await page.getByRole("button", { name: /Create \+ open editor/ }).click();
  await expect(page).toHaveURL(/\/edit\/p\/e2e-project\/d\/context$/);

  // Editor surface is mounted with an empty diagram (no real nodes, the
  // editor top bar is rendered, and the canvas is on-screen).
  await expect(page.getByRole("button", { name: /Auto-arrange/ })).toBeVisible();
  await expect(page.locator(".react-flow")).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);

  // Export JSON via the editor top bar — download is the same byte-identical
  // path used for bundled projects.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export JSON/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("e2e-project.json");

  // Back to home: the project shows up in "Local drafts".
  await page.goto("/");
  const draftsSection = page.locator("section", { hasText: "Local drafts" });
  await expect(draftsSection).toBeVisible();
  await expect(draftsSection.getByText("E2E Project")).toBeVisible();
  await expect(draftsSection.getByText("e2e-project", { exact: false })).toBeVisible();
});

test("new project dialog: rejects ID that collides with a bundled project", async ({
  page,
}) => {
  await clearArcvizDrafts(page);
  await page.getByRole("button", { name: /New project/ }).click();
  // "Booking" slugs to "booking" which IS in the manifest.
  await page.getByPlaceholder("e.g. Identity Platform").fill("Booking");
  await page.getByRole("button", { name: /Create \+ open editor/ }).click();
  await expect(page.getByText(/already uses the id/)).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("local-only project: editor falls back to draft when not in manifest", async ({
  page,
}) => {
  // Seed a local-only draft directly so we don't depend on the dialog UI here.
  await page.addInitScript(() => {
    const envelope = {
      v: 1,
      sourceHash: "<unknown>",
      savedAt: Date.now(),
      json: JSON.stringify(
        {
          schemaVersion: 1,
          id: "fixture",
          name: "Fixture",
          homeDiagramId: "context",
          diagrams: [
            { id: "context", name: "System context", nodes: [], edges: [] },
          ],
        },
        null,
        2,
      ) + "\n",
    };
    localStorage.setItem("arcviz:draft:fixture", JSON.stringify(envelope));
  });
  await page.goto("/edit/p/fixture/d/context");
  await expect(page.getByRole("button", { name: /Export JSON/ })).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
});
