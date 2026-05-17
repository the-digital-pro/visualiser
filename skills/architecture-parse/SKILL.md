---
name: architecture-parse
description: Parse a codebase and emit a JSON project file for the architecture-visualizer app (matching its `ProjectInputSchema`). Use when the user wants to scaffold an architecture diagram from an existing repo, generate a `public/projects/<id>.json` file for the architecture-visualizer, convert a codebase into nodes/edges/diagrams, or seed a new architecture project from a real codebase.
---

# Architecture Parse

Read a codebase root and write **one** JSON file that conforms to the
architecture-visualizer's `ProjectInputSchema`. The user drops the file into
`public/projects/` of their visualizer or imports it via **Import JSON**.

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
7. **Serialise canonically** — exact key order per
   [REFERENCE.md#output-format](REFERENCE.md), 2-space indent, trailing
   newline.
8. **Write the file** to the path the user asked for (or suggest
   `public/projects/<id>.json` if they have the visualizer cloned).
9. **Suggest validation**: `npm run build` in the visualizer repo —
   structural errors fail the build; tier-2/3 issues surface in the
   editor's Validation panel.

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
- [ ] Output uses canonical key order + 2-space indent + trailing newline

## Scope

- **In:** static analysis of source files, manifests, infra config, ADRs / `ARCHITECTURE.md` if present (let the user's documented intent override your inferences).
- **Out:** running the code, executing tests, modifying source files. This
  skill writes exactly one JSON file.
- **Sibling skills** (future, not invoked here): `review-architecture`,
  `generate-tour`, `suggest-cross-project-refs`. Keep this skill focused on
  the parse-and-emit job.

## Worked example

See [EXAMPLES.md](EXAMPLES.md) for a complete React + Node monorepo walked
through end-to-end, with the resulting JSON.
