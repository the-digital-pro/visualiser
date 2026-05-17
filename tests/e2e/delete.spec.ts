import { test, expect } from "@playwright/test";

/**
 * Editor: selecting a node or edge and pressing Backspace / Delete removes it.
 * Regression test — controlled-mode React Flow was swallowing `remove` changes
 * in `onNodesChange` after we added drag streaming.
 */

test("Backspace deletes the selected node and orphan edges follow", async ({ page }) => {
  await page.goto("/edit/p/react-web-app/d/context");
  await expect(page.locator('[data-id="analytics"]')).toBeVisible();

  // Capture the starting node count from the store.
  const before = await page.evaluate(
    () =>
      (window as unknown as { __arcvizStore: { getState: () => any } })
        .__arcvizStore.getState()
        .projects["react-web-app"].diagrams.find(
          (d: { id: string }) => d.id === "context",
        ).nodes.length,
  );

  // Click then delete.
  await page.locator('[data-id="analytics"]').click();
  await page.keyboard.press("Backspace");

  // Node is gone from the DOM.
  await expect(page.locator('[data-id="analytics"]')).toHaveCount(0);

  // And from the store.
  const after = await page.evaluate(
    () =>
      (window as unknown as { __arcvizStore: { getState: () => any } })
        .__arcvizStore.getState()
        .projects["react-web-app"].diagrams.find(
          (d: { id: string }) => d.id === "context",
        ).nodes.length,
  );
  expect(after).toBe(before - 1);

  // The edge from react-app → analytics should be cleaned up too.
  const orphan = await page.evaluate(
    () =>
      (window as unknown as { __arcvizStore: { getState: () => any } })
        .__arcvizStore.getState()
        .projects["react-web-app"].diagrams.find(
          (d: { id: string }) => d.id === "context",
        )
        .edges.some(
          (e: { id: string; source: string; target: string }) =>
            e.target === "analytics" || e.source === "analytics",
        ),
  );
  expect(orphan).toBe(false);
});

test("Delete key removes a selected edge", async ({ page }) => {
  await page.goto("/edit/p/react-web-app/d/context");
  await expect(page.locator('[data-id="analytics"]')).toBeVisible();

  // Select the edge through the store directly — clicking SVG edge paths
  // is flaky cross-browser. The deletion path under test is the hotkey
  // reading `store.selection.edgeId`, which doesn't care how the selection
  // was made.
  await page.evaluate(() => {
    (window as unknown as { __arcvizStore: { setState: (s: unknown) => void } })
      .__arcvizStore.setState({ selection: { edgeId: "e-app-analytics" } });
  });

  await page.keyboard.press("Delete");

  await expect(page.locator('[data-id="e-app-analytics"]')).toHaveCount(0);

  const stillThere = await page.evaluate(
    () =>
      (window as unknown as { __arcvizStore: { getState: () => any } })
        .__arcvizStore.getState()
        .projects["react-web-app"].diagrams.find(
          (d: { id: string }) => d.id === "context",
        )
        .edges.some((e: { id: string }) => e.id === "e-app-analytics"),
  );
  expect(stillThere).toBe(false);
});
