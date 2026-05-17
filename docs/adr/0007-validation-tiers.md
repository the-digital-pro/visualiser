# ADR-0007: Validation severity tiers

**Status:** Accepted (2026-05-17)
**Related:** PRD §4.2, §7.3; ADR-0001 (cross-project refs); ADR-0005 (positions)

## Context

The PRD conflates three different kinds of "validation":

1. Zod schema validation at load (§7.3) — "friendly error card with the offending path"
2. Cross-project ref resolution (§7.3) — "placeholder 'missing target' node with a warning chip"
3. Editor validation panel (§4.2) — orphan nodes, dangling refs, missing required metadata

These have different correct behaviours. Without naming and tiering them up front, behaviour drifts: a missing `owner` could crash Present mode in front of a stakeholder, or a structural type error could be silently rendered as a placeholder. Both are wrong.

## Decision

**Three explicit tiers, with documented runtime and editor behaviours:**

| Tier | What it catches | Present behaviour | Editor behaviour |
|---|---|---|---|
| **Structural** | Zod schema fails — wrong types, missing required fields, malformed JSON, invalid `schemaVersion` | That **one** project shows a friendly error card with `issue.path`; home and other projects unaffected | Same; "Reset to published" available |
| **Referential** | `childDiagramId` or `targetRef` resolves to nothing; `parentId` points at non-existent node | Render a placeholder node with a "↗ missing target" chip; rest of diagram renders normally | Validation panel flags it; **never blocks save or export** |
| **Soft** | Orphan nodes, missing optional metadata, critical edge without an owner, nodes without positions | Silent | Validation panel flags it; **never blocks save or export** |

**Three principles holding this together:**

1. **Per-project failure isolation.** One bad JSON never kills the app shell. The manifest-driven home screen renders fine; clicking the bad project drops you on its error card.
2. **Tolerant runtime, strict editor.** Present should never crash in front of a consumer over hygiene. The editor surfaces issues but never blocks the user from saving — publishing (Export) is the human gate.
3. **Saves are never gated by validation.** Authors save mid-thought. Reviewers (humans) catch issues at PR time, with the validation panel summarising what's still open.

**Companion: schema version ladder.**

- `schemaVersion` is required at the top of every project file. Missing → structural error.
- `version > KNOWN_VERSION` → structural error: "Authored in a newer version; update the app."
- `version < KNOWN_VERSION` → run migrations from `lib/migrations/` ladder. Pure `(v_n) => v_n+1` functions. A failure inside a migration is a structural error for that project.
- Migrations apply to localStorage drafts on editor open, same as bundled files.
- The ladder is append-only.

## Consequences

**What this commits us to:**

- `lib/schema.ts` exposes **two** Zod schemas: `ProjectInput` (lenient on-disk shape) and `Project` (validated, in-store shape). The loader is the only place that crosses the boundary.
- The store only ever holds `Project`.
- A new validation rule must be assigned to a tier *before* it lands. PR description must name the tier.
- The build-time plugin (ADR-0002) runs structural validation. Builds fail on structural errors; this is intentional — bad JSON never reaches consumers.
- Referential errors at runtime resolve as projects load (ADR-0001's inbound-edge derivation handles this transparently).

**What it costs us:**

- We accept that some "soft" issues never get fixed if authors don't open the validation panel. That's acceptable; they're advisory by definition.

## Alternatives considered

- **Strict-everywhere (block save / export on any issue).** Would prevent shipping any project with a single missing `owner`. Hostile to authors.
- **Lenient-everywhere (no tiers; everything is a console.warn).** Makes the editor's validation panel meaningless.
- **Two tiers (fatal / non-fatal).** Conflates referential and soft. Loses the meaningful UX distinction between "render a placeholder" and "show in editor only".

## Implementation notes

- Loader pseudo-shape:
  ```ts
  export function loadProject(raw: unknown): LoadResult {
    const parsed = ProjectInputSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, structural: parsed.error };
    const migrated = runMigrations(parsed.data);
    const validated = ProjectSchema.parse(migrated); // throws → structural
    return { ok: true, project: validated };
  }
  ```
- Referential validation runs as a Zustand selector against the loaded-projects map; recomputed when projects load/unload.
- The validation panel groups issues by tier (Referential first, then Soft).
- Zod's `issue.path` is the friendly path shown in error cards — `diagrams[1].nodes[3].kind: expected "datastore" got "datastor"`.
