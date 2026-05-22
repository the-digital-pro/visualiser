import { Link, useParams } from "react-router-dom";
import { Play } from "lucide-react";
import { useStore } from "@/lib/store";
import type { ValidationIssue } from "@/lib/loader";
import { CanvasHost } from "@/components/canvas/CanvasHost";
import { DetailDrawer } from "@/components/present/DetailDrawer";
import { Breadcrumb } from "@/components/present/Breadcrumb";
import { FilterBar } from "@/components/present/FilterBar";
import { CapturePngButton } from "@/components/present/CapturePngButton";

const EMPTY_ISSUES: ValidationIssue[] = [];

/**
 * Single page for all diagram URLs. The CanvasHost reads the current frame
 * from the store (mirror of NavigationController.stack) and renders the
 * appropriate diagram — same component instance across diagram navigations
 * so `key` is never `diagramId` (ADR-0006).
 *
 * Project loading happens inside CanvasHost via `ensureProjectLoaded`
 * (module-level in-flight tracker), which avoids the StrictMode double-mount
 * loops you get when calling fetch from a useEffect.
 */
export function DiagramPage() {
  const { projectId, diagramId } = useParams();
  const navStack = useStore((s) => s.navStack);
  // Hoisted EMPTY_ISSUES — never construct a fresh array inside the selector,
  // or useSyncExternalStore will see a new snapshot each call and loop.
  const issues = useStore((s) =>
    projectId ? s.projectStatus[projectId]?.issues ?? EMPTY_ISSUES : EMPTY_ISSUES,
  );
  const project = useStore((s) => (projectId ? s.projects[projectId] : null));

  const referentialIssues = issues.filter((i) => i.tier === "referential");

  // Surface the start-to-finish walkthrough whenever the consumer lands on
  // the project's home diagram. Prefer the canonical `walkthrough` id (what
  // the architecture-parse skill emits); fall back to the first tour for
  // seeds that pre-date that convention.
  const isHomeDiagram =
    project && diagramId ? project.homeDiagramId === diagramId : false;
  const walkthrough = project?.tours
    ? project.tours.find((t) => t.id === "walkthrough") ?? project.tours[0]
    : undefined;
  const showWalkthroughCta = isHomeDiagram && !!walkthrough;

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb />
        <div className="flex items-center gap-2">
          <FilterBar />
          <CapturePngButton />
        </div>
      </div>
      {referentialIssues.length > 0 && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-xs">
          <div className="font-medium text-amber-700 dark:text-amber-300">
            {referentialIssues.length} referential issue
            {referentialIssues.length === 1 ? "" : "s"} in {projectId}
          </div>
          <ul className="mt-1 list-disc pl-4 text-amber-700/80 dark:text-amber-300/80">
            {referentialIssues.slice(0, 3).map((i, idx) => (
              <li key={idx}>
                <code className="font-mono">{i.path}</code> — {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {showWalkthroughCta && walkthrough && projectId && (
        <Link
          to={`/tour/${projectId}/${walkthrough.id}?step=1`}
          className="group flex items-center justify-between gap-4 rounded-md border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3 transition-colors hover:from-primary/20 hover:via-primary/10"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
              <Play className="h-4 w-4 translate-x-0.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-primary">
                  Walkthrough
                </span>
                <span className="text-xs text-muted-foreground">
                  {walkthrough.stops.length} stop
                  {walkthrough.stops.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-0.5 truncate text-sm font-medium">
                {walkthrough.name}
              </div>
              {walkthrough.description && (
                <div className="truncate text-xs text-muted-foreground">
                  {walkthrough.description}
                </div>
              )}
            </div>
          </div>
          <span className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm group-hover:bg-primary/90">
            Start
          </span>
        </Link>
      )}
      <div className="h-[calc(100vh-140px)]">
        <CanvasHost />
      </div>
      {navStack.length > 0 && diagramId && <DetailDrawer />}
    </div>
  );
}
