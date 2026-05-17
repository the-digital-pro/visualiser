# ADR-0008: Group/boundary semantics

**Status:** Accepted (2026-05-17)
**Related:** PRD §3.3, §7.2; ADR-0005 (auto-layout); ADR-0007 (validation)

## Context

PRD §3.3 lists `group` as a node kind for "visual container/boundary (e.g. AWS account, DMZ)" and §7.2 says they "render as labelled translucent containers". The PRD doesn't say whether grouping is a real hierarchical relationship (a node *contains* other nodes) or a visual overlay (a rectangle drawn behind tagged nodes). The two choices diverge sharply: schema, renderer, drag/selection, edge routing, and auto-layout all depend on which we pick.

## Decision

**Structural parent-child via React Flow's `parentId`. Single level only in v1; no nested groups.**

- A node with `kind: "group"` is a real parent. Child nodes carry `parentId: "<group-id>"`.
- React Flow's subflow rendering and drag-with-children come for free.
- A node can have **exactly one** structural parent. Cross-cutting concerns (PCI-scope, legacy, etc.) remain `tags: string[]`.
- A group may have `childDiagramId` (drill into the boundary's internals). Legitimate use case.
- Nested groups (a group inside another group) are **rejected by structural validation** in v1.

## Consequences

**What this commits us to:**

- Schema:
  ```ts
  Node = {
    id, kind, name, position, /* ... */,
    parentId?: string;   // must point at a same-diagram kind:"group" node
  }
  ```
- Validation (per ADR-0007):
  - **Structural:** `parentId` set but the referent is not in the same diagram, not `kind: "group"`, or chain depth > 1. Error.
  - **Referential:** `parentId` points at a non-existent id → placeholder treatment.
  - **Soft:** Empty group (no children) → warning.
- ELK auto-layout (ADR-0005) builds a hierarchical graph from the `parentId` relation. ELK handles this natively.
- Editor reparent UX: drop a node onto a group node → set `parentId`. Drop outside → clear. Drop on another group when already grouped → move. Single-level guard rejects (with toast) drops that would nest groups.
- Tags are the *only* mechanism for "non-containment" categorisation. Don't add a parallel grouping mechanism.

**What it costs us:**

- Modelers can't represent AWS account → VPC → subnet hierarchy in a single diagram. They model it via drill-down (each level is its own diagram). Aligns with C4-style "one layer per diagram"; we consider this a correct constraint, not a limitation.
- Nested groups are a real authoring need in some shops. Deferred to v2 with eyes open.

## Alternatives considered

- **Tag-based "grouping".** Nodes carry `groups: string[]`; a separate `groups[]` array defines rectangles computed at render time as bounding boxes of tagged members. Lightweight but: no drag-with-children, no boundary-aware edge routing, conflates with the existing `tags` field.
- **Hybrid (structural + tag-based decorative).** Two concepts for similar UX; complexity without clear gain. Rejected.
- **Nested groups in v1.** Brings hierarchical layout subtleties (ELK handles it, the fallback grid doesn't), multi-level edge routing, validation complexity. Bounded for v1; revisited if real projects demand it.

## Implementation notes

- React Flow renders parent nodes via `extent: 'parent'` on children and special node types. See `@xyflow/react` subflow docs.
- Edge routing inside a group stays inside the group's bounds (React Flow default). Edges crossing the boundary route around the parent.
- The fallback grid layout (ADR-0005) places parent groups first, then children inside them. Doesn't attempt nested layouts (consistent with single-level constraint).
- When deleting a group, the editor offers two options: "Delete group only (preserve children)" → clears `parentId` on members; "Delete group and contents" → deletes everything. Both produce one `commit()`.
