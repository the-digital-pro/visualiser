import type { Diagram, Project } from "./schema";
import { editor } from "./editor";
import { useStore } from "./store";

/**
 * Auto-layout (ADR-0005).
 *
 * elkjs is dynamically imported the moment the user invokes Auto-arrange. The
 * Present-only build (`VITE_EDITOR_ENABLED=false`) never reaches this module
 * because the EditorTopBar that calls it is itself tree-shaken.
 *
 * Group hierarchy is honoured: children with `parentId` become nested ELK
 * children of the parent group.
 */

type ElkNode = {
  id: string;
  width?: number;
  height?: number;
  children?: ElkNode[];
  layoutOptions?: Record<string, string>;
};

type ElkEdge = {
  id: string;
  sources: string[];
  targets: string[];
};

type LayoutedNode = ElkNode & {
  x: number;
  y: number;
  children?: LayoutedNode[];
};

function buildElkGraph(diagram: Diagram): ElkNode {
  const childrenByParent = new Map<string, ElkNode[]>();
  const top: ElkNode[] = [];

  for (const n of diagram.nodes) {
    const elkNode: ElkNode = {
      id: n.id,
      width: n.kind === "group" ? 240 : 180,
      height: n.kind === "group" ? 160 : 80,
    };
    if (n.parentId) {
      const bucket = childrenByParent.get(n.parentId) ?? [];
      bucket.push(elkNode);
      childrenByParent.set(n.parentId, bucket);
    } else {
      top.push(elkNode);
    }
  }
  for (const parent of top) {
    const c = childrenByParent.get(parent.id);
    if (c && c.length > 0) {
      parent.children = c;
    }
  }

  const edges: ElkEdge[] = diagram.edges
    .filter((e) => e.target)
    .map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target!],
    }));

  return {
    id: "root",
    children: top,
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.layered.spacing.nodeNodeBetweenLayers": "80",
      "elk.spacing.nodeNode": "60",
      "elk.padding": "[top=40,left=24,bottom=24,right=24]",
    },
    // edges go at root level — ELK resolves them across the hierarchy.
    ...({ edges } as Record<string, unknown>),
  };
}

function applyLayout(
  project: Project,
  diagramId: string,
  laid: LayoutedNode,
): Project {
  const positions = new Map<string, { x: number; y: number }>();
  function walk(node: LayoutedNode, offsetX: number, offsetY: number) {
    if (typeof node.x === "number" && typeof node.y === "number") {
      // ELK gives positions relative to the parent. We need absolute coords
      // because our schema is flat in coordinate space; React Flow then offsets
      // children visually inside their group via parentId/extent.
      // For nodes at the top level, no offset. For children of a group, offset
      // by the group's own ELK position so they end up RELATIVE to the group
      // (React Flow expects child positions relative to parent).
      positions.set(node.id, { x: node.x, y: node.y });
    }
    for (const child of node.children ?? []) {
      walk(child, (offsetX ?? 0) + (node.x ?? 0), (offsetY ?? 0) + (node.y ?? 0));
    }
  }
  for (const root of laid.children ?? []) {
    walk(root, 0, 0);
  }

  return {
    ...project,
    diagrams: project.diagrams.map((d) =>
      d.id !== diagramId
        ? d
        : {
            ...d,
            nodes: d.nodes.map((n) => {
              const p = positions.get(n.id);
              return p ? { ...n, position: { x: Math.round(p.x), y: Math.round(p.y) } } : n;
            }),
          },
    ),
  };
}

export async function runAutoLayout(
  projectId: string,
  diagramId: string,
): Promise<void> {
  const project = useStore.getState().projects[projectId];
  if (!project) return;
  const diagram = project.diagrams.find((d) => d.id === diagramId);
  if (!diagram || diagram.nodes.length === 0) return;

  const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
  const elk = new ELK();
  const graph = buildElkGraph(diagram);
  const laid = (await elk.layout(graph)) as LayoutedNode;
  editor.commit(projectId, (p) => applyLayout(p, diagramId, laid));
}
