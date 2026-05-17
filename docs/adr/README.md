# Architecture Decision Records

Each ADR captures one consequential decision: the context, the choice, the alternatives we considered, and what the choice commits us to. They are **append-only**. To change a decision, write a new ADR that **supersedes** the old one (don't edit history).

Entries below are listed in the order they were decided. The dependency direction generally flows top-to-bottom — earlier ADRs constrain later ones.

| # | Title | Status | Headline decision |
|---|---|---|---|
| [0001](0001-cross-project-edge-ownership.md) | Cross-project edge ownership | Accepted | Source-only ownership; reverse-edges derived at runtime |
| [0002](0002-project-loading-strategy.md) | Project loading strategy | Accepted | Hybrid: eager manifest + lazy per-project + build-time search index |
| [0003](0003-navigation-state-ownership.md) | Navigation state ownership | Accepted | URL = current frame; semantic stack in `history.state` |
| [0004](0004-draft-publish-lifecycle.md) | Draft / publish lifecycle | Accepted | Strict isolation; canonical serializer; hash-based conflict detection |
| [0005](0005-auto-layout-location.md) | Auto-layout location | Accepted | Editor-only; elkjs dynamically imported; positions canonical at runtime |
| [0006](0006-canvas-lifecycle.md) | Canvas lifecycle | Accepted | Single persistent React Flow instance; per-diagram viewport cache |
| [0007](0007-validation-tiers.md) | Validation severity tiers | Accepted | Structural / referential / soft; tolerant runtime; migration ladder |
| [0008](0008-group-boundary-semantics.md) | Group/boundary semantics | Accepted | Single-level structural via `parentId`; nested groups deferred |
| [0009](0009-undo-redo-design.md) | Undo/redo design | Accepted | Snapshot-based with explicit commit points |
| [0010](0010-ux-defaults.md) | UX defaults | Accepted | Bundle of locked UX calls (drawer, pulse, search, etc.) |

## Conventions

- Numbered four digits, zero-padded.
- Filename slug matches the title.
- Frontmatter-free; status and date go in the body.
- Status values: `Proposed`, `Accepted`, `Superseded by ADR-XXXX`, `Deprecated`.
- Cross-reference other ADRs as `ADR-XXXX`.
