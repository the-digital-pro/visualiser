import { test, expect } from "@playwright/test";

/**
 * Phase 1 acceptance journey (IMPLEMENTATION_PLAN.md §1 Done):
 *
 *   Home → enter Booking → cross-project follow into Payments → browser back.
 */

test("drill-down → follow-connection → back-navigation", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("/");

  // Home lists both bundled projects.
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await expect(page.getByText("Booking Website")).toBeVisible();
  await expect(page.getByText("Payments Platform")).toBeVisible();

  // Enter Booking.
  await page.getByRole("button", { name: /Booking Website/ }).click();
  await expect(page).toHaveURL(/\/p\/booking\/d\/context$/);
  await expect(page.locator('[data-id="booking-web"]')).toBeVisible();

  // Cross-project external node should render (placeholder for Order API).
  const orderApiSynthetic = page.locator(
    '[data-id="__ext__payments:container:order-api"]',
  );
  await expect(orderApiSynthetic).toBeVisible();

  // Selecting the synthetic external node should open the drawer with the
  // Follow action.
  await orderApiSynthetic.click();
  const drawer = page.getByRole("complementary", { name: "Detail drawer" });
  await expect(drawer).toBeVisible();
  const followBtn = drawer.getByRole("button", { name: /Follow to target/ });
  await expect(followBtn).toBeVisible();

  // Follow → land on Payments container with order-api pulsing.
  await followBtn.click();
  await expect(page).toHaveURL(/\/p\/payments\/d\/container/);
  await expect(page.locator('[data-id="order-api"]')).toBeVisible();

  // Browser back → return to Booking context.
  await page.goBack();
  await expect(page).toHaveURL(/\/p\/booking\/d\/context/);
  await expect(page.locator('[data-id="booking-web"]')).toBeVisible();

  // No console errors during the journey.
  expect(consoleErrors, consoleErrors.join("\n")).toHaveLength(0);
});

test("Cmd+K opens search palette and jumps to a node across projects", async ({
  page,
}) => {
  await page.goto("/");
  // Fire the hotkey on both ctrl AND meta to cover whichever modifier
  // react-hotkeys-hook is sniffing the OS for in the headless browser.
  await page.evaluate(() => {
    for (const mods of [{ metaKey: true }, { ctrlKey: true }]) {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          code: "KeyK",
          bubbles: true,
          ...mods,
        }),
      );
    }
  });
  await expect(page.getByPlaceholder(/Search nodes/)).toBeVisible();

  await page.getByPlaceholder(/Search nodes/).fill("Order API");
  // Press Enter to select the first result.
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/p\/payments\/d\/container/);
  await expect(page.locator('[data-id="order-api"]')).toBeVisible();
});

test("breadcrumb reflects nav history and can pop intermediate frames", async ({
  page,
}) => {
  await page.goto("/p/payments/d/context");
  await expect(page.locator('[data-id="platform"]')).toBeVisible();

  // Drill into containers via the Platform node's drawer action.
  await page.locator('[data-id="platform"]').click();
  const drawer = page.getByRole("complementary", { name: "Detail drawer" });
  await drawer.getByRole("button", { name: /Drill into/ }).click();
  await expect(page).toHaveURL(/\/p\/payments\/d\/container/);

  // Breadcrumb shows two frames.
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumb.getByText("System context", { exact: false })).toBeVisible();
  await expect(breadcrumb.getByText("Containers", { exact: false })).toBeVisible();

  // Pop intermediate frame.
  await breadcrumb.getByRole("button", { name: /System context/ }).click();
  await expect(page).toHaveURL(/\/p\/payments\/d\/context/);
});
