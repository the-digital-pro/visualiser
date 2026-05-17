# Architecture Visualizer — Implementation Plan

> **Status:** Plan v1.0 (locked 2026-05-17)
> **Source documents:** `architecture-visualizer-prd.md`, `docs/adr/*`
> **Audience:** Implementing engineers (Claude Code + humans)

This plan is the synthesis of ten resolved architectural decisions captured in `docs/adr/`. Read those for the **why** of any specific call; this document is the **what** and **when**.

---

## Cross-phase invariants

These constrain every phase. Violating one means revisiting an ADR, not making a local exception.

1. **`targetRef` is the only canonical cross-project ref shape.** No `direction` field anywhere. (ADR-0001)
2. **The store only ever holds validated `Project` objects.** `ProjectInput` exists at the loader boundary and nowhere else. (ADR-0007)
3. **All navigation routes through `NavigationController`.** Never call `react-router` `navigate()` from outside it. (ADR-0003)
4. **The canonical serializer is the only producer of project JSON for storage** — draft autosave, export, FS Access write, format conversions. (ADR-0004)
5. **No layout engine in the Present-only build.** Ever. The validation panel catches missing positions; the runtime falls back to a tiny built-in grid. (ADR-0005)
6. **The mode toggle and `/edit/*` routes do not exist in a `VITE_EDITOR_ENABLED=false` build.** Verify in CI by inspecting chunk names. (ADR-0010)
7. **The canvas is mounted once at the layout level.** Diagram navigation swaps data, never component identity. `key` is *not* `diagramId`. (ADR-0006)
8. **`commit()` is the shared boundary for undo history and localStorage autosave.** They use the same trigger points by design. (ADR-0009, ADR-0004)
9. **Three-tier validation severities never get reordered.** Structural fails the project; referential renders a placeholder; soft is editor-only advisory. Adding a new rule means picking a tier first. (ADR-0007)
10. **The Vite plugin ships in Phase 0.** Without it, Phase 1's search palette can't work and Phase 2's hash-conflict detection has nothing to check against. (ADR-0002, ADR-0004)

---

## Phase 0 — Foundations *(1 sprint)*

**Goal:** Boot a typed, themed, route-driven shell with the schema, loader, and build-time plugin in place. No canvas yet.

### Scope

- Vite + React 18 + TypeScript scaffold
- Tailwind + shadcn/ui setup, design tokens, light/dark via `next-themes`
- React Router v6 shell with stub routes:
  - `/`
  - `/p/:projectId`
  - `/p/:projectId/d/:diagramId`
  - `/edit/p/:projectId/d/:diagramId`
  - `/tour/:projectId/:tourId`
- Zustand store skeleton with slices for `projects`, `activeView`, `selection`, `history` (empty implementations)
- `lib/schema.ts` — Zod schemas for `ProjectInput` (lenient, on-disk shape) and `Project` (validated, in-store shape). Single source of truth for TS types. (ADR-0007)
- `lib/migrations/` — directory + ladder dispatcher. v1 happy-path only. (ADR-0007)
- `lib/persistence.ts` — canonical serializer `serializeProject(project): string`: enforced key order, 2-space indent, trailing newline. Foundation for byte-identical round-trip. (ADR-0004)
- `lib/url.ts` — URL ↔ frame codec. Used by `NavigationController` in Phase 1. (ADR-0003)
- **Vite plugin (`plugins/projects-plugin.ts`)** runs at build time:
  1. Reads every `public/projects/*.json`
  2. Runs Zod validation. **Fails the build** on structural errors.
  3. Emits `public/projects/search-index.json` with `{ projectId, diagramId, nodeId, name, kind, tags, description: first200 }` per node. (ADR-0002, ADR-0010)
  4. Emits content hashes per project into `public/projects/manifest.json`. (ADR-0004)
- Two sample projects on disk (schema-valid, empty diagrams): `payments.json`, `booking.json`. Real content lands in Phase 1.
- `package.json` scripts:
  - `dev` — Vite dev server
  - `build` — full production build
  - `build:present` — sets `VITE_EDITOR_ENABLED=false`; consumer bundle
  - `preview` — serves built bundle
  - `test` — Vitest
  - `test:e2e` — Playwright
  - `lint` — ESLint
  - `typecheck` — `tsc --noEmit`
- ESLint + Prettier configured; Vitest configured; Playwright installed (no specs yet).

### Done when

- `npm run dev` boots with no console errors.
- Home route renders the project list from `manifest.json` (no canvas, titles only).
- `/p/payments` renders project metadata (description, owners, tags).
- Build emits `search-index.json` and `manifest.json` with hashes.
- Theme toggle works and persists.
- `npm run build:present` produces a bundle where editor routes return 404 (tree-shaking proof of concept).
- Vitest passes for: schema parsing happy path, structural error reporting, canonical serializer round-trip on a hand-authored fixture.

### Out of scope

No React Flow. No drill-down. No editor surface. No project content beyond schema-valid stubs.

---

## Phase 1 — Present mode MVP *(1–2 sprints)* — handoff acceptance gate (PRD §14)

**Goal:** A consumer can navigate the bundled Payments + Booking projects fully, including cross-project hops. This is what "shippable to read-only consumers" looks like.

### Scope — inner order matters

**1.1 Canvas host (ADR-0006).** One `<ReactFlow>` mounted at the layout level. Active diagram's `nodes`/`edges` flow in as props. Custom node components per kind (`actor`, `system`, `application`, `service`, `datastore`, `queue`, `infra`, `group`). Custom edge components per type with always-visible badges. Per-diagram viewport cache in Zustand. **`key` is not `diagramId`.**

**1.2 Single-level groups (ADR-0008).** `kind: "group"` renders as a React Flow parent; children with `parentId` render inside. Subflow rendering and drag-with-children come from `@xyflow/react`.

**1.3 NavigationController (ADR-0003).** `lib/navigation.ts` owns the semantic stack `Array<{ projectId, diagramId, focusNodeId? }>`. Persists stack to `window.history.state` on every push; reads it back on hydration. Subscribes to React Router `useNavigationType()` POP events to pop in lockstep. URL is current-frame only.

**1.4 Selection + non-modal Detail drawer (ADR-0010).** shadcn `Sheet`, right side, ~420px, pins open across selection changes (content updates in place). Esc clears selection and closes.

**1.5 Drill-down.** Click node → select. Node with `childDiagramId` shows "Drill into →" in drawer. Double-click also drills. NavigationController pushes a new frame.

**1.6 Cross-project follow + reverse-edges (ADR-0001).** Click edge with cross-project `targetRef` → "Follow to target →" action. Lazy-loads target project (ADR-0002) if not cached. NavigationController pushes target's home diagram with `focusNodeId = target`. On arrival, `reactFlowInstance.setCenter(...)` + 1.5s pulse on target (CSS-only, respects `prefers-reduced-motion`). Reverse-edges from other loaded projects render automatically with dashed style and a "↗" glyph.

**1.7 Breadcrumb.** Renders directly from `NavigationController.stack`. Back/forward integrates with browser history.

**1.8 Search palette (ADR-0010).** `Cmd/Ctrl+K` opens shadcn `Command`. First open fetches `search-index.json` (cached for session). Fuse.js fuzzy across `name`/`description`/`tags`. Results grouped by project. Enter routes through `NavigationController`. Recent searches in localStorage (max 10).

**1.9 Three-tier validation in the loader (ADR-0007).** Loader runs Zod over fetched projects.
- Structural error → friendly error card with `issue.path` for *that project only*. Home and other projects unaffected.
- Referential errors → placeholder nodes with warning chips.
- Soft warnings → silently ignored in Present mode.

**1.10 Sample projects fully wired (PRD §13).** Booking BFF carries a real edge to the Payments REST tier via `targetRef`. Click it → land in Payments with the REST tier pulsing.

**1.11 URL deep linking.** `/p/:projectId/d/:diagramId?focus=:nodeId` restores the exact view. Filters in URL: `?filter=kind:service,tag:critical` (controls land in Phase 3; plumbing exists now).

### Done when (matches PRD §14)

- App boots from `npm run dev` with no console errors.
- Home lists projects from manifest.
- Both samples load and render without errors.
- Pan, zoom, fit-to-screen, minimap all work.
- Click node opens drawer; "Drill into" works for nodes with `childDiagramId`.
- Click cross-project edge follows correctly; target pulses on arrival.
- Breadcrumb reflects nav history; browser back navigates correctly.
- URL deep links restore exact view; soft reload preserves stack via `history.state`.
- `Cmd+K` finds nodes across all projects.
- Light/dark theme toggle works and persists.
- Vitest: NavigationController history semantics, schema validation tiers, reverse-edge derivation.
- One Playwright spec: full drill-down → follow-connection → back-navigation journey.

### Out of scope

No editor. No tour authoring (player not built yet). No filter UI controls. No FS Access API.

---

## Phase 2 — Editor MVP *(2 sprints)*

**Goal:** A Solutions Architect can build both sample projects from scratch and re-export them **byte-identically** to the seed files.

### Scope — inner order matters

**2.1 Mode toggle (ADR-0010).** Top-right segmented control (shadcn `Tabs`). Only renders when `VITE_EDITOR_ENABLED=true`. `/edit/*` routes exist only in that build.

**2.2 Properties panel.** Right sidebar — replaces the Detail drawer in Edit mode. All node/edge fields editable. Description gets a markdown-aware textarea (rendering deferred to Phase 4).

**2.3 Snapshot-based undo/redo (ADR-0009).** `history: { past: Project[], future: Project[] }` in store. `commit()` boundaries: drag-end, input-blur, palette-drop, `onConnect`, delete, auto-arrange-done, paste, reparent. Import resets history. 50-entry cap. Viewport and selection out of scope for undo. `Cmd+Z` / `Shift+Cmd+Z`.

**2.4 Palette + drag-to-create.** Left sidebar (shadcn `Resizable`) with the node kinds. Drag onto canvas → new node at drop point → `commit()`.

**2.5 Edge drag-to-connect.** React Flow `onConnect` → creates edge with `type: "generic"` → `commit()`. Properties panel opens immediately for type/label/metadata.

**2.6 Reparent (ADR-0008).** Drop a node onto a `group` node → set `parentId` → `commit()`. Drop outside → clear `parentId`. Single-level only; reject (with toast) attempts to parent a group inside another group.

**2.7 Auto-layout (ADR-0005).** `Layout → Auto-arrange` menu action. Dynamic `await import('elkjs/lib/elk.bundled.js')`. ELK runs on the current diagram with `parentId` hierarchy. Result writes positions into the project → `commit()`. **Not present in the Present-only build** — tree-shaken via the dynamic import boundary.

**2.8 LocalStorage draft + canonical serializer (ADR-0004).** Autosave to `arcviz:draft:<projectId>` on every `commit()`, via the canonical serializer from Phase 0. On editor open:
- If draft exists, load it (else fetch bundled).
- If draft's recorded source hash differs from `manifest.json`'s current hash, show non-blocking banner: **[Compare] [Keep my draft] [Discard and start fresh]**. Never auto-merge.
- "Reset to published" affordance always available.

**2.9 Export / Import.** Export uses canonical serializer → downloads JSON. Round-trip MUST be byte-identical against unmodified sample projects. Import → Zod-validate via migration ladder → load → resets history.

**2.10 Validation panel (ADR-0007).** Surfaces tier-2 (referential) + tier-3 (soft) issues for the active project. Click an issue → focus the offending node/edge. **Never blocks save or export.**

**2.11 Read-only build protection.** `VITE_EDITOR_ENABLED=false` build never reads localStorage at all (ADR-0004). Orphaned drafts on disk are harmless.

### Done when

- An SA recreates `payments.json` and `booking.json` from scratch in the editor.
- Export of unmodified samples is **byte-identical** to the seed files (`diff` shows zero changes).
- Undo/redo works at user-meaningful granularity across all commit points.
- Auto-arrange runs and respects group hierarchy.
- Draft conflict banner appears when bundled hash advances; "Keep my draft" and "Discard" both work.
- `npm run build:present` bundle still excludes the editor + elkjs (verify in build output).
- Vitest: serializer determinism, history stack semantics, hash-conflict detection.
- Playwright: end-to-end author flow (palette → connect → properties → auto-arrange → export → re-import → byte-identical).

### Out of scope

No tour authoring. No cross-project picker (use raw `targetRef` strings in properties panel; picker lands in Phase 3). No FS Access API. No clone-as-v2 (deferred to Phase 4).

---

## Phase 3 — Polish & power features *(1–2 sprints)*

**Goal:** Production-ready editor and consumer experience.

### Scope

- **Tour mode (ADR-0010).**
  - Author UI: list of stops with diagram + node picker + note field.
  - Player at `/tour/:projectId/:tourId?step=N`: navigates via NavigationController, opens drawer pinned to the note. Next/Prev/Esc. Deep-linkable mid-tour.
- **Filter controls (ADR-0010).** UI for the URL filters wired in Phase 1. Filtered nodes/edges fade (not hidden) — preserves spatial reference.
- **Cross-project node/diagram picker.** Properties panel modal: when setting `childDiagramId` or `targetRef`, browses all known projects (manifest + lazy-load on selection) and emits the fully-qualified ref.
- **FS Access API integration.** Editor "Save to folder…" (Chromium only — feature-detect, hide button otherwise). Same canonical serializer underneath.
- **Keyboard shortcut cheatsheet.** `?` opens shadcn `Dialog` listing all bindings.
- **Keyboard navigation on canvas (ADR-0010).** Arrow keys move selection along edges (out-edge in the direction; nearest if multiple). Tab cycles document order. Enter drills. Shift+Enter follows first outgoing cross-project edge.
- **Project landing thumbnails (ADR-0010).** Generated on hover from an off-screen canvas render, cached in `sessionStorage`.
- **Accessibility polish.** `prefers-reduced-motion` audit, AA contrast in both themes, full keyboard reachability sweep.
- **Animation polish.** Refine focus pulse, viewport transitions, drawer slide.
- **E2E suite expansion.** Specs covering: tour player, filter URL persistence, cross-project picker, undo/redo across reload (draft restoration), hash-conflict banner.

### Done when

- Tour from sample projects walks a new joiner through Payments + Booking with deep-linkable steps.
- Filter URL parameters round-trip across reload and sharing.
- All routes pass a Lighthouse a11y audit ≥ 95 in both themes.
- Bundle: Present-only build verified under 500 KB gzipped (PRD §8).
- Playwright suite covers all PRD §14 criteria plus tours, filters, hash conflicts.

### Out of scope

PWA, diff view, image export, mermaid blocks in descriptions. Phase 4 territory.

---

## Phase 4 — Post-MVP nice-to-haves *(not part of "ready to ship")*

- PWA / offline install (service worker, `manifest.webmanifest`, cache strategy for project JSON).
- Clone project as `v2` (snapshot/version).
- Side-by-side diff view of two project versions (uses canonical serializer for structural diffs, not text diffs).
- Markdown rendering in node descriptions (`react-markdown` + embedded mermaid blocks).
- Export current view to PNG / SVG / PDF.
- Aggressive idle-time prefetch of all manifest projects (improves reverse-edge UX without changing the loading model).
- Nested groups (defer from v1 — ADR-0008 explicitly bounds this).

---

## How to use this plan

- Each phase has a **single goal sentence** — if scope creep makes the goal blurrier, push back to a later phase.
- The **Done criteria** are gates. Do not start phase N+1 until phase N is fully green.
- Every architectural decision points at an ADR. If a decision needs to change, write a superseding ADR — don't edit the original.
- Cross-phase invariants live at the top of this file. Read them whenever the work feels like it might violate one.
