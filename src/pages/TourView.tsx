import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useHotkeys } from "react-hotkeys-hook";
import type { Project, Tour, TourStop } from "@/lib/schema";
import { storeActions, useStore } from "@/lib/store";
import { ensureProjectLoaded } from "@/lib/projectLoader";
import { navigation } from "@/lib/navigation";
import { CanvasHost } from "@/components/canvas/CanvasHost";
import { MarkdownDescription } from "@/components/common/MarkdownDescription";

interface ResolvedStop {
  index: number;
  total: number;
  projectId: string;
  diagramId: string;
  nodeId?: string;
  note: string;
}

function parseRef(ref: string): { projectId: string; diagramId: string; nodeId?: string } | null {
  const parts = ref.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  return {
    projectId: parts[0],
    diagramId: parts[1],
    ...(parts[2] && { nodeId: parts[2] }),
  };
}

/**
 * Tour player (ADR-0010). `/tour/:projectId/:tourId?step=N` — `step` is the
 * source of truth so mid-tour links are deep-shareable. Navigation routes
 * through NavigationController to keep the breadcrumb honest.
 */
export function TourView() {
  const { projectId, tourId } = useParams();
  const [params, setParams] = useSearchParams();
  const stepParam = params.get("step");
  const step = stepParam ? Math.max(1, parseInt(stepParam, 10) || 1) : 1;
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    ensureProjectLoaded(projectId);
  }, [projectId]);

  const tour = useStore((s): Tour | null => {
    const project = projectId ? s.projects[projectId] : null;
    return project?.tours?.find((t) => t.id === tourId) ?? null;
  });

  const projectStatus = useStore((s) => (projectId ? s.projectStatus[projectId] : null));
  const project: Project | null = useStore((s) => (projectId ? s.projects[projectId] ?? null : null));

  // Resolve current stop + preload its (possibly cross-project) target.
  const resolved: ResolvedStop | null = useMemo(() => {
    if (!tour) return null;
    const safeStep = Math.min(Math.max(1, step), tour.stops.length);
    const s: TourStop = tour.stops[safeStep - 1];
    const parsed = parseRef(s.ref);
    if (!parsed) return null;
    return {
      index: safeStep,
      total: tour.stops.length,
      projectId: parsed.projectId,
      diagramId: parsed.diagramId,
      nodeId: parsed.nodeId,
      note: s.note,
    };
  }, [tour, step]);

  // Drive the canvas imperatively while on `/tour/*` — NavigationController
  // intentionally ignores this surface (see lib/navigation.ts). The URL stays
  // at /tour/:projectId/:tourId?step=N so mid-tour links are deep-shareable.
  useEffect(() => {
    if (!resolved) return;
    ensureProjectLoaded(resolved.projectId);
    const frame = {
      projectId: resolved.projectId,
      diagramId: resolved.diagramId,
      ...(resolved.nodeId && { focusNodeId: resolved.nodeId }),
    };
    storeActions.setNavStack([frame]);
    if (resolved.nodeId) {
      storeActions.setSelection({ nodeId: resolved.nodeId });
      storeActions.setPulseTarget({
        projectId: resolved.projectId,
        diagramId: resolved.diagramId,
        nodeId: resolved.nodeId,
      });
    } else {
      storeActions.setSelection(null);
    }
  }, [resolved]);

  const go = useCallback(
    (delta: number) => {
      if (!resolved) return;
      const next = Math.min(Math.max(1, resolved.index + delta), resolved.total);
      if (next === resolved.index) return;
      const merged = new URLSearchParams(params);
      merged.set("step", String(next));
      setParams(merged, { replace: false });
    },
    [resolved, params, setParams],
  );

  const exit = useCallback(() => {
    if (!resolved) return;
    navigation().push({
      projectId: resolved.projectId,
      diagramId: resolved.diagramId,
    });
  }, [resolved]);

  useHotkeys("right, n", () => go(+1), { enableOnFormTags: false }, [go]);
  useHotkeys("left, p", () => go(-1), { enableOnFormTags: false }, [go]);
  useHotkeys("escape", () => exit(), { enableOnFormTags: false }, [exit]);

  if (!projectId || !tourId) {
    return <ErrorCard>Missing project or tour id.</ErrorCard>;
  }

  if (projectStatus?.state === "error") {
    return (
      <ErrorCard>
        Failed to load project <code className="font-mono">{projectId}</code>:{" "}
        {projectStatus.error}
      </ErrorCard>
    );
  }
  if (loadError) {
    return <ErrorCard>{loadError}</ErrorCard>;
  }
  if (!project) {
    return <div className="text-muted-foreground">Loading {projectId}…</div>;
  }
  if (!tour) {
    return (
      <ErrorCard>
        Tour <code className="font-mono">{tourId}</code> does not exist in{" "}
        <code className="font-mono">{projectId}</code>.
      </ErrorCard>
    );
  }
  if (!resolved) {
    setLoadError(`Tour stop ${step} has a malformed ref.`);
    return null;
  }

  const atStart = resolved.index === 1;
  const atEnd = resolved.index === resolved.total;

  return (
    <div className="space-y-3 px-4 py-4">
      <header className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 font-medium text-primary">
              Tour
            </span>
            <span className="truncate">{tour.name}</span>
            <span>
              · step {resolved.index} / {resolved.total}
            </span>
          </div>
          <MarkdownDescription source={resolved.note} className="mt-1" />
        </div>
        <nav className="flex items-center gap-1" aria-label="Tour navigation">
          <button
            type="button"
            disabled={atStart}
            onClick={() => go(-1)}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous stop"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <button
            type="button"
            disabled={atEnd}
            onClick={() => go(+1)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next stop"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={exit}
            className="ml-1 inline-flex items-center rounded-md border border-border bg-card p-1.5 hover:bg-accent"
            aria-label="Exit tour"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </nav>
      </header>
      <div className="h-[calc(100vh-200px)]">
        <CanvasHost />
      </div>
    </div>
  );
}

function ErrorCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm">
      {children}
    </div>
  );
}
