import {
  AppWindow,
  Box,
  Cloud,
  Database,
  Group as GroupIcon,
  Inbox,
  PanelLeftClose,
  PanelLeftOpen,
  Server,
  User,
} from "lucide-react";
import type { NodeKind } from "@/lib/schema";

const KINDS: { kind: NodeKind; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { kind: "actor", label: "Actor", Icon: User },
  { kind: "system", label: "System", Icon: Box },
  { kind: "application", label: "Application", Icon: AppWindow },
  { kind: "service", label: "Service", Icon: Server },
  { kind: "datastore", label: "Datastore", Icon: Database },
  { kind: "queue", label: "Queue", Icon: Inbox },
  { kind: "infra", label: "Infra", Icon: Cloud },
  { kind: "group", label: "Group", Icon: GroupIcon },
];

export const PALETTE_DRAG_KEY = "application/arcviz-kind";

interface NodePaletteProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function NodePalette({ collapsed, onToggle }: NodePaletteProps) {
  if (collapsed) {
    return (
      <aside
        aria-label="Node palette (collapsed)"
        className="flex h-full w-10 shrink-0 flex-col items-center border-r border-border bg-card text-card-foreground"
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex h-9 w-full items-center justify-center border-b border-border hover:bg-accent"
          aria-label="Expand node palette"
          title="Expand node palette"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
        <div
          className="mt-2 select-none text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
          style={{ writingMode: "vertical-rl" }}
        >
          Node palette
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Node palette"
      className="flex h-full w-44 shrink-0 flex-col border-r border-border bg-card text-card-foreground"
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>Node palette</span>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-sm p-0.5 hover:bg-accent hover:text-foreground"
          aria-label="Collapse node palette"
          title="Collapse"
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto p-2">
        {KINDS.map(({ kind, label, Icon }) => (
          <li key={kind}>
            <div
              role="button"
              tabIndex={0}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(PALETTE_DRAG_KEY, kind);
                e.dataTransfer.effectAllowed = "copy";
              }}
              className="flex cursor-grab items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm hover:bg-accent active:cursor-grabbing"
              aria-label={`Drag a ${label.toLowerCase()} onto the canvas`}
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span>{label}</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
        Drag a kind onto the canvas to create a node.
      </div>
    </aside>
  );
}
