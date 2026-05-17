# Architecture Visualizer — Product Requirements Document

> **Status:** Draft v1.0
> **Owner:** Solutions Architecture
> **Audience for handoff:** Claude Code (implementation), Solutions Architects (authoring), Developers / BAs / OPS / QA (consumers)
> **Doc purpose:** End-to-end specification for building a modern, interactive web application that visualises software architecture, supports drill-down through layers and traversal across interconnected services, and ships with both a **Present mode** (read-only consumer view) and an **Editor mode** (authoring tools for Solutions Architects).

---

## 1. Vision & Problem Statement

### 1.1 The problem
Architecture documentation in most engineering organisations is fragmented across Confluence pages, Word documents, Visio files, Lucid boards, READMEs and tribal knowledge. To understand how a single REST endpoint fits into the wider system, an engineer typically has to open five documents, cross-reference them mentally, and hope they are all current. The cost is:

- Onboarding time for new joiners
- Stale documentation that nobody trusts
- Information asymmetry between Solutions Architects and the wider org (developers, BAs, OPS, QA)
- Slow incident response because nobody can quickly trace upstream/downstream dependencies

### 1.2 The vision
A single, modern web application where a Solutions Architect authors a connected, layered architecture model once, and any stakeholder can then **navigate it like a map** — drilling down into components, following service edges across application boundaries, and reading just-in-time context as they go. The same app contains both the authoring environment and the consumer-facing presenter.

### 1.3 Goals
1. Reduce time-to-understanding of any architectural concern from "hours of reading" to "minutes of navigating".
2. Make traversal of cross-service connections (e.g. *"this REST endpoint is consumed by which front end?"*) a first-class interaction.
3. Give Solutions Architects a fast, modern editing surface so the docs actually stay current.
4. Ship as a single web app that can be bundled with project files and deployed internally (no backend required for MVP).

### 1.4 Non-goals
- This is **not** a runtime topology discovery tool (no live agents, no APM scraping). It models *intended* architecture as authored by humans.
- This is **not** a code-generation tool.
- This is **not** a replacement for ADRs (Architecture Decision Records) — though it can link out to them.
- No multi-user real-time collaboration in v1 (single-author editing, file-based handoff).

---

## 2. Personas & Primary Use Cases

### 2.1 Personas

| Persona | Role | Mode used | Key needs |
|---|---|---|---|
| **Sarah** — Solutions Architect | Author | Editor + Present | Fast modelling, validation, cross-linking, export/bundle |
| **Dev** — Software Engineer | Consumer | Present | Trace a service end-to-end, find owners, see contracts |
| **Bea** — Business Analyst | Consumer | Present | Understand which capabilities map to which systems |
| **Otis** — OPS / SRE | Consumer | Present | Find upstream/downstream dependencies during incidents |
| **Quinn** — QA Lead | Consumer | Present | Identify integration points and test boundaries |

### 2.2 Headline use cases
1. *"Show me the **complete journey** of a customer order from the booking website through to the database."*
2. *"This REST endpoint just went down — what depends on it?"*
3. *"Walk a new joiner through our payments platform in 15 minutes."*
4. *"As a BA, which systems are touched by the new refund capability?"*
5. *"As QA, what are the integration boundaries I need to mock for this service?"*

---

## 3. Core Concepts & Domain Model

The app is modelled loosely on the **C4 model** (Context → Container → Component → Code) but is not strictly prescriptive — Solutions Architects can name layers whatever they want.

### 3.1 Conceptual hierarchy

```
Workspace
└── Project (e.g. "Payments Platform")
    └── Diagram (a "view" — context, container, component, etc.)
        ├── Nodes (components, services, databases, queues, actors, etc.)
        └── Edges (connections between nodes: REST, gRPC, JDBC, async, etc.)
```

### 3.2 Key relationships
- **Drill-down:** a Node can declare `childDiagramId` pointing to another Diagram (within the same Project or cross-project). Clicking the node in Present mode navigates into that diagram.
- **Follow-connection (traversal):** an Edge represents a runtime connection. Edges are typed (REST, gRPC, JDBC, Kafka, etc.) and can target Nodes in **other Projects**. This is the killer feature — clicking through an edge takes you to the target node's home diagram with the edge highlighted on arrival.
- **Cross-project linking** is achieved via fully-qualified node IDs: `projectId:diagramId:nodeId`.

### 3.3 Node taxonomy (default kinds, extensible)
- `actor` — person, role, or external organisation
- `system` — black-box external system
- `application` — internal app (web, mobile, batch, service)
- `service` — a logical service tier (REST API, GraphQL, gRPC, message handler)
- `datastore` — database, cache, object store, search index
- `queue` — message broker / event stream
- `infra` — load balancer, gateway, CDN, etc.
- `group` — visual container/boundary (e.g. "AWS account A", "DMZ")

Each kind ships with a default icon, colour token, and shape, all overridable per node.

### 3.4 Edge taxonomy (default types, extensible)
- `rest` (HTTPS/JSON)
- `graphql`
- `grpc`
- `jdbc` / `sql`
- `async` (Kafka/SQS/etc.)
- `file` (S3, SFTP, etc.)
- `auth` (OIDC/SAML)
- `generic`

Edges carry metadata: protocol, port, auth, SLA, contract link, owner, criticality.

---

## 4. Modes

### 4.1 Present mode (default for consumers)
A read-only, polished view designed to be projected, screenshared, or browsed by non-architects.

**Behaviours:**
- Pan, zoom, fit-to-screen, mini-map
- **Click node → drill down** into its child diagram (if defined)
- **Click edge → follow** to the target node's home diagram (target node enters highlighted/pulsing)
- **Breadcrumb trail** at the top showing navigation history with back/forward
- **Detail drawer** (right-side `shadcn/ui` Sheet) showing the selected node/edge metadata: description, owners, tech stack, links to ADRs/runbooks/repos, contract docs
- **Search palette** (`Cmd/Ctrl+K`, `shadcn/ui` Command) for jumping to any node across all projects
- **Tour mode**: the author can define an ordered sequence of "stops" through the architecture — Present mode advances through them with Next/Prev (great for onboarding sessions)
- **URL deep linking**: every view, selection, and breadcrumb state is encoded in the URL so links can be shared in Slack/Jira (`/p/payments/d/container?focus=order-svc`)
- **Filters**: by node kind, by tag (e.g. `critical`, `PCI-scope`, `legacy`), by team owner
- **Layered visibility**: toggle on/off categories like "infra", "external systems", "queues only", etc.
- **Theme**: light/dark/auto

### 4.2 Editor mode (Solutions Architects only)
A full authoring surface. Should feel as fast and modern as Figma or Linear.

**Behaviours:**
- Drag-and-drop node palette (`shadcn/ui` Resizable left sidebar)
- Click-drag from a node's port to create an edge
- Multi-select, group, align, distribute
- Auto-layout (using **elkjs** or **dagre**) on demand: `Layout → Auto-arrange`
- **Properties panel** (right sidebar) showing the inspected node/edge with full metadata fields
- **Cross-project node picker** when setting a node's `childDiagramId` or an edge's `target`
- **Validation panel** flagging:
  - Orphan nodes (no incoming or outgoing edges)
  - Dangling drill-down references (childDiagramId points to a missing diagram)
  - Cross-project edges pointing to non-existent target nodes
  - Edges with missing required metadata (e.g. critical edge without an owner)
- **Undo/redo** (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z), with full history within a session
- **Save** writes the project to local storage (working draft) and exposes an **Export** to download the JSON file
- **Import** accepts a project JSON file and loads it into the editor
- **Snapshot/version**: ability to clone a project as `v2`
- **Keyboard shortcuts** for everything (`?` opens cheatsheet)

### 4.3 Mode switching
- Top-right toggle (`shadcn/ui` Tabs or a segmented control): **Present** / **Edit**
- Edit mode can be hidden entirely in a "deployed read-only build" via a build-time env flag (`VITE_EDITOR_ENABLED=false`) so the bundled app is consumer-only when desired

---

## 5. Project Files & Persistence

### 5.1 Project file format
Each Project is a single JSON file conforming to the schema below. Files are human-readable, diffable, and Git-friendly so they can live in a repo alongside the app or in a separate `architecture-docs` repo.

**File path convention:** `public/projects/<project-id>.json`

### 5.2 Manifest
`public/projects/manifest.json` enumerates the projects that ship with the build. The app fetches this manifest on startup and lists projects on the home screen. Adding a new project = drop the JSON in `public/projects/` and add an entry in `manifest.json`.

```json
{
  "version": 1,
  "projects": [
    { "id": "payments", "file": "payments.json", "name": "Payments Platform", "summary": "Authorisation, capture, settlement, refunds.", "owners": ["Platform Squad"], "tags": ["pci", "critical"] },
    { "id": "booking",  "file": "booking.json",  "name": "Booking Website",   "summary": "Customer-facing booking journey.",                "owners": ["Web Squad"],      "tags": ["customer"] }
  ]
}
```

### 5.3 Project schema (illustrative, Zod-validated at load)

```json
{
  "schemaVersion": 1,
  "id": "payments",
  "name": "Payments Platform",
  "description": "Authorisation, capture, settlement, refunds.",
  "owners": ["Platform Squad"],
  "tags": ["pci", "critical"],
  "defaultDiagramId": "context",
  "diagrams": [
    {
      "id": "context",
      "name": "System Context",
      "layer": "context",
      "description": "How the payments platform fits in the wider business.",
      "nodes": [
        {
          "id": "customer",
          "kind": "actor",
          "name": "Customer",
          "position": { "x": 100, "y": 100 }
        },
        {
          "id": "payments-platform",
          "kind": "application",
          "name": "Payments Platform",
          "description": "Handles all card and wallet payments.",
          "owners": ["Platform Squad"],
          "tags": ["pci"],
          "childDiagramId": "container",
          "position": { "x": 400, "y": 100 }
        }
      ],
      "edges": [
        {
          "id": "e1",
          "source": "customer",
          "target": "payments-platform",
          "type": "rest",
          "label": "Pays via",
          "metadata": { "protocol": "HTTPS", "auth": "OAuth2" }
        }
      ]
    },
    {
      "id": "container",
      "name": "Containers",
      "layer": "container",
      "nodes": [
        {
          "id": "order-api",
          "kind": "service",
          "name": "Order API",
          "description": "REST API for order lifecycle.",
          "childDiagramId": "order-api-components",
          "position": { "x": 200, "y": 200 }
        },
        {
          "id": "payments-db",
          "kind": "datastore",
          "name": "Payments DB",
          "description": "PostgreSQL primary.",
          "position": { "x": 600, "y": 200 }
        }
      ],
      "edges": [
        {
          "id": "e2",
          "source": "order-api",
          "target": "payments-db",
          "type": "jdbc",
          "label": "reads/writes"
        },
        {
          "id": "e3",
          "source": "order-api",
          "targetRef": "booking:container:booking-web",
          "type": "rest",
          "label": "Consumed by",
          "direction": "incoming"
        }
      ]
    }
  ],
  "tours": [
    {
      "id": "new-joiner",
      "name": "New Joiner — 15min walkthrough",
      "stops": [
        { "diagramId": "context",   "focusNodeId": "payments-platform", "note": "Big picture first." },
        { "diagramId": "container", "focusNodeId": "order-api",        "note": "Main entry point." },
        { "diagramId": "container", "focusNodeId": "payments-db",      "note": "Where state lives." }
      ]
    }
  ]
}
```

Key conventions:
- `targetRef` (instead of `target`) is used for **cross-project edges**, in the form `projectId:diagramId:nodeId`.
- `childDiagramId` may also be a cross-project ref for cross-project drill-down.
- `position` is optional; if missing, auto-layout runs on load.
- `schemaVersion` enables future-proof migrations.

### 5.4 Persistence strategy

| Action | Where it goes |
|---|---|
| Bundled projects | `public/projects/*.json` (read-only at runtime, fetched on startup) |
| Editor working drafts | `localStorage` under `arcviz:draft:<projectId>` (autosaved every change) |
| Editor publish | `Export` button downloads the JSON — author commits it to the repo and rebuilds the app |
| Optional power-user save | **File System Access API** (Chromium only) → write directly back to a chosen folder |

This keeps v1 backend-free. A future v2 can introduce a Git-backed or S3-backed store without changing the data model.

---

## 6. Technical Architecture

### 6.1 Stack (mandated)

| Layer | Choice | Why |
|---|---|---|
| Framework | **React 18 + TypeScript** | Strong typing; large ecosystem |
| Build | **Vite** | Fast, modern dev experience |
| Styling | **Tailwind CSS** | Required by brief |
| UI primitives | **shadcn/ui** | Required by brief; accessible, themeable |
| Icons | **lucide-react** | Ships with shadcn |
| Routing | **react-router-dom v6+** | Deep linkable, nested routes |
| Diagram engine | **@xyflow/react** (React Flow) | Mature, performant, customisable; perfect for this use case |
| Auto-layout | **elkjs** (primary) + **dagre** (fallback for small graphs) | ELK gives best results for layered diagrams |
| State | **Zustand** | Lightweight; pairs cleanly with React Flow |
| Schema validation | **Zod** | Validate project JSON on load with clear errors |
| Search | **Fuse.js** | Fast fuzzy search across nodes/edges |
| Keyboard shortcuts | **react-hotkeys-hook** | Power-user productivity |
| Theme | **next-themes** | Light/dark/auto, integrates with shadcn tokens |
| Testing | **Vitest** + **React Testing Library** + **Playwright** | Unit, component, and E2E coverage |
| Lint/format | **ESLint** + **Prettier** | Consistency |

### 6.2 High-level module layout

```
src/
├── app/                       # Routing shell, providers, theme
├── components/
│   ├── ui/                    # shadcn-generated primitives
│   ├── canvas/                # React Flow wrapper, custom node/edge components
│   ├── editor/                # Palette, properties panel, validation
│   ├── present/               # Detail drawer, breadcrumbs, tour controls
│   └── common/                # Search palette, mode toggle, theme switcher
├── lib/
│   ├── schema.ts              # Zod schemas + types
│   ├── store.ts               # Zustand store (project/diagram/selection/history)
│   ├── navigation.ts          # Drill-down + follow-connection logic, breadcrumb stack
│   ├── layout.ts              # elkjs/dagre adapters
│   ├── persistence.ts         # localStorage drafts, file import/export, FS API
│   └── url.ts                 # URL <-> state codec for deep links
├── projects/                  # (build-time) typed accessors for bundled projects
└── main.tsx
public/
├── projects/
│   ├── manifest.json
│   ├── payments.json
│   └── booking.json
```

### 6.3 Routing

| Route | Purpose |
|---|---|
| `/` | Home — list of projects from manifest, recent items, search |
| `/p/:projectId` | Project landing — overview, list of diagrams, tours |
| `/p/:projectId/d/:diagramId` | Present mode for a specific diagram |
| `/p/:projectId/d/:diagramId?focus=:nodeId` | Deep link to focused selection |
| `/edit/p/:projectId/d/:diagramId` | Editor mode |
| `/tour/:projectId/:tourId` | Guided tour player |

### 6.4 Navigation engine (the key behaviour)
A single `NavigationController` (in `lib/navigation.ts`) owns the history stack of `{ projectId, diagramId, focusNodeId? }` frames. All in-app navigation routes through it so that:

- Drill-down (node click in Present) pushes the child diagram frame
- Follow-connection (edge click in Present) resolves `targetRef` and pushes the target's home diagram frame with the target node as `focusNodeId`
- Browser back/forward integrates via `react-router`'s history
- The breadcrumb is rendered directly from the stack
- URL is kept in sync (and is the source of truth on cold load)

---

## 7. UX & Interaction Details

### 7.1 Canvas interactions (Present)
- **Hover node** → soft highlight, tooltip with name + kind
- **Click node** → select; opens right Sheet with metadata; if `childDiagramId` exists, the Sheet shows a prominent **"Drill into →"** action
- **Click edge** → select; Sheet shows metadata; **"Follow to target →"** action
- **Double-click node** → drill down (shortcut)
- **Right-click** → context menu (in Editor only): duplicate, delete, set as drill-down target, etc.
- **Esc** → clear selection / close drawer
- **`F`** → fit-to-screen, **`0`** → reset zoom, **`/`** → focus search

### 7.2 Visual language
- Each node kind has a distinct shape + colour token derived from the Tailwind theme
- Edges are colour-coded by type (REST, async, JDBC, etc.) with a small badge label
- Cross-project edges are rendered with a dashed style + a small "↗" glyph to signal "leaves this project"
- Group/boundary nodes render as labelled translucent containers
- Highlighted/focused nodes pulse subtly on arrival via a follow-connection

### 7.3 Empty states & errors
- No projects? → home shows "Add your first project" with a link to the editor's New Project flow
- Project fails Zod validation? → friendly error card with the offending path and a link to docs
- Cross-project ref unresolved? → render a placeholder "missing target" node with a warning chip

### 7.4 Accessibility
- All shadcn components are accessible out of the box; preserve this in custom nodes
- Full keyboard navigation across the canvas (arrow keys move selection along edges)
- Respect `prefers-reduced-motion` (disable pulse/animation)
- Sufficient colour contrast in both themes (AA minimum)

---

## 8. Non-functional Requirements

| Concern | Target |
|---|---|
| Cold load | < 2s to interactive on a typical corporate laptop |
| Diagram size | Smooth interaction at 200 nodes / 400 edges per diagram |
| Project count | Handle 50+ bundled projects |
| Browsers | Latest 2 versions of Chrome, Edge, Firefox, Safari |
| Bundle size | < 500 KB gzipped for the consumer (Present-only) build |
| Offline | Works fully offline once loaded (PWA-ready, no required network calls) |
| Telemetry | Opt-in only, off by default. If enabled, anonymous usage counts only — never node content |

---

## 9. Phased Delivery Plan

Designed so Claude Code can deliver in shippable increments.

### Phase 0 — Foundations (1 sprint)
- Vite + React + TS scaffold
- Tailwind, shadcn/ui setup, theme tokens, light/dark
- Routing shell, layout (top bar, sidebar slots)
- Zustand store skeleton
- Zod schemas + sample bundled projects + manifest loader

**Done when:** the app boots, shows the home screen with the list of bundled projects, and can navigate to an empty project page.

### Phase 1 — Present mode MVP (1–2 sprints)
- React Flow canvas with custom node/edge components
- Render a diagram from JSON
- Pan/zoom/minimap/fit
- Click node → detail Sheet
- Drill-down via `childDiagramId` + breadcrumb stack
- Follow-connection via `targetRef`
- URL deep linking
- Search palette

**Done when:** a consumer can navigate the bundled Payments + Booking sample fully, including cross-project hops.

### Phase 2 — Editor MVP (2 sprints)
- Drag-from-palette node creation
- Edge drag-to-connect
- Properties panel with full metadata
- Auto-layout via elkjs
- Undo/redo
- Local-storage drafts
- Import / Export JSON
- Validation panel (orphans, dangling refs)

**Done when:** an SA can build the included sample projects from scratch and re-export them byte-identically.

### Phase 3 — Polish & power features (1–2 sprints)
- Tours (author + player)
- Filters & layered visibility
- Cross-project node/diagram picker in Editor
- Keyboard shortcut cheatsheet
- File System Access API integration (Chromium)
- Theming polish, animations, reduced-motion
- E2E test suite

### Phase 4 — Nice-to-haves (post-MVP)
- PWA / offline install
- Side-by-side compare of two diagram versions
- Markdown rendering in node descriptions (already lightweight) → embedded mermaid blocks
- Export current view to PNG / SVG / PDF
- Read-only build flag for distribution to non-authors

---

## 10. Out of Scope (v1)

- Real-time multi-user collaboration
- Backend persistence (DB, API)
- SSO / authentication / per-user permissions (the app is read-only-for-most by virtue of build flag and read-only files)
- Live runtime topology ingestion (APM, service mesh)
- AI-assisted authoring (e.g. "describe this service and I'll generate the diagram")
- Mobile-optimised editing (Present mode should still look reasonable on tablet; Editor is desktop-first)

---

## 11. Success Metrics

- **Adoption:** ≥ 80% of in-scope engineering teams have at least one project authored within 3 months of launch.
- **Currency:** ≥ 70% of projects have a commit in the last 90 days (proxy: file mtime in the bundled repo).
- **Time-to-understanding:** Survey new joiners — target ≥ 50% reduction in self-reported time to feel comfortable with the payments platform.
- **Traversal usage:** ≥ 30% of Present-mode sessions include at least one follow-connection or drill-down (i.e. it's actually being used as a graph, not just a static diagram viewer).

---

## 12. Open Questions

1. Should cross-project drill-down/follow-connection prompt for confirmation (since it leaves the current mental context)? Default: no, but offer a "show me on hover" preview tooltip.
2. Should we adopt the C4 model's terminology explicitly (Context/Container/Component) or stay neutral and let authors name layers freely? **Recommendation:** stay neutral, ship C4 as a starter template.
3. Versioning of project files: do we version per-diagram or per-project? **Recommendation:** per-project, with a `schemaVersion` plus optional human-facing `version` string.
4. Should the Editor surface be hidden behind a route guard in distributed builds, or fully tree-shaken at build time? **Recommendation:** both — tree-shake on `VITE_EDITOR_ENABLED=false`, and guard the route as a belt-and-braces measure.

---

## 13. Appendix A — Suggested sample projects to ship

Bundle two interconnected sample projects so the cross-project traversal is demonstrable out of the box:

1. **Booking Website** — a customer-facing web frontend (React), a Backend-for-Frontend (Node), and outbound REST calls to the Payments Platform.
2. **Payments Platform** — a Java application with REST tier, service tier, PostgreSQL, and a Kafka outbox.

Wire them so that the BFF in Booking has an edge pointing to the Payments REST tier via `targetRef`, and clicking it in Present mode lands the user inside the Payments Platform diagram with the REST tier highlighted. This is the single best demonstration of the product's value.

---

## 14. Appendix B — Definition of Done for handoff to Claude Code

The implementing agent should consider Phase 1 (Present MVP) **done** when *all* of the following are true:

- [ ] App boots from `npm run dev` with no console errors
- [ ] Home screen lists projects from `public/projects/manifest.json`
- [ ] Both sample projects load and render without errors
- [ ] Pan, zoom, fit-to-screen, mini-map all work
- [ ] Clicking a node opens the detail Sheet; clicking a node with `childDiagramId` exposes a "Drill into" action that navigates correctly
- [ ] Clicking an edge with a cross-project `targetRef` navigates to the target diagram with the target node visibly focused
- [ ] The breadcrumb reflects navigation history and supports back navigation
- [ ] URL deep links restore the exact view on reload
- [ ] Search palette (`Cmd/Ctrl+K`) finds nodes across all projects
- [ ] Light/dark theme toggle works and persists
- [ ] Vitest unit tests pass for the navigation engine and schema validation
- [ ] At least one Playwright E2E test exercises a full drill-down + follow-connection journey

---

*End of PRD.*
