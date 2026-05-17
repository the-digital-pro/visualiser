import type { Project } from "./schema";

/**
 * Scaffolds a minimal valid Project: one empty diagram named "System context"
 * with id "context". The user fills it in via the editor; export at any time.
 *
 * INVARIANT (ADR-0007): the returned shape MUST pass `ProjectSchema`. The
 * NewProjectDialog re-validates after construction so a broken scaffold can
 * never reach the store.
 */
export function newProjectScaffold(id: string, name: string): Project {
  return {
    schemaVersion: 1,
    id,
    name,
    homeDiagramId: "context",
    diagrams: [
      {
        id: "context",
        name: "System context",
        nodes: [],
        edges: [],
      },
    ],
  };
}

/**
 * Lossy slugifier — produces a string suitable for a `Project.id`. Matches
 * the schema regex `^[a-z0-9][a-z0-9-]*$`. Falls back to "untitled" for input
 * that produces an empty slug.
 */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled";
}
