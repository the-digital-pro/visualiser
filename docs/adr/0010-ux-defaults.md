# ADR-0010: UX defaults

**Status:** Accepted (2026-05-17)
**Related:** PRD §4, §7; ADR-0003 (navigation); ADR-0006 (canvas); ADR-0007 (validation)

## Context

A bundle of smaller UX questions needed locked answers to ship Phase 1. Recording them together so they don't drift in implementation. Each is small individually; together they define the product's feel.

## Decision

| Topic | Decision | Rationale |
|---|---|---|
| **Cross-project visual** | Dashed edge stroke + "↗" glyph at the target end. Unresolved-targetRef placeholder nodes render with dashed border + warning chip. | Signals "this leaves the current project" at a glance. |
| **Focus pulse on arrival** | 1.5s pulse (3 cycles), CSS-only. Respects `prefers-reduced-motion` → becomes a static 1.5s highlight. Clears on next user input. | Short enough to not annoy; long enough to register. |
| **Edge label display** | Always-visible compact badge (type + optional label, max ~24 chars). Full metadata in the drawer. | At 400 edges, always-visible is the only sane default; hover-only loses scan-ability. |
| **Detail drawer** | shadcn `Sheet`, **non-modal**, right side, ~420px. Pins open across selection changes — content updates in place. Esc clears selection and closes. | Modal would block canvas interaction; the whole UX depends on canvas + drawer being usable together. |
| **Search palette content** | Build-time `search-index.json` carries `{ projectId, diagramId, nodeId, name, kind, tags, description (first 200 chars) }` per node. **Edges are not indexed.** | Description-prefix gives meaningful fuzzy hits without bloating the index. Edges-as-results clutter; search by node instead. |
| **Search Cmd+K behaviour** | Results grouped by project. Enter routes through NavigationController. Recent searches in localStorage (max 10, session-scoped key). | Standard command-palette pattern. |
| **Filter persistence** | Filter state stored in the URL: `?filter=kind:service,tag:critical`. Per-diagram. Filtered nodes/edges fade (not hide) — preserves spatial reference. | Filtered views are exactly the kind of thing people share over Slack. |
| **Tour mode** | A "stop" is `{ diagramId, focusNodeId, note }`. Player navigates via NavigationController, opens drawer pinned to the note. Next/Prev/Esc. URL: `/tour/:projectId/:tourId?step=N`. | Reuses the navigation + drawer infrastructure already built. |
| **Empty home state** | No projects → "Add your first project" with CTAs: open editor with blank project, or import JSON. CTAs hidden in read-only build. | PRD §7.3 explicitly. |
| **Project landing page** (`/p/:projectId`) | Metadata + diagram list with thumbnails. Thumbnails generated client-side from an off-screen canvas on first hover; cached in `sessionStorage`. | Thumbnails on real diagrams beat a list of titles; hover-generation keeps the landing page fast. |
| **Keyboard nav on canvas** | Arrow keys move selection along edges (out-edge in arrow direction; nearest on tie). Tab cycles document order. Enter drills (if `childDiagramId`); Shift+Enter follows first outgoing cross-project edge. | Matches PRD §7.4. |
| **Mode toggle** | shadcn `Tabs` segmented control top-right: Present / Edit. In read-only build (`VITE_EDITOR_ENABLED=false`), the toggle is **not rendered**; `/edit/*` routes don't exist (tree-shaken). | PRD §4.3. |
| **Theme** | `next-themes` with `light` / `dark` / `system`. Persisted via library default (localStorage). | Defaults; nothing exotic. |
| **Telemetry** | Off by default. If enabled (localStorage flag, no UI in v1), emits anonymised counts only — never node content, never project ids. | PRD §8. |

## Consequences

**What this commits us to:**

- A consistent visual language for cross-project signals (dashed + "↗") — used across edge rendering, placeholder nodes, and search results.
- Pulse animation is CSS-only; no JavaScript animation library is needed in v1.
- The search index is denormalised at build time, which is why ADR-0002's Vite plugin owns it.
- Drawer-as-default-overlay shapes how the editor's properties panel is positioned (right side, replacing drawer in Edit mode).
- Filter state in URL means filters survive Slack-link round-trips — consistent with ADR-0003's "URL = current frame" model.

**What it costs us:**

- Thumbnails generated client-side mean the first-hover landing page experience has a small visual delay. Tradeoff against pre-generating thumbnails as build artifacts (more complexity, larger build).
- Always-visible edge badges add visual noise. Tuned via `max ~24 chars` truncation and a `kind`-coloured background.

## Alternatives considered

- **Modal drawer.** Tested in design — blocks canvas interaction during reading. Rejected.
- **Hover-only edge labels.** Faster on tiny diagrams; unusable at 400 edges where users need to scan the topology.
- **Eager thumbnails as build artifacts.** More complex plugin work; bigger built output. Deferred unless first-hover delay proves annoying.
- **Filter state in localStorage instead of URL.** Persists per-user but doesn't survive sharing. Lost the Slack-link use case.

## Implementation notes

- Pulse: Tailwind utility + a single keyframes block. `@media (prefers-reduced-motion)` swaps the keyframes for a steady highlight.
- Edge badge: a custom React Flow edge component that renders the label as a foreignObject in SVG.
- Filter URL encoding: comma-separated `key:value` pairs; values URL-encoded; max length ~200 chars (no realistic risk of overflow).
- Thumbnail generation: render the canvas at 1/8 scale into a hidden div, capture as an SVG string, embed inline. Don't use `html2canvas` (heavy, slow).
- Recent searches: `localStorage["arcviz:recent-searches"]` = JSON array of `{ query, ts }`, capped to 10, FIFO.
