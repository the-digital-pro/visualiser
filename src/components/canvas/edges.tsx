import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import type { CanvasEdgeData } from "@/lib/canvasAdapter";
import { cn } from "@/lib/cn";

const COLOR_BY_TYPE: Record<string, string> = {
  rest: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  graphql: "bg-pink-500/15 text-pink-600 dark:text-pink-300",
  grpc: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300",
  jdbc: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  async: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  file: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  auth: "bg-red-500/15 text-red-600 dark:text-red-300",
  generic: "bg-secondary text-secondary-foreground",
};

function ArcvizEdgeInner(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
    markerEnd,
  } = props;
  const d = data as CanvasEdgeData | undefined;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const reverse = d?.reverse ?? false;
  const crossProject = d?.crossProject ?? false;
  const badge = d?.edgeType ?? "generic";

  const faded = d?.faded ?? false;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          strokeDasharray: reverse || crossProject ? "6 4" : undefined,
          strokeWidth: selected ? 2.5 : 1.5,
          opacity: faded ? 0.25 : 1,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className={cn(
            "pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-sm border border-border px-1.5 py-0.5 text-[10px] font-medium shadow-sm transition-opacity",
            COLOR_BY_TYPE[badge] ?? COLOR_BY_TYPE.generic,
            selected && "ring-1 ring-ring",
            faded && "opacity-30",
          )}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
        >
          {reverse && <span className="mr-1">↗</span>}
          <span className="uppercase tracking-wide">{badge}</span>
          {d?.label && (
            <span className="ml-1 normal-case opacity-80">· {d.label}</span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const ArcvizEdge = memo(ArcvizEdgeInner);

export const edgeTypes = {
  arcviz: ArcvizEdge,
};
