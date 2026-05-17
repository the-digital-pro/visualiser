# ADR-0006: Canvas lifecycle

**Status:** Accepted (2026-05-17)
**Related:** PRD §7.1, §8; ADR-0003 (navigation)

## Context

React Flow holds substantial internal state — node measurements, edge geometry, viewport transform, selection, drag state. The cost of unmounting and remounting it on every diagram navigation is significant at 200 nodes: hundreds of milliseconds of reflow, plus loss of animation continuity. The "focus pulse on follow-connection arrival" requires the canvas to be live during the transition; unmount/remount makes it a static highlight on mount. Users also build spatial memory ("I was zoomed into the lower-right of the container diagram, when I come back I should land there") — Figma sets this expectation.

## Decision

**Single persistent `<ReactFlow>` instance mounted at the app layout level. Data swaps on diagram navigation. Per-diagram viewport state is cached in Zustand.**

- `nodes` and `edges` props update when the active diagram changes.
- **`key` is not `diagramId`** — that would force remount, defeating the entire purpose.
- On navigation:
  1. Save current viewport (`{ zoom, x, y }`) to a Zustand cache keyed by `projectId:diagramId`.
  2. Update `nodes`/`edges` props.
  3. Clear selection.
  4. On the next frame, restore (or fit-to-screen) the viewport for the new diagram.
  5. If `focusNodeId` is set on the incoming Frame, run `setCenter(targetX, targetY, { duration: 600, zoom: 1.2 })` followed by a 1.5s CSS pulse class on the target node.

## Consequences

**What this commits us to:**

- Selection, hover, and drag-in-progress state are *active-diagram* state — they clear on every navigation.
- Viewport is *per-diagram* state — restored from the cache on return.
- Stack, search index, and loaded-projects map are *global* state — survive all navigations.
- Mode (Present vs Editor) is a property of the rendering shell, not a separate canvas. Same `<ReactFlow>` instance powers both.
- We commit to using React Flow's controlled-mode API (`useNodesState` / `useEdgesState`) as the only source of truth for canvas state. No ad-hoc imperative ref mutations.

**What it costs us:**

- Long-lived canvas instances can theoretically accumulate stale internal state. Mitigated by always clearing selection on navigation and never holding references to stale node objects.
- The cache is bounded only by the number of diagrams the user visits in a session. At thousands of diagrams it could grow, but that's not a realistic v1 problem; an LRU bound is a Phase 4 nice-to-have.

## Alternatives considered

- **One canvas per route (unmount/remount).** Clean state isolation. Always fits-to-screen on arrival. Slow at 200 nodes; kills the focus pulse; loses spatial memory.
- **Cached instance pool.** Multiple React Flow instances kept alive, swapped via display:none. Memory-heavy; React Flow doesn't behave well when hidden (resize observer issues).

## Implementation notes

- Canvas host (`components/canvas/CanvasHost.tsx`) is mounted by the layout, above the route outlet. The route content sets `nodes`/`edges` via the store.
- Viewport cache shape in Zustand: `Map<string, { zoom: number; x: number; y: number }>` keyed by `projectId:diagramId`.
- Pulse class (`animate-pulse-once` or similar) is added to the target node's CSS class for 1.5s, then removed via `setTimeout`. Respects `prefers-reduced-motion` (becomes a static 1.5s highlight instead).
- For 200-node diagrams, custom node and edge components must be memoised (`React.memo` + stable props). React Flow's docs are the authoritative reference here.
