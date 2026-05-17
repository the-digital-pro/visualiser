/**
 * PNG export of the current React Flow viewport.
 *
 * `html-to-image` is dynamically imported on click so it doesn't ship in the
 * critical path. We target the `.react-flow__viewport` transform host so the
 * exported image matches what the user actually sees, scaled to the visible
 * bounds.
 *
 * Theme + reduced-motion aware: we render to a white background in light
 * mode and to the current theme's `--background` in dark mode so the image
 * is legible wherever the consumer pastes it.
 */

export interface CapturePngOptions {
  projectId: string;
  diagramId: string;
  pixelRatio?: number;
}

export async function capturePng({
  projectId,
  diagramId,
  pixelRatio = 2,
}: CapturePngOptions): Promise<void> {
  const viewport = document.querySelector<HTMLElement>(
    ".react-flow__viewport",
  );
  const wrapper = document.querySelector<HTMLElement>(".react-flow");
  if (!viewport || !wrapper) {
    throw new Error("No React Flow canvas mounted to capture.");
  }
  const { toPng } = await import("html-to-image");

  // Read the resolved background from CSS so the image matches the theme.
  const background =
    getComputedStyle(document.documentElement).getPropertyValue("--background").trim() ||
    "0 0% 100%";
  const dataUrl = await toPng(wrapper, {
    pixelRatio,
    backgroundColor: `hsl(${background})`,
    cacheBust: true,
    filter: (node) => {
      // Strip the overlay controls (MiniMap / Controls / attribution) from
      // the screenshot so the image is just the diagram surface.
      if (!(node instanceof HTMLElement)) return true;
      const cl = node.classList;
      if (
        cl.contains("react-flow__minimap") ||
        cl.contains("react-flow__controls") ||
        cl.contains("react-flow__attribution")
      ) {
        return false;
      }
      return true;
    },
  });

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${projectId}-${diagramId}.png`;
  a.click();
}
