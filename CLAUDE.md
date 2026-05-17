# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository status

This repo is **pre-implementation**. There is no `package.json`, no `src/`, no build tooling yet. Phase 0 (scaffold) is the first task for the implementing agent.

**Source documents — read in this order:**

1. `IMPLEMENTATION_PLAN.md` — phased delivery plan with locked architectural decisions baked into each phase's scope, ordering, and Done criteria. **This is the day-to-day reference.**
2. `docs/adr/` — Architecture Decision Records for the ten consequential decisions. Read an ADR before challenging or extending the design it covers. See `docs/adr/README.md` for the index.
3. `architecture-visualizer-prd.md` — original PRD (the **what** and **why**). The implementation plan and ADRs override the PRD wherever they conflict (notably: edge ownership in ADR-0001, auto-layout in ADR-0005, validation tiers in ADR-0007).

Sections referenced below by number map to the PRD unless prefixed `ADR-`.

## What is being built

A single-page React app that lets Solutions Architects author connected, layered architecture diagrams and lets consumers (devs, BAs, OPS, QA) **navigate them like a map** — drilling into child diagrams and following service edges *across project boundaries*. Two modes in one app:

- **Present** — read-only consumer view (default)
- **Editor** — authoring surface for SAs; tree-shaken out when `VITE_EDITOR_ENABLED=false`

No backend in v1. Projects are JSON files served from `public/projects/`. Editor drafts live in `localStorage`; publishing means downloading the JSON and committing it.

## Mandated stack (PRD §6.1 — do not substitute without discussion)

- React 18 + TypeScript, **Vite**
- **Tailwind** + **shadcn/ui** (+ `lucide-react`)
- **react-router-dom v6+** — URL is source of truth on cold load
- **@xyflow/react** (React Flow) for the canvas
- **elkjs** primary + **dagre** fallback for auto-layout
- **Zustand** for state (pairs cleanly with React Flow)
- **Zod** to validate project JSON on load
- **Fuse.js** for the Cmd/Ctrl+K palette
- **react-hotkeys-hook**, **next-themes**
- Tests: **Vitest** + React Testing Library + **Playwright**

## Architecture: the load-bearing decisions

These are summarised here for orientation. Full rationale in `docs/adr/`.

### 1. Data model — `targetRef` is the only canonical cross-project shape (ADR-0001)

```
Workspace → Project → Diagram → Nodes + Edges
```

An **edge** lives in the project where its `source` node lives. For cross-project links it uses `targetRef` (`"projectId:diagramId:nodeId"`) instead of `target`. **There is no `direction` field** — the PRD §5.3 sample edge `e3` is wrong and should be rewritten. Inbound/reverse edges are *derived* at runtime from whichever projects are currently loaded.

Default node kinds: `actor`, `system`, `application`, `service`, `datastore`, `queue`, `infra`, `group`. Default edge types: `rest`, `graphql`, `grpc`, `jdbc`, `async`, `file`, `auth`, `generic`. Both are extensible.

### 2. NavigationController owns the semantic stack; URL = current frame; stack rides in `history.state` (ADR-0003)

A single controller in `lib/navigation.ts` owns `Array<{ projectId, diagramId, focusNodeId? }>`. **All** in-app navigation routes through it — drill-down, follow-connection, search palette, tour player. The URL only encodes the current frame; the full stack lives in `window.history.state` (survives soft reload; not in the URL bar). React Router POP events drive `popFromBrowser()` so the in-memory stack stays in lockstep with browser back/forward.

If you find yourself calling `react-router`'s `navigate()` directly, stop — you will desync URL, breadcrumb, and history.

### 3. Single persistent canvas; viewport cached per-diagram (ADR-0006)

One `<ReactFlow>` mounted at the layout level. Diagram navigation swaps `nodes`/`edges` props; **`key` is not `diagramId`**. Selection clears on navigation. Per-diagram viewport (zoom + pan) is cached in Zustand and restored on return. Follow-connection arrival → `setCenter` + 1.5s pulse class on the target.

### 4. Strict draft/publish isolation; canonical serializer (ADR-0004)

Present mode **never reads localStorage** except via the `?preview=draft` editor-only escape. Drafts live at `arcviz:draft:<projectId>`. Editor open compares the draft's recorded source hash against the manifest's current hash and shows a non-blocking banner on mismatch — **never auto-merge**. All stored JSON goes through `serializeProject(project)` in `lib/persistence.ts` (deterministic key order, 2-space indent) — this is what makes byte-identical round-trip possible.

### 5. No layout engine in the Present-only bundle (ADR-0005)

Positions are canonical at runtime. Auto-layout (elkjs) is **editor-only and dynamically imported**: `await import('elkjs/lib/elk.bundled.js')` only fires when the user clicks Layout → Auto-arrange. Hand-authored JSON without positions gets a tiny built-in grid fallback + a soft validation warning.

### 6. Three-tier validation (ADR-0007)

| Tier | Catches | Present | Editor |
|---|---|---|---|
| Structural | Zod schema failures | Project errors out with friendly card; others fine | Same + "Reset to published" |
| Referential | dangling `targetRef`/`childDiagramId`/`parentId` | Placeholder + chip | Validation panel flag |
| Soft | Orphans, missing optional metadata, missing positions | Silent | Validation panel flag |

The build-time Vite plugin (ADR-0002) runs structural validation and **fails the build** on errors — bad JSON never reaches consumers. The migration ladder (`lib/migrations/`) applies to both bundled files and localStorage drafts.

### 7. Single-level structural groups via `parentId` (ADR-0008)

`kind: "group"` nodes are React Flow parents. Children carry `parentId`. Nested groups are rejected by structural validation in v1; multi-level nesting is achieved through drill-down. Tags (`tags: string[]`) handle cross-cutting concerns — never use them for containment.

### 8. Snapshot-based undo with explicit commit points (ADR-0009)

Editor mutations are free-form; `commit()` snapshots `Project` at user-meaningful boundaries (drag-end, input-blur, palette-drop, `onConnect`, delete, auto-arrange-done, paste, reparent; import resets history). 50-entry cap. Viewport and selection are *not* undoable. **The same commit points trigger localStorage autosave** — one commit = one undo entry = one write.

### 9. Two modes, one app, tree-shakeable editor (ADR-0010)

Mode toggle is a top-right segmented control. The Editor surface (`components/editor/*`, routes under `/edit/...`) must be tree-shaken when `VITE_EDITOR_ENABLED=false` so the consumer bundle stays under 500 KB gzipped (PRD §8). The mode toggle isn't rendered in that build; `/edit/*` routes don't exist. Both tree-shaking *and* a route guard — belt and braces.

## Module layout (PRD §6.2 — follow this)

```
src/
├── app/                  # routing shell, providers, theme
├── components/
│   ├── ui/               # shadcn-generated primitives
│   ├── canvas/           # React Flow wrapper, custom node/edge components
│   ├── editor/           # palette, properties panel, validation (tree-shakeable)
│   ├── present/          # detail drawer, breadcrumbs, tour controls
│   └── common/           # search palette, mode toggle, theme switcher
├── lib/
│   ├── schema.ts         # Zod schemas + inferred TS types — single source of truth
│   ├── store.ts          # Zustand: project/diagram/selection/history
│   ├── navigation.ts     # see "NavigationController" above
│   ├── layout.ts         # elkjs/dagre adapters
│   ├── persistence.ts    # localStorage drafts, import/export, FS Access API
│   └── url.ts            # URL <-> state codec for deep links
└── projects/             # build-time typed accessors for bundled projects
public/projects/
├── manifest.json         # enumerates bundled projects (PRD §5.2)
└── <projectId>.json      # one file per project (PRD §5.3)
```

Routes (PRD §6.3): `/`, `/p/:projectId`, `/p/:projectId/d/:diagramId`, `/edit/p/:projectId/d/:diagramId`, `/tour/:projectId/:tourId`. `?focus=:nodeId` deep-links a selection.

## Project file conventions

- `schemaVersion: 1` — every project file. Future migrations key off this.
- Validate every loaded project with Zod and surface a friendly error card pointing at the offending path (PRD §7.3) rather than letting the canvas crash.
- `position` is optional; missing → run auto-layout on load.
- Adding a bundled project = drop the JSON in `public/projects/`, add a manifest entry. No code change required.
- Editor "Save" → autosave to `localStorage` key `arcviz:draft:<projectId>`. Editor "Export" → download JSON for commit. Round-trip must be byte-identical (PRD §9 Phase 2 Done criteria).

## Commands (expected once scaffolded — do not exist yet)

```bash
npm install
npm run dev           # Vite dev server
npm run build         # production build
npm run build:present # consumer build, VITE_EDITOR_ENABLED=false
npm run preview       # serve the built bundle
npm run test          # Vitest
npm run test:e2e      # Playwright
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
```

When scaffolding Phase 0, wire these scripts into `package.json` so later phases can rely on them.

## Phased delivery

**Read `IMPLEMENTATION_PLAN.md` for the full plan with scope, ordering, and Done criteria per phase.** Cliff notes:

- **Phase 0** — Scaffold + schema + canonical serializer + Vite plugin (search index + hashes). No canvas yet.
- **Phase 1** — Present MVP. Canvas, drill-down, follow-connection (cross-project), deep links, search palette. PRD §14 acceptance gate.
- **Phase 2** — Editor MVP. Palette, drag-to-connect, properties, undo/redo, auto-layout (dyn-import), import/export, validation panel, draft conflict banner. Done = byte-identical round-trip of the seed projects.
- **Phase 3** — Tours, filters, cross-project picker, FS Access API, keyboard nav, a11y polish, E2E suite.
- **Phase 4** — PWA, diff view, image export, mermaid blocks, nested groups (v2 — explicitly deferred from ADR-0008).

Don't start Phase N+1 until N's checklist is green.

## Non-obvious constraints

- **Bundle budget**: < 500 KB gzipped for the Present-only build (PRD §8). Watch React Flow + elkjs — elkjs in particular is heavy and should be dynamically imported, only when auto-layout is invoked.
- **Performance target**: smooth interaction at 200 nodes / 400 edges per diagram. Custom node/edge components should memoise aggressively.
- **Offline-capable**: no required network calls after first load. PWA-ready (Phase 4 turns it on).
- **`prefers-reduced-motion`**: respect it — disable the focus-pulse animation and any non-essential transitions.
- **Accessibility**: shadcn primitives are accessible out of the box; preserve that in custom nodes. Arrow-key navigation across the canvas (along edges) is in scope.

## Sample projects to ship (PRD §13)

Bundle **Booking Website** and **Payments Platform** wired with a cross-project edge. Per ADR-0001 (source-only edge ownership), the edge **lives in Booking** with `source: "booking-web"` and `targetRef: "payments:container:order-api"`. Payments renders the inbound side as a derived reverse-edge when both projects are loaded. This single demo is the product's headline value proposition — keep it working.

## Cross-phase invariants (mirror of `IMPLEMENTATION_PLAN.md`'s)

Violating one of these means revisiting an ADR, not making a local exception:

1. `targetRef` is the only canonical cross-project ref shape; no `direction` field.
2. The store only holds validated `Project` objects; `ProjectInput` lives only at the loader boundary.
3. All navigation routes through `NavigationController`.
4. The canonical serializer is the only producer of stored project JSON.
5. No layout engine in the Present-only build.
6. Mode toggle and `/edit/*` routes are absent in `VITE_EDITOR_ENABLED=false` builds.
7. Canvas is mounted once at layout level; `key` is not `diagramId`.
8. `commit()` is the shared boundary for undo history and autosave.
9. Three-tier validation severities are stable; new rules pick a tier first.
10. The Vite plugin ships in Phase 0 — search and hash-conflict detection depend on it.
