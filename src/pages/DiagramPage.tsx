import { useParams } from "react-router-dom";
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

  const referentialIssues = issues.filter((i) => i.tier === "referential");

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
      <div className="h-[calc(100vh-140px)]">
        <CanvasHost />
      </div>
      {navStack.length > 0 && diagramId && <DetailDrawer />}
    </div>
  );
}
