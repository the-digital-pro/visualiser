import {
  ProjectInputSchema,
  ProjectSchema,
  type Project,
  type ProjectInput,
} from "./schema";
import { migrate } from "./migrations";

/**
 * Three-tier validation (ADR-0007).
 *
 *   Tier 1 — Structural: Zod schema fail. The whole load fails; caller renders
 *           a friendly error card for THIS project. Other projects unaffected.
 *   Tier 2 — Referential: dangling `target`, `parentId`, or `childDiagramId`.
 *           Project still loads; offending refs are reported so renderer can
 *           show placeholders. Soft load — never blocks.
 *   Tier 3 — Soft: orphan nodes, missing optional metadata, missing positions.
 *           Reported so editor's validation panel can surface them.
 *           Silent in Present mode.
 *
 * Cross-project `targetRef`s are NOT checked here — they're validated at the
 * NavigationController boundary when the user follows them (ADR-0001).
 */

export interface ValidationIssue {
  tier: "structural" | "referential" | "soft";
  path: string;
  message: string;
}

export type LoadResult =
  | { ok: true; project: Project; issues: ValidationIssue[] }
  | { ok: false; issues: ValidationIssue[] };

const FALLBACK_GRID_SPACING = 200;

function fillFallbackPositions(input: ProjectInput): ProjectInput {
  return {
    ...input,
    diagrams: input.diagrams.map((diagram) => {
      let i = 0;
      return {
        ...diagram,
        nodes: diagram.nodes.map((node) => {
          if (node.position) return node;
          // Tiny grid: 6 per row, 200px apart.
          const col = i % 6;
          const row = Math.floor(i / 6);
          i += 1;
          return {
            ...node,
            position: {
              x: col * FALLBACK_GRID_SPACING,
              y: row * FALLBACK_GRID_SPACING,
            },
          };
        }),
      };
    }),
  };
}

function checkReferentialAndSoft(project: ProjectInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const diagramsById = new Map(project.diagrams.map((d) => [d.id, d]));

  for (const diagram of project.diagrams) {
    const nodesById = new Map(diagram.nodes.map((n) => [n.id, n]));
    const referencedNodeIds = new Set<string>();

    for (const node of diagram.nodes) {
      if (node.parentId && !nodesById.has(node.parentId)) {
        issues.push({
          tier: "referential",
          path: `diagrams.${diagram.id}.nodes.${node.id}.parentId`,
          message: `parentId "${node.parentId}" does not exist in this diagram`,
        });
      }
      if (node.parentId) {
        const parent = nodesById.get(node.parentId);
        if (parent && parent.kind !== "group") {
          issues.push({
            tier: "referential",
            path: `diagrams.${diagram.id}.nodes.${node.id}.parentId`,
            message: `parentId "${node.parentId}" is not a group node (ADR-0008)`,
          });
        }
        if (parent && parent.parentId) {
          issues.push({
            tier: "referential",
            path: `diagrams.${diagram.id}.nodes.${node.id}.parentId`,
            message: `nested groups are not supported in v1 (ADR-0008)`,
          });
        }
      }
      if (node.childDiagramId && !diagramsById.has(node.childDiagramId)) {
        issues.push({
          tier: "referential",
          path: `diagrams.${diagram.id}.nodes.${node.id}.childDiagramId`,
          message: `childDiagramId "${node.childDiagramId}" does not exist in this project`,
        });
      }
      if (!node.position) {
        issues.push({
          tier: "soft",
          path: `diagrams.${diagram.id}.nodes.${node.id}.position`,
          message: "missing position; falling back to grid",
        });
      }
    }

    for (const edge of diagram.edges) {
      if (!nodesById.has(edge.source)) {
        issues.push({
          tier: "referential",
          path: `diagrams.${diagram.id}.edges.${edge.id}.source`,
          message: `source "${edge.source}" does not exist in this diagram`,
        });
      } else {
        referencedNodeIds.add(edge.source);
      }
      if (edge.target) {
        if (!nodesById.has(edge.target)) {
          issues.push({
            tier: "referential",
            path: `diagrams.${diagram.id}.edges.${edge.id}.target`,
            message: `target "${edge.target}" does not exist in this diagram`,
          });
        } else {
          referencedNodeIds.add(edge.target);
        }
      }
      // targetRef cross-project resolution is intentionally deferred.
    }

    for (const node of diagram.nodes) {
      if (node.kind === "group") continue;
      if (
        !referencedNodeIds.has(node.id) &&
        !diagram.nodes.some((n) => n.parentId === node.id)
      ) {
        issues.push({
          tier: "soft",
          path: `diagrams.${diagram.id}.nodes.${node.id}`,
          message: "orphan node (no incident edges, not a group, no children)",
        });
      }
    }
  }

  if (!project.diagrams.some((d) => d.id === project.homeDiagramId)) {
    issues.push({
      tier: "referential",
      path: "homeDiagramId",
      message: `homeDiagramId "${project.homeDiagramId}" does not exist in this project`,
    });
  }

  return issues;
}

export function loadProject(raw: unknown): LoadResult {
  let migrated: unknown;
  try {
    migrated = migrate(raw);
  } catch (err) {
    return {
      ok: false,
      issues: [
        {
          tier: "structural",
          path: "schemaVersion",
          message: (err as Error).message,
        },
      ],
    };
  }

  const parsed = ProjectInputSchema.safeParse(migrated);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        tier: "structural",
        path: i.path.join(".") || "<root>",
        message: i.message,
      })),
    };
  }

  const issues = checkReferentialAndSoft(parsed.data);
  const filled = fillFallbackPositions(parsed.data);

  const validated = ProjectSchema.safeParse(filled);
  if (!validated.success) {
    // Should never happen — fillFallbackPositions guarantees positions are set.
    return {
      ok: false,
      issues: validated.error.issues.map((i) => ({
        tier: "structural",
        path: i.path.join(".") || "<root>",
        message: i.message,
      })),
    };
  }

  return { ok: true, project: validated.data, issues };
}

export async function fetchProject(projectId: string, baseUrl = ""): Promise<LoadResult> {
  const url = `${baseUrl}/projects/${encodeURIComponent(projectId)}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    return {
      ok: false,
      issues: [
        {
          tier: "structural",
          path: "<network>",
          message: `failed to load ${url}: HTTP ${res.status}`,
        },
      ],
    };
  }
  const raw = await res.json();
  return loadProject(raw);
}
