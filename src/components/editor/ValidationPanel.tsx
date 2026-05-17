import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Info } from "lucide-react";
import { useStore, storeActions } from "@/lib/store";
import type { ValidationIssue } from "@/lib/loader";
import { cn } from "@/lib/cn";

const EMPTY_ISSUES: ValidationIssue[] = [];

export function ValidationPanel() {
  const editingProjectId = useStore((s) => s.editingProjectId);
  // NEVER return a fresh `[]` from a selector — useSyncExternalStore detects
  // the new reference as a snapshot change and loops. EMPTY_ISSUES is hoisted.
  const issues = useStore((s) =>
    editingProjectId
      ? s.projectStatus[editingProjectId]?.issues ?? EMPTY_ISSUES
      : EMPTY_ISSUES,
  );
  const [open, setOpen] = useState(true);

  const tier2 = issues.filter((i) => i.tier === "referential");
  const tier3 = issues.filter((i) => i.tier === "soft");
  const count = tier2.length + tier3.length;

  if (count === 0) return null;

  const focusFromPath = (path: string) => {
    // Path looks like "diagrams.X.nodes.Y.field" or "diagrams.X.edges.Y.field".
    const m = path.match(/diagrams\.([^.]+)\.(nodes|edges)\.([^.]+)/);
    if (!m) return;
    const [, , kind, id] = m;
    if (kind === "nodes") storeActions.setSelection({ nodeId: id });
    else storeActions.setSelection({ edgeId: id });
  };

  return (
    <section className="rounded-md border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-medium">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          Validation ({tier2.length} referential, {tier3.length} soft)
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <ul className="divide-y divide-border border-t border-border text-xs">
          {[...tier2, ...tier3].map((i, idx) => (
            <li key={`${i.path}-${idx}`} className="px-3 py-2">
              <button
                type="button"
                onClick={() => focusFromPath(i.path)}
                className="block w-full text-left hover:underline"
              >
                <div className="flex items-center gap-1.5">
                  {i.tier === "referential" ? (
                    <AlertTriangle className={cn("h-3 w-3 text-amber-500")} />
                  ) : (
                    <Info className="h-3 w-3 text-muted-foreground" />
                  )}
                  <code className="font-mono text-[10px] text-muted-foreground">{i.path}</code>
                </div>
                <div className="mt-0.5">{i.message}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
