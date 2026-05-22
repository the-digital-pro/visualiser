import { useState, type ChangeEvent } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useStore } from "@/lib/store";
import { editor } from "@/lib/editor";
import { NodeKindSchema, EdgeTypeSchema, type Project } from "@/lib/schema";

/**
 * Comma-separated list input that keeps the literal typed string while the
 * user is editing, instead of re-deriving the display from the parsed array.
 * Without this, typing "a, b, " would snap back to "a, b" mid-keystroke and
 * the user could never start a new entry.
 */
function useCommaListField(
  storeValue: string[] | undefined,
  apply: (next: string[] | undefined) => void,
) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? (storeValue ?? []).join(", ");
  return {
    display,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const text = e.target.value;
      setDraft(text);
      const parsed = text
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      apply(parsed.length ? parsed : undefined);
    },
    onBlur: () => setDraft(null),
  };
}

interface PropertiesPanelProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function PropertiesPanel({ collapsed, onToggle }: PropertiesPanelProps) {
  const editingProjectId = useStore((s) => s.editingProjectId);
  const project = useStore((s) =>
    editingProjectId ? s.projects[editingProjectId] : null,
  );
  const navStack = useStore((s) => s.navStack);
  const selection = useStore((s) => s.selection);
  const current = navStack[navStack.length - 1];

  const diagram = project && current?.diagramId
    ? project.diagrams.find((d) => d.id === current.diagramId) ?? null
    : null;

  if (collapsed) {
    return (
      <aside
        aria-label="Properties panel (collapsed)"
        className="flex h-full w-10 shrink-0 flex-col items-center border-l border-border bg-card text-card-foreground"
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex h-9 w-full items-center justify-center border-b border-border hover:bg-accent"
          aria-label="Expand properties panel"
          title="Expand properties panel"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
        <div
          className="mt-2 select-none text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
          style={{ writingMode: "vertical-rl" }}
        >
          Properties
          {selection?.nodeId ? " · node" : selection?.edgeId ? " · edge" : ""}
        </div>
      </aside>
    );
  }

  if (!project || !diagram) {
    return (
      <aside
        aria-label="Properties panel"
        className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card text-card-foreground"
      >
        <Header onToggle={onToggle} />
        <div className="p-4 text-sm text-muted-foreground">Open a diagram to edit.</div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Properties panel"
      className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card text-card-foreground"
    >
      <Header onToggle={onToggle} />
      <div className="flex-1 overflow-y-auto p-4">
        {!selection && <ProjectProperties projectId={project.id} />}
        {selection?.nodeId && (
          <NodeProperties projectId={project.id} diagramId={diagram.id} nodeId={selection.nodeId} />
        )}
        {selection?.edgeId && (
          <EdgeProperties projectId={project.id} diagramId={diagram.id} edgeId={selection.edgeId} />
        )}
      </div>
    </aside>
  );
}

function Header({ onToggle }: { onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      <span>Properties</span>
      <button
        type="button"
        onClick={onToggle}
        className="rounded-sm p-0.5 hover:bg-accent hover:text-foreground"
        aria-label="Collapse properties panel"
        title="Collapse"
      >
        <PanelRightClose className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function patchProject(
  projectId: string,
  patch: Partial<Project>,
  variant: "transient" | "commit",
) {
  const mutator = (p: Project): Project => ({ ...p, ...patch });
  if (variant === "commit") {
    editor.commit(projectId, mutator);
  } else {
    editor.applyTransient(projectId, mutator);
  }
}

function ProjectProperties({ projectId }: { projectId: string }) {
  const project = useStore((s) => s.projects[projectId]);
  if (!project) {
    return <p className="text-sm text-muted-foreground">Project not loaded.</p>;
  }

  const startBurst = () => editor.beginTransient(projectId);
  const endBurst = () => editor.commitTransient(projectId);

  const ownersField = useCommaListField(project.owners, (next) =>
    patchProject(projectId, { owners: next }, "transient"),
  );
  const tagsField = useCommaListField(project.tags, (next) =>
    patchProject(projectId, { tags: next }, "transient"),
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Project details. Select a node or edge on the canvas to edit it instead.
      </p>

      <Field label="Name">
        <input
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
          value={project.name}
          onFocus={startBurst}
          onChange={(e) =>
            patchProject(projectId, { name: e.target.value }, "transient")
          }
          onBlur={endBurst}
        />
      </Field>

      <Field label="Description">
        <textarea
          className="min-h-[80px] w-full rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
          value={project.description ?? ""}
          onFocus={startBurst}
          onChange={(e) =>
            patchProject(
              projectId,
              { description: e.target.value || undefined },
              "transient",
            )
          }
          onBlur={endBurst}
          placeholder="Short summary shown on the home screen folder card"
        />
      </Field>

      <Field label="Owners (comma-separated)">
        <input
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
          value={ownersField.display}
          onFocus={startBurst}
          onChange={ownersField.onChange}
          onBlur={() => {
            ownersField.onBlur();
            endBurst();
          }}
          placeholder="e.g. booking-team, platform-team"
        />
      </Field>

      <Field label="Tags (comma-separated)">
        <input
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
          value={tagsField.display}
          onFocus={startBurst}
          onChange={tagsField.onChange}
          onBlur={() => {
            tagsField.onBlur();
            endBurst();
          }}
        />
      </Field>

      <Field label="Home diagram">
        <select
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
          value={project.homeDiagramId}
          onChange={(e) =>
            patchProject(projectId, { homeDiagramId: e.target.value }, "commit")
          }
        >
          {project.diagrams.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.id})
            </option>
          ))}
        </select>
      </Field>

      <div className="border-t border-border pt-3 text-[10px] text-muted-foreground">
        Project id: <code className="font-mono">{project.id}</code>
        <div className="mt-0.5">
          Changing the id would break cross-project edges and the file name —
          edit the JSON manually if you need to rename.
        </div>
      </div>
    </div>
  );
}

function patchNode(
  projectId: string,
  diagramId: string,
  nodeId: string,
  patch: Record<string, unknown>,
  variant: "transient" | "commit",
) {
  const mutator = (p: Project): Project => ({
    ...p,
    diagrams: p.diagrams.map((d) =>
      d.id !== diagramId
        ? d
        : {
            ...d,
            nodes: d.nodes.map((n) => (n.id !== nodeId ? n : { ...n, ...patch })),
          },
    ),
  });
  if (variant === "commit") {
    editor.commit(projectId, mutator);
  } else {
    editor.applyTransient(projectId, mutator);
  }
}

function patchEdge(
  projectId: string,
  diagramId: string,
  edgeId: string,
  patch: Record<string, unknown>,
  variant: "transient" | "commit",
) {
  const mutator = (p: Project): Project => ({
    ...p,
    diagrams: p.diagrams.map((d) =>
      d.id !== diagramId
        ? d
        : {
            ...d,
            edges: d.edges.map((e) => (e.id !== edgeId ? e : { ...e, ...patch })),
          },
    ),
  });
  if (variant === "commit") {
    editor.commit(projectId, mutator);
  } else {
    editor.applyTransient(projectId, mutator);
  }
}

function NodeProperties({
  projectId,
  diagramId,
  nodeId,
}: {
  projectId: string;
  diagramId: string;
  nodeId: string;
}) {
  const node = useStore((s) =>
    s.projects[projectId]?.diagrams.find((d) => d.id === diagramId)?.nodes.find((n) => n.id === nodeId),
  );
  if (!node) {
    return <p className="text-sm text-muted-foreground">Node not found.</p>;
  }

  const startBurst = () => editor.beginTransient(projectId);
  const endBurst = () => editor.commitTransient(projectId);

  const tagsField = useCommaListField(node.tags, (next) =>
    patchNode(projectId, diagramId, nodeId, { tags: next }, "transient"),
  );

  return (
    <div className="space-y-4">
      <Field label="Name">
        <input
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
          value={node.name}
          onFocus={startBurst}
          onChange={(e) =>
            patchNode(projectId, diagramId, nodeId, { name: e.target.value }, "transient")
          }
          onBlur={endBurst}
        />
      </Field>

      <Field label="Kind">
        <select
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
          value={node.kind}
          onChange={(e) =>
            patchNode(projectId, diagramId, nodeId, { kind: e.target.value }, "commit")
          }
        >
          {NodeKindSchema.options.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Description">
        <textarea
          className="min-h-[100px] w-full rounded-md border border-input bg-background px-2 py-1 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
          value={node.description ?? ""}
          onFocus={startBurst}
          onChange={(e) =>
            patchNode(
              projectId,
              diagramId,
              nodeId,
              { description: e.target.value || undefined },
              "transient",
            )
          }
          onBlur={endBurst}
          placeholder="Markdown (rendered in Phase 4)"
        />
      </Field>

      <Field label="Tags (comma-separated)">
        <input
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
          value={tagsField.display}
          onFocus={startBurst}
          onChange={tagsField.onChange}
          onBlur={() => {
            tagsField.onBlur();
            endBurst();
          }}
        />
      </Field>

      <Field label="Child diagram (drill-target)">
        <input
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
          value={node.childDiagramId ?? ""}
          onFocus={startBurst}
          onChange={(e) =>
            patchNode(
              projectId,
              diagramId,
              nodeId,
              { childDiagramId: e.target.value || undefined },
              "transient",
            )
          }
          onBlur={endBurst}
          placeholder="diagram id"
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="x">
          <input
            type="number"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
            value={node.position.x}
            onFocus={startBurst}
            onChange={(e) =>
              patchNode(
                projectId,
                diagramId,
                nodeId,
                { position: { ...node.position, x: Number(e.target.value) } },
                "transient",
              )
            }
            onBlur={endBurst}
          />
        </Field>
        <Field label="y">
          <input
            type="number"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
            value={node.position.y}
            onFocus={startBurst}
            onChange={(e) =>
              patchNode(
                projectId,
                diagramId,
                nodeId,
                { position: { ...node.position, y: Number(e.target.value) } },
                "transient",
              )
            }
            onBlur={endBurst}
          />
        </Field>
      </div>

      <div className="border-t border-border pt-3 text-[10px] text-muted-foreground">
        Node id: <code className="font-mono">{node.id}</code>
      </div>
    </div>
  );
}

function EdgeProperties({
  projectId,
  diagramId,
  edgeId,
}: {
  projectId: string;
  diagramId: string;
  edgeId: string;
}) {
  const edge = useStore((s) =>
    s.projects[projectId]?.diagrams.find((d) => d.id === diagramId)?.edges.find((e) => e.id === edgeId),
  );
  if (!edge) {
    return <p className="text-sm text-muted-foreground">Edge not found.</p>;
  }
  const startBurst = () => editor.beginTransient(projectId);
  const endBurst = () => editor.commitTransient(projectId);

  return (
    <div className="space-y-4">
      <Field label="Type">
        <select
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
          value={edge.type}
          onChange={(e) =>
            patchEdge(projectId, diagramId, edgeId, { type: e.target.value }, "commit")
          }
        >
          {EdgeTypeSchema.options.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Label">
        <input
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
          value={edge.label ?? ""}
          onFocus={startBurst}
          onChange={(e) =>
            patchEdge(
              projectId,
              diagramId,
              edgeId,
              { label: e.target.value || undefined },
              "transient",
            )
          }
          onBlur={endBurst}
        />
      </Field>

      {edge.targetRef !== undefined && (
        <Field label="targetRef (project:diagram:node)">
          <input
            className="w-full rounded-md border border-input bg-background px-2 py-1 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
            value={edge.targetRef ?? ""}
            onFocus={startBurst}
            onChange={(e) =>
              patchEdge(
                projectId,
                diagramId,
                edgeId,
                { targetRef: e.target.value },
                "transient",
              )
            }
            onBlur={endBurst}
          />
        </Field>
      )}

      <div className="border-t border-border pt-3 text-[10px] text-muted-foreground">
        Edge id: <code className="font-mono">{edge.id}</code> · source{" "}
        <code className="font-mono">{edge.source}</code>
        {edge.target && (
          <>
            {" "}· target <code className="font-mono">{edge.target}</code>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
