# ADR-0009: Undo/redo design

**Status:** Accepted (2026-05-17)
**Related:** PRD §4.2; ADR-0004 (draft autosave); ADR-0006 (canvas)

## Context

Undo granularity is one of the most user-visible quality bars in an editor. Choose wrong and users hammer Cmd+Z 50 times to undo "move and rename a node", or find that auto-commits at the wrong moment fragment a single action into multiple undo steps. The choice also shapes the store: per-mutation history middleware vs. explicit command pattern vs. snapshots all have different ergonomics for the rest of the codebase.

## Decision

**Snapshot-based undo with explicit commit points.**

- Store maintains `history: { past: Project[]; future: Project[] }`.
- Editor mutations are free-form (Immer drafts or direct Zustand sets). Mid-flight state is **not** committed.
- A separate `commit()` call snapshots the project (`structuredClone(project)`) at user-meaningful boundaries.
- Undo: pop from `past`, push current onto `future`, restore the popped snapshot.
- Redo: mirror.
- 50-entry cap; oldest dropped on overflow.

**Enumerated commit points** (shared by autosave per ADR-0004):

- Drag end (node, group, edge handle)
- Properties panel input **blur** or **Enter** (plus a 2s idle auto-blur for unfocused fields)
- Palette drop (new node)
- Edge `onConnect`
- Delete (key, button, context menu)
- Auto-arrange completion (one entry per run)
- Paste
- Reparent drop (drop on group / drop off group)
- Import — **resets history** entirely; imported state becomes the new baseline

**Out of scope for undo** (deliberately): viewport (zoom/pan), selection, breadcrumb. These are *view state*, not *data*. Industry convention (Figma, Linear, Notion).

## Consequences

**What this commits us to:**

- One `commit()` = one undo entry = one localStorage write. Drag-end-only autosave means dragging a node continuously produces exactly one write, not 60 (ADR-0004 benefits from this).
- Every editor feature PR must identify where it calls `commit()`. Adding a feature without a commit point is a bug — the action becomes un-undoable.
- The store has a single `commit()` method that future-Claude calls deliberately. No magic mutation tracking.
- Memory: ~50 snapshots × hundreds of KB each = ~10–20 MB peak for a large project. Acceptable for an authoring tool. Swappable to immer-patch diff storage later if it bites.

**What it costs us:**

- A long edit session with no blurs collapses into a coarse undo. Mitigated by the 2s idle auto-blur on the properties panel.
- Authors must learn that selection/viewport aren't undoable. Industry standard; not a real cost.

## Alternatives considered

- **Per-mutation (Immer + zundo / Zustand history middleware).** Mechanically trivial. Wrong UX granularity — one drag becomes 60 undo entries; typing a description becomes one per keystroke.
- **Explicit command pattern.** Every action authored as a `Command` with `do()` / `undo()`. Predictable UX but high authoring overhead — every feature ships its inverse. Overkill for v1.
- **Immer patches.** Smaller per-entry memory than snapshots. We can adopt this transparently later if memory becomes a problem; the commit-point contract is the same.

## Implementation notes

- Store shape:
  ```ts
  type EditorSlice = {
    project: Project;
    history: { past: Project[]; future: Project[] };
    commit: () => void;
    undo: () => void;
    redo: () => void;
    // mutation actions: setNode, addEdge, etc.
  };
  ```
- `commit()` clears `future` (a new action invalidates redo history).
- Keyboard wiring via `react-hotkeys-hook`: `mod+z` → `undo`; `mod+shift+z` → `redo`.
- Snapshot equality: don't push a no-op (`structuredEqual(past[top], project)` short-circuit). Cheap insurance against double-commits.
- Properties panel: each field calls `commit()` on `blur` or `Enter`. A 2s idle timer triggers a "synthetic blur" for fields that have been edited but not blurred.
