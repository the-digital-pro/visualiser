import { test, expect } from "@playwright/test";

/**
 * Phase 4 specs:
 *
 *   - Node descriptions render as markdown (not literal text).
 *   - Capture PNG button triggers a download with the correct filename.
 */

test("node descriptions render as markdown in the detail drawer", async ({ page }) => {
  await page.goto("/p/payments/d/container");
  await expect(page.locator('[data-id="order-api"]')).toBeVisible();
  await page.locator('[data-id="order-api"]').click();
  const drawer = page.getByRole("complementary", { name: "Detail drawer" });
  await expect(drawer).toBeVisible();
  // The markdown wrapper applied by MarkdownDescription should be present.
  await expect(drawer.locator(".markdown-body")).toBeVisible();
});

test("tour stop notes render as markdown", async ({ page }) => {
  await page.goto("/tour/booking/new-joiner?step=1");
  // The tour header note is rendered through MarkdownDescription, so the
  // .markdown-body wrapper should be present on the page.
  await expect(page.locator(".markdown-body").first()).toBeVisible();
});

test("Capture PNG button triggers a download named <project>-<diagram>.png", async ({
  page,
}) => {
  await page.goto("/p/payments/d/container");
  await expect(page.locator('[data-id="order-api"]')).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Capture diagram as PNG" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("payments-container.png");
});

test("Capture PNG button is hidden on the home route (no diagram)", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Capture diagram as PNG" }),
  ).toHaveCount(0);
});
