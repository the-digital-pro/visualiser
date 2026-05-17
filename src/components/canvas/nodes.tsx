import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  AppWindow,
  Box,
  Cloud,
  Database,
  Group as GroupIcon,
  Inbox,
  Server,
  User,
} from "lucide-react";
import type { NodeKind } from "@/lib/schema";
import { cn } from "@/lib/cn";

export interface ArcvizNodeData extends Record<string, unknown> {
  name: string;
  description?: string;
  kind: NodeKind;
  tags?: string[];
  hasChildDiagram: boolean;
  pulsing: boolean;
  invalid: boolean;
  faded: boolean;
}

const ICON_BY_KIND: Record<NodeKind, React.ComponentType<{ className?: string }>> = {
  actor: User,
  system: Box,
  application: AppWindow,
  service: Server,
  datastore: Database,
  queue: Inbox,
  infra: Cloud,
  group: GroupIcon,
};

function NodeShellInner({ data, selected }: NodeProps) {
  const d = data as ArcvizNodeData;
  const Icon = ICON_BY_KIND[d.kind];

  if (d.kind === "group") {
    return (
      <div
        className={cn(
          "rounded-md border-2 border-dashed bg-muted/20 backdrop-blur-[1px]",
          "flex h-full w-full flex-col px-2 py-1",
          selected ? "border-primary" : "border-border",
        )}
        style={{ minWidth: 240, minHeight: 160 }}
      >
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          <span>{d.name}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-w-[160px] rounded-md border bg-card px-3 py-2 text-card-foreground shadow-sm transition-opacity",
        selected ? "border-primary ring-2 ring-ring" : "border-border",
        d.pulsing && "arcviz-pulse",
        d.invalid && "border-destructive/60 bg-destructive/10",
        d.faded && "opacity-30",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-border !bg-muted-foreground"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="t"
        className="!h-2 !w-2 !border-border !bg-muted-foreground"
      />

      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="text-sm font-medium leading-tight">{d.name}</div>
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {d.kind}
        {d.hasChildDiagram && <span className="ml-1 text-primary">↘ drill</span>}
        {d.invalid && <span className="ml-1 text-destructive">⚠ unresolved</span>}
      </div>
      {d.tags && d.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {d.tags.map((t) => (
            <span
              key={t}
              className="rounded-sm bg-secondary px-1 text-[10px] text-secondary-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-border !bg-muted-foreground"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="b"
        className="!h-2 !w-2 !border-border !bg-muted-foreground"
      />
    </div>
  );
}

const NodeShell = memo(NodeShellInner);

export const nodeTypes = {
  actor: NodeShell,
  system: NodeShell,
  application: NodeShell,
  service: NodeShell,
  datastore: NodeShell,
  queue: NodeShell,
  infra: NodeShell,
  group: NodeShell,
};
