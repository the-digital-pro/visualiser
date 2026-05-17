import { test, expect } from "@playwright/test";

/**
 * Phase 3 acceptance specs:
 *
 *   - Tour player walks across projects with deep-linkable steps.
 *   - Filter URL parameters round-trip across reload.
 */

test("tour player walks a new joiner from Booking into Payments", async ({ page }) => {
  await page.goto("/tour/booking/new-joiner?step=1");
  await expect(page.locator('[data-id="customer"]')).toBeVisible();
  await expect(page.getByText("step 1 / 5")).toBeVisible();

  // Step through to the cross-project hop.
  await page.getByRole("button", { name: "Next stop" }).click();
  await expect(page).toHaveURL(/step=2/);
  await expect(page.locator('[data-id="booking-web"]')).toBeVisible();

  await page.getByRole("button", { name: "Next stop" }).click();
  await page.getByRole("button", { name: "Next stop" }).click();
  await expect(page).toHaveURL(/step=4/);
  // After step 4 we should be in Payments.
  await expect(page.locator('[data-id="order-api"]')).toBeVisible();
  await expect(page.locator('[data-id="customer"]')).toHaveCount(0);

  // Prev steps back to the prior frame.
  await page.getByRole("button", { name: "Previous stop" }).click();
  await expect(page).toHaveURL(/step=3/);
  await expect(page.locator('[data-id="booking-web"]')).toBeVisible();
});

test("mid-tour deep links land on the right step + project", async ({ page }) => {
  await page.goto("/tour/booking/new-joiner?step=5");
  await expect(page.getByText("step 5 / 5")).toBeVisible();
  await expect(page.locator('[data-id="auth-engine"]')).toBeVisible();
});

test("filter chips round-trip through the URL across reload", async ({ page }) => {
  await page.goto("/p/payments/d/container");
  await expect(page.locator('[data-id="order-api"]')).toBeVisible();

  // Toggle the datastore filter — order-api (a service) should fade.
  await page.getByRole("button", { name: "kind:datastore" }).click();
  await expect(page).toHaveURL(/filter=kind%3Adatastore/);

  // Reload — the URL state should restore the filter and re-fade matching nodes.
  await page.reload();
  await expect(page).toHaveURL(/filter=kind%3Adatastore/);
  await expect(
    page.getByRole("button", { name: "kind:datastore", pressed: true }),
  ).toBeVisible();

  // Clear button returns to no filter.
  await page.getByRole("button", { name: /Clear all filters/ }).click();
  await expect(page).not.toHaveURL(/filter=/);
});
