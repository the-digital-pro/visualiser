# ADR-0005: Auto-layout location

**Status:** Accepted (2026-05-17)
**Related:** PRD §5.3, §6.1, §8; ADR-0007 (validation)

## Context

PRD §5.3 says positions are optional and auto-layout runs on load when missing. PRD §6.1 picks elkjs (primary) + dagre (fallback). PRD §8 caps the Present-only bundle at <500 KB gzipped. elkjs alone is ~500 KB+ gzipped — it cannot ship in the consumer bundle. Beyond bundle size, layout-on-load is non-deterministic: two consumers can see subtly different arrangements of the same diagram depending on viewport, library version, and input ordering. Architecture diagrams are documentation; reproducibility matters.

## Decision

**Positions are canonical at runtime. Auto-layout is editor-only and dynamically imported.**

- `position` is treated as **effectively required** by Present mode. Schema still allows it to be missing, but the runtime treats absence as a degraded state.
- The editor's `Layout → Auto-arrange` action does `await import('elkjs/lib/elk.bundled.js')` — elkjs ships only in the editor bundle, only after user action.
- ELK results are written into the project's `position` fields and persist via the next `commit()`.
- If a Present-mode load encounters nodes without positions, render with a cheap built-in grid (~50 LOC, no library dependency) and emit a soft validation warning ("X nodes lack positions — open in editor and run Auto-arrange").

## Consequences

**What this commits us to:**

- The Present-only build (`VITE_EDITOR_ENABLED=false`) ships **zero layout engines**. Verify via build chunk inspection in CI.
- Hand-authored JSON files without positions get a grid layout — usable, but ugly. The supported authoring path is "open in editor, run Auto-arrange, export".
- Positions are version-controlled, reviewable in PRs, and reproducible across consumers.
- ELK's hierarchical layout handles group nesting natively (relevant once ADR-0008 lands).

**What it costs us:**

- A developer hand-writing JSON loses the "automatic pretty rendering" the PRD originally promised. They get a grid and a warning. We consider this a fair trade for determinism + bundle budget.
- The fallback grid is real code that needs tests (predictable arrangement, no overlaps, deterministic).

## Alternatives considered

- **PRD-as-written: elkjs runs at load when positions missing.** Blows the bundle budget. Non-deterministic across consumers.
- **Dagre-only at runtime, elkjs editor-only.** Dagre is ~25 KB gzipped, fits the budget. But ships dependency cost to every consumer for a rarely-used code path, and dagre layouts are visibly worse than ELK's.
- **Auto-layout at build time.** Vite plugin computes positions and bakes them into served JSON. Clever but mutates source data in surprising ways (or splits truth across `*.json` and `*.layout.json`). Hidden state; rejected.

## Implementation notes

- Dynamic import boundary lives in `lib/layout.ts`:
  ```ts
  export async function autoArrange(diagram: Diagram): Promise<Diagram> {
    const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
    const elk = new ELK();
    // ... build ELK graph with parentId nesting, run layout, map positions back
  }
  ```
- Editor menu wiring: `Layout → Auto-arrange` shows a spinner, awaits `autoArrange`, calls `applyLayout(result)`, `commit()`.
- The fallback grid (`lib/grid.ts`) is deterministic: nodes ordered by id, laid out in a grid with fixed cell size, parent groups arranged before children.
- Validation rule (ADR-0007 tier 3 — soft): "diagram has nodes without positions". Surfaces in the editor's validation panel; suppressed in Present.
