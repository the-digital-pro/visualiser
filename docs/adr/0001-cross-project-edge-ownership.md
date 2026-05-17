# ADR-0001: Cross-project edge ownership

**Status:** Accepted (2026-05-17)
**Related:** PRD §3.2, §5.3; ADR-0002 (loading); ADR-0007 (validation)

## Context

The PRD's sample (§5.3) shows an edge stored in the Payments project pointing at a node in the Booking project, with `direction: "incoming"` flipping the semantic. This raises a question the PRD never directly answers: **who owns a cross-project edge?** The choice ripples through schema, editor UX, validation, file diffability, and the "what consumes me?" feature.

## Decision

**Source-only ownership.** An edge always lives in the project where its true `source` node lives. The on-disk schema uses `source` (in-project node id) plus optional `targetRef` (`"projectId:diagramId:nodeId"`) when the target is in another project. **The `direction` field is removed.**

To render "inbound" edges on the target side (e.g. Payments' `order-api` showing it's consumed by `booking-web`), the runtime indexes all currently-loaded projects and derives reverse-edges on the fly.

## Consequences

**What this commits us to:**

- One canonical place to mutate any edge — the project file of the `source` node.
- Byte-identical round-trip (Phase 2 Done criterion) becomes feasible — every edge has exactly one home.
- The editor never needs write access to a "foreign" project file when authoring a cross-project edge.
- The store must maintain a derived index keyed by `(projectId, diagramId, nodeId)` → inbound edges, recomputed when projects load/unload.
- Inbound-edge rendering depends on the *other* project being loaded. Pairs naturally with the lazy-loading model in ADR-0002.

**What it costs us:**

- Showing inbound edges on Payments requires Booking's JSON to be in memory. If Booking hasn't been visited, we render Payments' diagram without the inbound badges. This is *honest*, not broken — degrades gracefully.
- We can no longer model a connection as "owned by either side" — the editor must guide authors to add the edge from the source project.

## Alternatives considered

- **Either-side ownership.** The PRD's implied model with `direction`. Lets two authors describe the same connection two different ways → drift, no single source of truth, ambiguous reconciliation.
- **Two-sided / mirrored.** Editor mutates both files when a cross-project edge is created. Doubles write surface, complicates cross-repo workflows, makes byte-identical round-trip materially harder.

## Implementation notes

- Schema: `Edge = { id, source, target?, targetRef?, type, label?, metadata? }`. Exactly one of `target` or `targetRef` is set. (Structural validator enforces this.)
- The §5.3 sample edge `e3` should be **rewritten** to live in Booking with `source: "booking-web"` and `targetRef: "payments:container:order-api"`. The Payments side derives the inbound rendering from there.
- The cross-project-ref format `projectId:diagramId:nodeId` is also the canonical form for `childDiagramId` when drilling across projects.
- Reverse-edge derivation runs in a Zustand selector (memoised on the loaded-projects set).
