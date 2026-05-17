import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge as RFEdge,
  type Node as RFNode,
  type NodeChange,
  type NodeMouseHandler,
  type OnSelectionChangeParams,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { NodeKind, Project } from "@/lib/schema";
import { useStore, storeActions, viewportKey } from "@/lib/store";
import { navigation } from "@/lib/navigation";
import { ensureProjectLoaded, ensureManifestPreloaded } from "@/lib/projectLoader";
import { editor } from "@/lib/editor";
import { buildCanvasGraph, parseExternalId } from "@/lib/canvasAdapter";
import { parseFilter } from "@/lib/filter";
import { nodeTypes } from "./nodes";
import { edgeTypes } from "./edges";
import { PALETTE_DRAG_KEY } from "@/components/editor/NodePalette";

const PULSE_MS = 1500;

interface CanvasHostProps {
  editable?: boolean;
}

export function CanvasHost({ editable = false }: CanvasHostProps) {
  const navStack = useStore((s) => s.navStack);
  const projects = useStore((s) => s.projects);
  const projectStatus = useStore((s) => s.projectStatus);

  const current = navStack[navStack.length - 1] ?? null;
  const projectId = current?.projectId ?? null;
  const diagramId = current?.diagramId ?? null;

  useEffect(() => {
    if (!editable && projectId) ensureProjectLoaded(projectId);
    ensureManifestPreloaded();
  }, [projectId, editable]);

  const project = projectId ? projects[projectId] : null;
  const status = projectId ? projectStatus[projectId] : null;

  if (!current || !diagramId) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
        Pick a project to begin.
      </div>
    );
  }

  if (status?.state === "error") {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
        <div className="text-sm font-medium text-destructive">
          Failed to load {projectId}
        </div>
        <pre className="mt-2 whitespace-pre-wrap text-xs text-destructive/80">
          {status.error}
        </pre>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center text-muted-foreground">
        Loading {projectId}…
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <CanvasInner project={project} diagramId={diagramId} editable={editable} />
    </ReactFlowProvider>
  );
}

function CanvasInner({
  project,
  diagramId,
  editable,
}: {
  project: Project;
  diagramId: string;
  editable: boolean;
}) {
  const rf = useReactFlow();
  const rfRef = useRef(rf);
  rfRef.current = rf;

  const lastKey = useRef<string | null>(null);
  const projects = useStore((s) => s.projects);
  const pulseTarget = useStore((s) => s.pulseTarget);
  const [searchParams] = useSearchParams();
  const filter = useMemo(() => parseFilter(searchParams.get("filter")), [searchParams]);

  const pulseNodeId =
    pulseTarget &&
    pulseTarget.projectId === project.id &&
    pulseTarget.diagramId === diagramId
      ? pulseTarget.nodeId
      : null;

  const graph = useMemo(
    () =>
      buildCanvasGraph({
        project,
        diagramId,
        loadedProjects: projects,
        pulseNodeId,
        filter,
      }),
    [project, diagramId, projects, pulseNodeId, filter],
  );

  // Save outgoing viewport, restore incoming (ADR-0006).
  const key = viewportKey(project.id, diagramId);
  useEffect(() => {
    if (lastKey.current === key) return;
    if (lastKey.current) {
      const vp = rfRef.current.getViewport();
      const [prevPid, prevDid] = lastKey.current.split(":");
      storeActions.setViewport(prevPid, prevDid, vp);
    }
    lastKey.current = key;
    const saved = useStore.getState().viewportsByDiagram[key];
    if (saved) {
      rfRef.current.setViewport(saved);
    } else {
      const id = requestAnimationFrame(() =>
        rfRef.current.fitView({ padding: 0.2, duration: 300 }),
      );
      return () => cancelAnimationFrame(id);
    }
    storeActions.setSelection(null);
  }, [key]);

  useEffect(() => {
    if (!pulseNodeId) return;
    const node = graph.nodes.find((n) => n.id === pulseNodeId);
    if (!node) return;
    const id = requestAnimationFrame(() => {
      rfRef.current.setCenter(node.position.x + 80, node.position.y + 40, {
        zoom: 1,
        duration: 500,
      });
    });
    const timer = setTimeout(() => storeActions.setPulseTarget(null), PULSE_MS);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseNodeId]);

  const onNodeClick = useCallback<NodeMouseHandler>((_e, node) => {
    storeActions.setSelection({ nodeId: node.id });
  }, []);

  const onNodeDoubleClick = useCallback<NodeMouseHandler>(
    (_e, node) => {
      const ext = parseExternalId(node.id);
      if (ext) {
        const targetProject = projects[ext.projectId];
        const targetDiagramId = targetProject?.homeDiagramId ?? ext.diagramId;
        navigation().push({
          projectId: ext.projectId,
          diagramId: targetDiagramId,
          focusNodeId: ext.nodeId,
        });
        storeActions.setPulseTarget({
          projectId: ext.projectId,
          diagramId: targetDiagramId,
          nodeId: ext.nodeId,
        });
        return;
      }
      const original = project.diagrams
        .find((d) => d.id === diagramId)
        ?.nodes.find((n) => n.id === node.id);
      if (original?.childDiagramId) {
        navigation().push({
          projectId: project.id,
          diagramId: original.childDiagramId,
        });
      }
    },
    [project, diagramId, projects],
  );

  const onEdgeClick = useCallback((_e: React.MouseEvent, edge: RFEdge) => {
    storeActions.setSelection({ edgeId: edge.id });
  }, []);

  const onPaneClick = useCallback(() => {
    storeActions.setSelection(null);
  }, []);

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    if (params.nodes.length === 0 && params.edges.length === 0) return;
    if (params.nodes[0]) {
      storeActions.setSelection({ nodeId: params.nodes[0].id });
    } else if (params.edges[0]) {
      storeActions.setSelection({ edgeId: params.edges[0].id });
    }
  }, []);

  const onMoveEnd = useCallback(
    (_: unknown, viewport: Viewport) => {
      storeActions.setViewport(project.id, diagramId, viewport);
    },
    [project.id, diagramId],
  );

  // ── EDITOR-ONLY HANDLERS ───────────────────────────────────────────────
  const onNodeDragStart = useCallback(() => {
    if (!editable) return;
    editor.beginTransient(project.id);
  }, [editable, project.id]);

  /**
   * Stream every drag tick straight into the store via applyTransient so the
   * controlled `nodes` prop stays in lockstep with React Flow's internal
   * drag state. Without this the prop revert on every re-render and the
   * cursor "fights" the node. dragStart already beginTransient'd, so we just
   * apply here — the single history entry lands in onNodeDragStop's commit.
   */
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!editable) return;
      for (const c of changes) {
        if (c.type !== "position" || !c.position) continue;
        if (parseExternalId(c.id)) continue; // synthetic externals aren't draggable
        const pos = c.position;
        editor.applyTransient(project.id, (p) => ({
          ...p,
          diagrams: p.diagrams.map((d) =>
            d.id !== diagramId
              ? d
              : {
                  ...d,
                  nodes: d.nodes.map((n) =>
                    n.id === c.id ? { ...n, position: { x: pos.x, y: pos.y } } : n,
                  ),
                },
          ),
        }));
      }
    },
    [editable, project.id, diagramId],
  );

  const onNodeDragStop = useCallback<NodeMouseHandler>(
    (_e, node) => {
      if (!editable) return;
      if (parseExternalId(node.id)) return;
      // onNodesChange streamed the final position already; just close out the
      // burst by promoting pendingBefore → past + autosave.
      editor.commitTransient(project.id);
    },
    [editable, project.id],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (!editable || !c.source || !c.target) return;
      editor.commit(project.id, (p) => ({
        ...p,
        diagrams: p.diagrams.map((d) =>
          d.id !== diagramId
            ? d
            : {
                ...d,
                edges: [
                  ...d.edges,
                  {
                    id: `e-${Math.random().toString(36).slice(2, 9)}`,
                    source: c.source!,
                    target: c.target!,
                    type: "generic",
                  },
                ],
              },
        ),
      }));
    },
    [editable, project.id, diagramId],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (!editable) return;
      const kind = e.dataTransfer.getData(PALETTE_DRAG_KEY) as NodeKind | "";
      if (!kind) return;
      e.preventDefault();
      const position = rfRef.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      const id = `n-${kind}-${Math.random().toString(36).slice(2, 7)}`;
      editor.commit(project.id, (p) => ({
        ...p,
        diagrams: p.diagrams.map((d) =>
          d.id !== diagramId
            ? d
            : {
                ...d,
                nodes: [
                  ...d.nodes,
                  {
                    id,
                    kind,
                    name: `New ${kind}`,
                    position,
                  },
                ],
              },
        ),
      }));
      storeActions.setSelection({ nodeId: id });
    },
    [editable, project.id, diagramId],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!editable) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, [editable]);

  const onNodesDelete = useCallback(
    (deleted: RFNode[]) => {
      if (!editable) return;
      const ids = new Set(deleted.map((n) => n.id).filter((id) => !parseExternalId(id)));
      if (ids.size === 0) return;
      editor.commit(project.id, (p) => ({
        ...p,
        diagrams: p.diagrams.map((d) =>
          d.id !== diagramId
            ? d
            : {
                ...d,
                nodes: d.nodes.filter((n) => !ids.has(n.id)),
                edges: d.edges.filter(
                  (e) => !ids.has(e.source) && (e.target ? !ids.has(e.target) : true),
                ),
              },
        ),
      }));
      storeActions.setSelection(null);
    },
    [editable, project.id, diagramId],
  );

  const onEdgesDelete = useCallback(
    (deleted: RFEdge[]) => {
      if (!editable) return;
      const ids = new Set(deleted.map((e) => e.id));
      editor.commit(project.id, (p) => ({
        ...p,
        diagrams: p.diagrams.map((d) =>
          d.id !== diagramId ? d : { ...d, edges: d.edges.filter((e) => !ids.has(e.id)) },
        ),
      }));
    },
    [editable, project.id, diagramId],
  );

  return (
    <div
      className="h-full min-h-[400px] w-full overflow-hidden rounded-md border border-border"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <ReactFlow
        nodes={graph.nodes as RFNode[]}
        edges={graph.edges as RFEdge[]}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onSelectionChange={onSelectionChange}
        onMoveEnd={onMoveEnd}
        onNodesChange={editable ? onNodesChange : undefined}
        onNodeDragStart={editable ? onNodeDragStart : undefined}
        onNodeDragStop={editable ? onNodeDragStop : undefined}
        onConnect={editable ? onConnect : undefined}
        onNodesDelete={editable ? onNodesDelete : undefined}
        onEdgesDelete={editable ? onEdgesDelete : undefined}
        nodesDraggable={editable}
        nodesConnectable={editable}
        elementsSelectable
        snapToGrid={editable}
        snapGrid={[20, 20]}
        deleteKeyCode={editable ? ["Backspace", "Delete"] : null}
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <Background gap={20} />
        <MiniMap pannable zoomable />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
