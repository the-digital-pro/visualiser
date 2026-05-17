import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { useHotkeys } from "react-hotkeys-hook";
import { useStore, storeActions } from "@/lib/store";
import { navigation } from "@/lib/navigation";
import { parseExternalId } from "@/lib/canvasAdapter";
import { MarkdownDescription } from "@/components/common/MarkdownDescription";
import { cn } from "@/lib/cn";

export function DetailDrawer() {
  const selection = useStore((s) => s.selection);
  const navStack = useStore((s) => s.navStack);
  const projects = useStore((s) => s.projects);
  const current = navStack[navStack.length - 1] ?? null;

  const project = current ? projects[current.projectId] : null;
  const diagram = useMemo(
    () =>
      project && current?.diagramId
        ? project.diagrams.find((d) => d.id === current.diagramId)
        : null,
    [project, current?.diagramId],
  );

  const open = selection !== null;

  useHotkeys(
    "escape",
    () => {
      if (open) storeActions.setSelection(null);
    },
    { enableOnFormTags: false },
    [open],
  );

  useEffect(() => {
    if (!open) return;
    document.body.style.paddingRight = "0";
    return () => {
      document.body.style.paddingRight = "";
    };
  }, [open]);

  return (
    <aside
      aria-label="Detail drawer"
      data-state={open ? "open" : "closed"}
      className={cn(
        "fixed right-0 top-14 z-30 flex h-[calc(100vh-3.5rem)] w-[420px] flex-col border-l border-border bg-card text-card-foreground shadow-xl transition-transform duration-200",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="text-sm font-medium">Detail</div>
        <button
          type="button"
          onClick={() => storeActions.setSelection(null)}
          className="rounded-md p-1 hover:bg-accent"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {!open && (
          <div className="text-sm text-muted-foreground">
            Click a node or edge to see details.
          </div>
        )}

        {open && selection?.nodeId && project && diagram && (
          <NodeDetails
            nodeId={selection.nodeId}
            project={project}
            diagram={diagram}
          />
        )}

        {open && selection?.edgeId && project && diagram && (
          <EdgeDetails
            edgeId={selection.edgeId}
            project={project}
            diagram={diagram}
          />
        )}
      </div>
    </aside>
  );
}

function NodeDetails({
  nodeId,
  project,
  diagram,
}: {
  nodeId: string;
  project: ReturnType<typeof useStore.getState>["projects"][string];
  diagram: ReturnType<typeof useStore.getState>["projects"][string]["diagrams"][number];
}) {
  // Synthetic external?
  const ext = parseExternalId(nodeId);
  if (ext) {
    return (
      <div className="space-y-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          External reference
        </div>
        <div className="text-lg font-semibold">{ext.nodeId}</div>
        <p className="text-sm text-muted-foreground">
          Lives in project <code className="font-mono">{ext.projectId}</code>,
          diagram <code className="font-mono">{ext.diagramId}</code>.
        </p>
        <button
          type="button"
          onClick={() => {
            navigation().push({
              projectId: ext.projectId,
              diagramId: ext.diagramId,
              focusNodeId: ext.nodeId,
            });
            storeActions.setPulseTarget({
              projectId: ext.projectId,
              diagramId: ext.diagramId,
              nodeId: ext.nodeId,
            });
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Follow to target →
        </button>
      </div>
    );
  }

  const node = diagram.nodes.find((n) => n.id === nodeId);
  if (!node) {
    return <div className="text-sm text-muted-foreground">Unknown node.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {node.kind} · in {project.name}
      </div>
      <h2 className="text-lg font-semibold">{node.name}</h2>
      {node.description && <MarkdownDescription source={node.description} />}
      {node.tags && node.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {node.tags.map((t) => (
            <span
              key={t}
              className="rounded-sm bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {node.childDiagramId && (
        <button
          type="button"
          onClick={() =>
            navigation().push({
              projectId: project.id,
              diagramId: node.childDiagramId!,
            })
          }
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Drill into →
        </button>
      )}
    </div>
  );
}

function EdgeDetails({
  edgeId,
  diagram,
}: {
  edgeId: string;
  project: ReturnType<typeof useStore.getState>["projects"][string];
  diagram: ReturnType<typeof useStore.getState>["projects"][string]["diagrams"][number];
}) {
  // Reverse-edges have synthetic ids like `rev-${...}` — handled by inspecting selection.edgeId pattern.
  if (edgeId.startsWith("rev-")) {
    // Reverse-edge details require walking back; for Phase 1, surface a hint.
    return (
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Reverse edge
        </div>
        <p className="text-sm text-muted-foreground">
          This edge originates in another project that's currently loaded.
          Open the source project to inspect it directly.
        </p>
      </div>
    );
  }

  const edge = diagram.edges.find((e) => e.id === edgeId);
  if (!edge) {
    return <div className="text-sm text-muted-foreground">Unknown edge.</div>;
  }

  const sourceName =
    diagram.nodes.find((n) => n.id === edge.source)?.name ?? edge.source;

  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {edge.type} edge
      </div>
      <h2 className="text-lg font-semibold">
        {edge.label ?? "Untitled connection"}
      </h2>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">From</dt>
        <dd>{sourceName}</dd>
        {edge.target && (
          <>
            <dt className="text-muted-foreground">To</dt>
            <dd>
              {diagram.nodes.find((n) => n.id === edge.target)?.name ?? edge.target}
            </dd>
          </>
        )}
        {edge.targetRef && (
          <>
            <dt className="text-muted-foreground">To (cross-project)</dt>
            <dd className="font-mono text-xs">{edge.targetRef}</dd>
          </>
        )}
      </dl>
      {edge.targetRef && (
        <button
          type="button"
          onClick={() => {
            const [pid, did, nid] = edge.targetRef!.split(":");
            navigation().push({
              projectId: pid,
              diagramId: did,
              focusNodeId: nid,
            });
            storeActions.setPulseTarget({
              projectId: pid,
              diagramId: did,
              nodeId: nid,
            });
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Follow to target →
        </button>
      )}
    </div>
  );
}
