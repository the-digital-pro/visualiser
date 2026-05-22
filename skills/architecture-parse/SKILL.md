---
name: architecture-parse
description: Parse a codebase and emit a JSON project file for the architecture-visualizer app (matching its `ProjectInputSchema`). Use when the user wants to scaffold an architecture diagram from an existing repo, generate a `public/projects/<id>.json` file for the architecture-visualizer, convert a codebase into nodes/edges/diagrams, or seed a new architecture project from a real codebase.
---

# Architecture Parse

Read a codebase root and write **one** JSON file that conforms to the
architecture-visualizer's `ProjectInputSchema`. The user drops the file into
`public/projects/` of their visualizer or imports it via **Import JSON**.

## The product is a start-to-finish walkthrough

The architecture-visualizer is built around one core promise: a consumer
opens a project and gets walked through how the codebase **actually
functions** — from the first entry point a request hits, through each
service it touches, to the datastores and external systems that ultimately
service it. This skill MUST produce that walkthrough, not just a static
diagram.

That walkthrough lives in the project JSON as a `tours[0]` entry. The first
tour is non-optional: it is the headline value the consumer sees when they
open the project. Every project this skill emits must include it.

## Quick start

1. **Confirm the codebase root** with the user (absolute path).
2. **Pick a project identity** — ask if not obvious:
   - `id`: kebab-case ASCII (`^[a-z0-9][a-z0-9-]*$`), e.g. `payments-api`.
   - `name`: human-readable, e.g. "Payments API".
   - One-sentence description.
3. **Survey the codebase** using [REFERENCE.md](REFERENCE.md):
   - Read every dependency manifest (`package.json`, `pyproject.toml`,
     `Cargo.toml`, `go.mod`, `pom.xml`, `build.gradle`).
   - Walk likely directories: `src/`, `app/`, `server/`, `routes/`, `public/`,
     `prisma/`, `migrations/`, `infra/`, `terraform/`, `k8s/`, `docs/`.
   - If it's a monorepo (`pnpm-workspace.yaml` / `package.json#workspaces` /
     `lerna.json` / `turbo.json`), produce **one** project JSON; each
     workspace becomes a `system` node in the context diagram.
4. **Plan diagrams**:
   - Always a `context` diagram with the system-under-design + 1–2 external
     actors + the external services it talks to.
   - Add drill-downs (`frontend`, `backend`, `data`, `infra`) only where the
     parent has >3 internal nodes worth showing. Wire via `childDiagramId`
     on the parent.
5. **Lay out positions** on a 20px grid — see
   [REFERENCE.md#layout](REFERENCE.md).
6. **Emit edges** wherever a dependency clearly implies one (a service that
   imports `pg` → service → datastore via `jdbc`). Don't invent edges.
7. **Emit the start-to-finish walkthrough tour** — the headline output
   (`tours[0]`). Visit nodes in the order a request actually flows through
   the system. See [Walkthrough tour](#walkthrough-tour) below for the
   required shape.
8. **Serialise canonically** — exact key order per
   [REFERENCE.md#output-format](REFERENCE.md), 2-space indent, trailing
   newline.
9. **Write the file** to the path the user asked for (or suggest
   `public/projects/<id>.json` if they have the visualizer cloned).
10. **Suggest validation**: `npm run build` in the visualizer repo —
    structural errors fail the build; tier-2/3 issues surface in the
    editor's Validation panel.

## Walkthrough tour

This is the headline output. Without it, the resulting project file is
incomplete — the visualizer will open but the consumer never gets the
start-to-finish narrative the product is built around.

### Required shape

```json
{
  "id": "walkthrough",
  "name": "Start-to-finish walkthrough",
  "description": "Follow a request through the system, from entry to data layer.",
  "stops": [
    { "ref": "<projectId>:<diagramId>:<nodeId>", "note": "What happens here, in plain English." }
  ]
}
```

- `stops[].ref` is `projectId:diagramId:nodeId` (cross-project refs OK; the
  player follows them via NavigationController).
- `stops[].note` is one or two sentences. Plain English. Tell the consumer
  *what arrives at this node and what leaves it*.
- The tour file id MUST be `walkthrough` so the app can detect and surface
  it consistently.

### Picking the stop order

Walk in the order a real request flows:

1. **Entry** — the external actor or the first node the request touches
   (e.g. End user, Webhook, CLI operator).
2. **Edge / CDN / load balancer**, if present.
3. **The application / UI surface** the request lands on.
4. **Each service** the request hops through, in flow order, drilling into
   child diagrams where you have them. Reference the node *inside* the
   drill-down diagram once you cross that boundary.
5. **The datastore(s)** the request reads from or writes to.
6. **External systems** (auth, payments, observability, etc.) the request
   contacts before responding.
7. **The response path back to the actor**, only if it's interesting
   (e.g. a webhook ack, a streamed response).

Target **5–10 stops** for most projects. Fewer if the system is tiny; more
only if every extra stop genuinely adds clarity. Don't pad — a tight tour
is the goal.

### Notes that earn their place

Good stop notes answer one of:

- *Why is this node here?* (its responsibility in one sentence)
- *What enters this node, and what leaves it?* (the request/response shape)
- *What's the gotcha here?* (auth, retry, idempotency, fan-out)

Bad stop notes restate the node name or list its tags. If the diagram
already shows it, don't repeat it in the note.

## Workflow checklist

- [ ] Codebase root + project id/name confirmed
- [ ] Every dependency manifest read; dep map built
- [ ] Source tree walked; layered components identified
- [ ] Context diagram drafted (≤10 nodes, ≥1 external actor)
- [ ] Drill-downs drafted only where parent has >3 internals
- [ ] Positions snapped to 20px grid; no overlaps
- [ ] Every node has a `kind` from the allowed enum
- [ ] Every edge has exactly one of `target` / `targetRef` and a `type` from the allowed enum
- [ ] `homeDiagramId` matches an existing diagram
- [ ] **Start-to-finish walkthrough tour emitted** with `id: "walkthrough"`, stops in request-flow order, plain-English notes
- [ ] Output uses canonical key order + 2-space indent + trailing newline

## Scope

- **In:** static analysis of source files, manifests, infra config, ADRs / `ARCHITECTURE.md` if present (let the user's documented intent override your inferences). Producing the start-to-finish walkthrough tour.
- **Out:** running the code, executing tests, modifying source files. This
  skill writes exactly one JSON file.
- **Sibling skills** (future, not invoked here): `review-architecture`,
  `suggest-cross-project-refs`, additional themed tours beyond the
  default walkthrough.

## Worked example

See [EXAMPLES.md](EXAMPLES.md) for a complete React + Node monorepo walked
through end-to-end, with the resulting JSON.
