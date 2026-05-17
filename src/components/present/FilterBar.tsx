import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Filter as FilterIcon, X } from "lucide-react";
import { NodeKindSchema } from "@/lib/schema";
import { encodeFilter, parseFilter, EMPTY_FILTER } from "@/lib/filter";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/cn";

/**
 * Filter chip strip (Phase 3 §3).
 *
 * Filters live in the URL (`?filter=kind:service,tag:critical`) so reload
 * + share both round-trip. Chips toggle the corresponding token; clear
 * resets to no filter. Non-matching nodes/edges fade in the canvas — they
 * remain selectable so spatial reference is preserved.
 */
export function FilterBar() {
  const [params, setParams] = useSearchParams();
  const filter = parseFilter(params.get("filter"));

  const navStack = useStore((s) => s.navStack);
  const projects = useStore((s) => s.projects);
  const current = navStack[navStack.length - 1];
  const diagram = current
    ? projects[current.projectId]?.diagrams.find((d) => d.id === current.diagramId)
    : null;

  // Discover the union of tags present in the current diagram so the chip set
  // matches what the user can actually filter against.
  const availableTags = useMemo(() => {
    if (!diagram) return [];
    const all = new Set<string>();
    for (const n of diagram.nodes) {
      for (const t of n.tags ?? []) all.add(t);
    }
    for (const e of diagram.edges) {
      for (const t of e.tags ?? []) all.add(t);
    }
    return Array.from(all).sort();
  }, [diagram]);

  const update = (next: typeof filter) => {
    const encoded = encodeFilter(next);
    const merged = new URLSearchParams(params);
    if (encoded) merged.set("filter", encoded);
    else merged.delete("filter");
    setParams(merged, { replace: true });
  };

  const toggleKind = (kind: string) => {
    const has = filter.kinds.includes(kind as never);
    update({
      ...filter,
      kinds: has
        ? filter.kinds.filter((k) => k !== kind)
        : ([...filter.kinds, kind] as never),
    });
  };
  const toggleTag = (tag: string) => {
    const has = filter.tags.includes(tag);
    update({
      ...filter,
      tags: has ? filter.tags.filter((t) => t !== tag) : [...filter.tags, tag],
    });
  };
  const clear = () => update(EMPTY_FILTER);

  const hasAny = filter.kinds.length + filter.tags.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <div
        className="flex items-center gap-1 text-muted-foreground"
        aria-label="Filter"
      >
        <FilterIcon className="h-3.5 w-3.5" />
        <span>Filter:</span>
      </div>
      {NodeKindSchema.options.map((k) => {
        const active = filter.kinds.includes(k);
        return (
          <Chip key={`kind-${k}`} active={active} onClick={() => toggleKind(k)}>
            kind:{k}
          </Chip>
        );
      })}
      {availableTags.length > 0 && (
        <span className="text-muted-foreground/60">·</span>
      )}
      {availableTags.map((t) => {
        const active = filter.tags.includes(t);
        return (
          <Chip key={`tag-${t}`} active={active} onClick={() => toggleTag(t)}>
            tag:{t}
          </Chip>
        );
      })}
      {hasAny && (
        <button
          type="button"
          onClick={clear}
          className="ml-1 inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 hover:bg-accent"
          aria-label="Clear all filters"
        >
          <X className="h-3 w-3" /> clear
        </button>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-sm border px-1.5 py-0.5 transition-colors",
        active
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
