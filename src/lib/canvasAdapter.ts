import type { Edge as RFEdge, Node as RFNode } from "@xyflow/react";
import type { Project } from "./schema";
import { isEmpty, nodeMatches, type ParsedFilter } from "./filter";

/**
 * Translates our domain shape (Project / Diagram / Node / Edge) into the
 * React Flow shape, including:
 *
 *   - Group hierarchy via `parentId` + `extent: "parent"` (ADR-0008).
 *   - Synthetic "external" nodes for cross-project edges, so React Flow has
 *     something to draw to/from. The synthetic nodes carry the target
 *     `targetRef` so the drawer can offer a Follow action.
 *   - Reverse-edges (ADR-0001) derived from other loaded projects whose
 *     source-side edges point INTO this diagram.
 */

export interface CanvasNodeData extends Record<string, unknown> {
  name: string;
  description?: string;
  kind: string;
  tags?: string[];
  hasChildDiagram: boolean;
  pulsing: boolean;
  invalid: boolean;
  faded: boolean;
}

export interface CanvasEdgeData extends Record<string, unknown> {
  edgeType: string;
  label?: string;
  reverse: boolean;
  crossProject: boolean;
  targetRef?: string;
  faded: boolean;
}

export interface ExternalRefInfo {
  projectId: string;
  diagramId: string;
  nodeId: string;
  resolvedName?: string;
}

interface BuildArgs {
  project: Project;
  diagramId: string;
  loadedProjects: Record<string, Project>;
  pulseNodeId?: string | null;
  unresolvedRefs?: Set<string>;
  filter?: ParsedFilter;
}

const EXT_PREFIX = "__ext__";

export function externalSyntheticId(ref: string): string {
  return `${EXT_PREFIX}${ref}`;
}

export function parseExternalId(id: string): ExternalRefInfo | null {
  if (!id.startsWith(EXT_PREFIX)) return null;
  const ref = id.slice(EXT_PREFIX.length);
  const parts = ref.split(":");
  if (parts.length !== 3) return null;
  return { projectId: parts[0], diagramId: parts[1], nodeId: parts[2] };
}

function resolveRefName(
  ref: string,
  loaded: Record<string, Project>,
): string | undefined {
  const [pid, did, nid] = ref.split(":");
  const project = loaded[pid];
  if (!project) return undefined;
  const diagram = project.diagrams.find((d) => d.id === did);
  if (!diagram) return undefined;
  const node = diagram.nodes.find((n) => n.id === nid);
  return node?.name;
}

export function buildCanvasGraph({
  project,
  diagramId,
  loadedProjects,
  pulseNodeId,
  unresolvedRefs = new Set(),
  filter,
}: BuildArgs): { nodes: RFNode[]; edges: RFEdge[] } {
  const diagram = project.diagrams.find((d) => d.id === diagramId);
  if (!diagram) return { nodes: [], edges: [] };

  const filterActive = filter && !isEmpty(filter);
  const matchingNodeIds = new Set<string>();
  if (filterActive) {
    for (const n of diagram.nodes) {
      if (nodeMatches(filter, n)) matchingNodeIds.add(n.id);
    }
  }

  const realNodes: RFNode[] = diagram.nodes.map((n) => ({
    id: n.id,
    type: n.kind,
    position: n.position,
    data: {
      name: n.name,
      description: n.description,
      kind: n.kind,
      tags: n.tags,
      hasChildDiagram: Boolean(n.childDiagramId),
      pulsing: n.id === pulseNodeId,
      invalid: false,
      faded: filterActive ? !matchingNodeIds.has(n.id) : false,
    } satisfies CanvasNodeData,
    ...(n.parentId && { parentId: n.parentId, extent: "parent" as const }),
    ...(n.kind === "group" && { style: { width: 240, height: 160 } }),
  }));

  // Synthetic placeholders for OUTBOUND cross-project edges. One per unique ref.
  const outboundRefs = new Set<string>();
  for (const e of diagram.edges) {
    if (e.targetRef) outboundRefs.add(e.targetRef);
  }

  // Synthetic placeholders for INBOUND reverse-edges from OTHER loaded projects.
  const inboundSources: {
    sourceProjectId: string;
    sourceDiagramId: string;
    sourceNodeId: string;
    targetNodeId: string;
    edgeId: string;
    edgeType: string;
    label?: string;
  }[] = [];
  for (const [otherPid, otherProject] of Object.entries(loadedProjects)) {
    if (otherPid === project.id) continue;
    for (const otherDiagram of otherProject.diagrams) {
      for (const e of otherDiagram.edges) {
        if (!e.targetRef) continue;
        const [tp, td, tn] = e.targetRef.split(":");
        if (tp === project.id && td === diagramId) {
          inboundSources.push({
            sourceProjectId: otherPid,
            sourceDiagramId: otherDiagram.id,
            sourceNodeId: e.source,
            targetNodeId: tn,
            edgeId: `${otherPid}-${otherDiagram.id}-${e.id}`,
            edgeType: e.type,
            label: e.label,
          });
        }
      }
    }
  }

  // Lay out synthetic externals: outbound to the right of canvas, inbound to the left.
  const bounds = realNodes.reduce(
    (acc, n) => ({
      minX: Math.min(acc.minX, n.position.x),
      maxX: Math.max(acc.maxX, n.position.x),
      minY: Math.min(acc.minY, n.position.y),
      maxY: Math.max(acc.maxY, n.position.y),
    }),
    { minX: 0, maxX: 0, minY: 0, maxY: 0 },
  );

  const outboundList = Array.from(outboundRefs);
  const externalNodes: RFNode[] = outboundList.map((ref, i) => ({
    id: externalSyntheticId(ref),
    type: "system",
    position: {
      x: bounds.maxX + 360,
      y: bounds.minY + i * 110,
    },
    data: {
      name: resolveRefName(ref, loadedProjects) ?? ref.split(":")[2],
      description: `External — ${ref}`,
      kind: "system",
      tags: [`↗ ${ref.split(":")[0]}`],
      hasChildDiagram: false,
      pulsing: false,
      invalid: unresolvedRefs.has(ref),
      faded: false,
    } satisfies CanvasNodeData,
    draggable: false,
  }));

  const inboundNodes: RFNode[] = inboundSources.map((src, i) => ({
    id: `${EXT_PREFIX}in:${src.edgeId}`,
    type: "system",
    position: {
      x: bounds.minX - 360,
      y: bounds.minY + i * 110,
    },
    data: {
      name:
        resolveRefName(
          `${src.sourceProjectId}:${src.sourceDiagramId}:${src.sourceNodeId}`,
          loadedProjects,
        ) ?? src.sourceNodeId,
      description: `Inbound from ${src.sourceProjectId}`,
      kind: "system",
      tags: [`↗ ${src.sourceProjectId}`],
      hasChildDiagram: false,
      pulsing: false,
      invalid: false,
      faded: false,
    } satisfies CanvasNodeData,
    draggable: false,
  }));

  const edgeFaded = (sourceId: string, targetId: string | undefined): boolean => {
    if (!filterActive) return false;
    // An edge fades unless BOTH its endpoints survive the filter.
    const sourceVisible = matchingNodeIds.has(sourceId);
    const targetVisible =
      targetId === undefined || matchingNodeIds.has(targetId);
    return !(sourceVisible && targetVisible);
  };

  // Real intra-diagram edges
  const realEdges: RFEdge[] = diagram.edges
    .filter((e) => e.target)
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target!,
      type: "arcviz",
      data: {
        edgeType: e.type,
        label: e.label,
        reverse: false,
        crossProject: false,
        faded: edgeFaded(e.source, e.target),
      } satisfies CanvasEdgeData,
    }));

  // Outbound cross-project edges → synthetic external
  const outboundEdges: RFEdge[] = diagram.edges
    .filter((e) => e.targetRef)
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: externalSyntheticId(e.targetRef!),
      type: "arcviz",
      data: {
        edgeType: e.type,
        label: e.label,
        reverse: false,
        crossProject: true,
        targetRef: e.targetRef,
        faded: edgeFaded(e.source, undefined),
      } satisfies CanvasEdgeData,
    }));

  // Reverse-edges from synthetic inbound → real target node
  const reverseEdges: RFEdge[] = inboundSources.map((src) => ({
    id: `rev-${src.edgeId}`,
    source: `${EXT_PREFIX}in:${src.edgeId}`,
    target: src.targetNodeId,
    type: "arcviz",
    data: {
      edgeType: src.edgeType,
      label: src.label,
      reverse: true,
      crossProject: true,
      targetRef: `${src.sourceProjectId}:${src.sourceDiagramId}:${src.sourceNodeId}`,
      faded: edgeFaded(src.targetNodeId, undefined),
    } satisfies CanvasEdgeData,
  }));

  return {
    nodes: [...realNodes, ...externalNodes, ...inboundNodes],
    edges: [...realEdges, ...outboundEdges, ...reverseEdges],
  };
}
