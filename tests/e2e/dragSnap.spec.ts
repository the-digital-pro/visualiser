import { test, expect } from "@playwright/test";

/**
 * Editor drag-and-snap behaviour:
 *
 *   - Dragging a node updates its position smoothly (no jitter back to the
 *     pre-drag spot) because we feed `onNodesChange` into `applyTransient`.
 *   - The snap grid is 20×20 — the final stored position has x and y both
 *     congruent to the grid.
 */

test("dragging a node snaps to a 20px grid and updates the store", async ({ page }) => {
  await page.goto("/edit/p/payments/d/container");
  await expect(page.locator('[data-id="order-api"]')).toBeVisible();

  const initial = await page.evaluate(
    () =>
      (window as unknown as { __arcvizStore: { getState: () => any } })
        .__arcvizStore.getState()
        .projects.payments.diagrams.find((d: { id: string }) => d.id === "container")
        .nodes.find((n: { id: string }) => n.id === "order-api").position,
  );

  const node = page.locator('[data-id="order-api"]');
  const box = await node.boundingBox();
  if (!box) throw new Error("no bounding box for order-api");

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  // Drag by an awkward delta — should snap to the nearest 20px multiple.
  const dx = 73;
  const dy = 41;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Move in several steps so React Flow's drag handler engages.
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(startX + (dx * i) / 6, startY + (dy * i) / 6, { steps: 2 });
  }
  await page.mouse.up();

  const final = await page.evaluate(
    () =>
      (window as unknown as { __arcvizStore: { getState: () => any } })
        .__arcvizStore.getState()
        .projects.payments.diagrams.find((d: { id: string }) => d.id === "container")
        .nodes.find((n: { id: string }) => n.id === "order-api").position,
  );

  // Final position must differ from the start (drag took effect).
  expect(final.x === initial.x && final.y === initial.y).toBe(false);
  // And both axes must land on a 20px grid (snap held).
  expect(final.x % 20).toBe(0);
  expect(final.y % 20).toBe(0);
});
