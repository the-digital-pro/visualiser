# ADR-0002: Project loading strategy

**Status:** Accepted (2026-05-17)
**Related:** PRD §5.2, §8; ADR-0001 (edge ownership); ADR-0004 (draft hashing)

## Context

ADR-0001 commits us to deriving inbound edges from whichever projects are loaded. The PRD targets:

- <2s cold load on a typical corporate laptop
- 50+ bundled projects
- <500 KB gzipped consumer (Present-only) bundle
- Cross-project Cmd+K search

Eagerly loading every project blows the cold-load target (mostly via main-thread Zod validation cost at 50× projects). Pure lazy loading breaks Cmd+K and reverse-edges. We need a middle path.

## Decision

**Hybrid: eager manifest + lazy per-project bodies + build-time search index.**

1. **Boot fetches only `manifest.json`.** Lists projects with `{ id, file, name, summary, owners, tags, hash }`. Renders the home screen immediately.
2. **Per-project JSON is fetched on first navigation into that project.** Cached in memory for the session.
3. **Cross-project follow** (clicking an edge with `targetRef`) triggers a fetch of the target project if not cached, then navigates.
4. **A `public/projects/search-index.json` is emitted at build time** by a Vite plugin. Contains `{ projectId, diagramId, nodeId, name, kind, tags, description: first200 }` for every node across all projects. Fetched on first `Cmd+K` (or idle-prefetched after first user interaction). Edges are **not** indexed.
5. **Inbound-edge rendering** uses whichever projects happen to be loaded; when the other side isn't loaded, render a "↗ leaves this project" placeholder edge.

## Consequences

**What this commits us to:**

- A Vite plugin (`plugins/projects-plugin.ts`) is part of the build, not optional. It runs Zod against every project at build time (gates the build on structural errors — ADR-0007) and emits the index + manifest hashes.
- The manifest is a **build artifact**, not a hand-edited file at runtime. Authors add a project by dropping the JSON in `public/projects/` and rebuilding; the plugin updates the manifest entry.
- Cmd+K search latency depends on a one-time `search-index.json` fetch (~200KB for 50 projects × 200 nodes), not on loading full projects.
- Cross-project follow has a one-time fetch latency on first traversal to a not-yet-loaded project. Acceptable; mitigable later via hover-prefetch.

**What it costs us:**

- The search index is denormalised — when a project is edited in the editor, the *bundled* search index is stale until rebuild. The editor's in-memory project index supplements it during an authoring session.
- Reverse-edges are an "if loaded" feature. Documented; will surprise no one once they've used it for a minute.

## Alternatives considered

- **Eager all-projects on boot.** Simple, search and reverse-edges always work. Fails the cold-load target at 50 projects (Zod main-thread cost ≈ tens of ms × 50).
- **Pure lazy.** Cheapest cold load. Breaks Cmd+K cross-project search until you've visited everything. Reverse-edges almost never render. Worst UX.
- **Eager-but-streaming.** Kick off all fetches in parallel; fill features as they arrive. Plausible runner-up, but adds complexity (race conditions, partial-state UI) for benefits the hybrid already captures.

## Implementation notes

- Build plugin pseudo-shape:
  ```ts
  // plugins/projects-plugin.ts
  export function projectsPlugin(): Plugin {
    return {
      name: 'arcviz-projects',
      buildStart() {
        const files = glob('public/projects/*.json');
        for (const f of files) {
          const project = ProjectSchema.parse(JSON.parse(read(f))); // fails build on error
          // accumulate search-index rows + hash
        }
        write('public/projects/search-index.json', index);
        write('public/projects/manifest.json', manifest);
      }
    };
  }
  ```
- Manifest entry shape: `{ id, file, name, summary, owners, tags, hash, schemaVersion }`. `hash` is `sha256(canonicalSerialize(project)).slice(0, 16)`.
- Aggressive idle-prefetch of all manifest projects is a **Phase 4** option, not v1.
