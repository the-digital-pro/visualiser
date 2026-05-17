# ADR-0004: Draft / publish lifecycle

**Status:** Accepted (2026-05-17)
**Related:** PRD §5.4; ADR-0002 (manifest hashes); ADR-0009 (commit points)

## Context

PRD §5.4 sketches a persistence model — bundled JSON in `public/projects/`, editor drafts in localStorage, Export-to-download for publishing, FS Access API as an optional power-user path — but leaves four questions unanswered:

1. When the editor opens, does it load the draft or the bundled file?
2. Can Present mode read drafts (i.e. can consumers see unpublished work)?
3. What happens when the bundled file changes upstream but a stale draft exists?
4. In a read-only build, does localStorage still influence behaviour?

## Decision

**Strict isolation between draft and published state, with a canonical serializer enforcing byte-identical round-trip.**

| Concern | Rule |
|---|---|
| Editor open | Load draft if it exists; else fetch bundled. Indicator shows "draft, last saved {time}". |
| Present mode | **Never reads localStorage.** Always renders the bundled file. |
| Author preview | Explicit "Preview draft in Present" action inside the editor opens Present with `?preview=draft`. **Only this query param** lets Present read localStorage, and only when `VITE_EDITOR_ENABLED=true`. |
| Bundled changed under a draft | At draft creation, store the bundled file's hash from the manifest. On editor open, if hashes differ, show a non-blocking banner: **[Compare] [Keep my draft] [Discard and start fresh]**. Never auto-merge. |
| Read-only build | Editor routes don't exist (tree-shaken). localStorage is never read. Orphaned drafts are harmless. |
| Reset to published | Editor button: drops draft, re-fetches bundled, clears history. |

**The canonical serializer** (`serializeProject(project): string` in `lib/persistence.ts`) is the only producer of stored project JSON — used by draft autosave, export, and FS Access write. It enforces:

- Deterministic key order (matches the Zod schema's `parse` output order).
- 2-space indentation.
- Single trailing newline.

This is what makes "byte-identical round-trip" (Phase 2 Done criterion) achievable.

## Consequences

**What this commits us to:**

- Present mode is deterministic and consumer-safe: no path by which a stakeholder sees unpublished work by accident.
- Every editor write goes through the same serializer. No ad-hoc `JSON.stringify` in the codebase.
- Manifest must carry per-project content hashes (already required by ADR-0002).
- Drafts are migrated by the schema-version ladder on editor open, same as bundled files (ADR-0007).
- `commit()` (ADR-0009) is the single trigger for both undo history and localStorage autosave.

**What it costs us:**

- "Preview draft" is a deliberate editor-only escape hatch that has to be tested and documented. Worth it for the SA's preview workflow.
- The hash-conflict banner adds a step before opening a stale draft. Correct behaviour — auto-merging architecture diagrams would be a nightmare.

## Alternatives considered

- **Present reads localStorage if a draft exists.** Eliminates the `?preview=draft` hop but means consumers can see unpublished work by accident — unacceptable.
- **Auto-merge on conflict.** A non-starter for graph-shaped JSON; even three-way merges of UML files are notoriously bad.
- **Drafts in IndexedDB instead of localStorage.** Larger storage, async API. Not needed at v1 sizes; localStorage is sufficient and synchronous.
- **No draft hash — overwrite warning instead.** Too easy to lose work when the bundled file advances. The hash makes the decision explicit and recoverable.

## Implementation notes

- LocalStorage key: `arcviz:draft:<projectId>`.
- Draft envelope:
  ```ts
  type Draft = {
    schemaVersion: number;
    sourceHash: string;          // hash of bundled at fork time
    savedAt: string;             // ISO timestamp
    project: Project;            // canonical-serialized form
  };
  ```
- FS Access API integration (Phase 3) replaces the "download" step in Export with `await fileHandle.createWritable()` + `serializeProject(project)`. Same lifecycle rules apply.
- The `?preview=draft` route handler reads localStorage and forwards to the existing Present render path — no separate code path inside the canvas.
