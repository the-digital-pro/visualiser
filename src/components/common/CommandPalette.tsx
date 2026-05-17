import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { useHotkeys } from "react-hotkeys-hook";
import Fuse from "fuse.js";
import {
  SearchIndexEntrySchema,
  type SearchIndexEntry,
  ManifestSchema,
  type Manifest,
} from "@/lib/schema";
import { navigation } from "@/lib/navigation";
import { storeActions } from "@/lib/store";

const RECENT_KEY = "arcviz:recent-searches";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchIndexEntry[] | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    } catch {
      return [];
    }
  });
  const fetchedOnce = useRef(false);

  useHotkeys(
    "mod+k",
    (e) => {
      e.preventDefault();
      setOpen(true);
    },
    { enableOnFormTags: true, preventDefault: true },
  );

  // Lazy-fetch search index on first open.
  useEffect(() => {
    if (!open || fetchedOnce.current) return;
    fetchedOnce.current = true;
    Promise.all([
      fetch("/projects/search-index.json").then((r) => r.json()),
      fetch("/projects/manifest.json").then((r) => r.json()),
    ])
      .then(([rawIndex, rawManifest]) => {
        const idx = SearchIndexEntrySchema.array().safeParse(rawIndex);
        const man = ManifestSchema.safeParse(rawManifest);
        if (idx.success) setIndex(idx.data);
        if (man.success) setManifest(man.data);
      })
      .catch(() => {
        // Silent — palette will show "No results".
      });
  }, [open]);

  const fuse = useMemo(() => {
    if (!index) return null;
    return new Fuse(index, {
      keys: ["name", "description", "tags"],
      threshold: 0.4,
      includeMatches: false,
    });
  }, [index]);

  const results = useMemo(() => {
    if (!fuse || !index) return [];
    if (!query.trim()) return index.slice(0, 24);
    return fuse.search(query, { limit: 24 }).map((r) => r.item);
  }, [fuse, index, query]);

  const groupedByProject = useMemo(() => {
    const groups: Record<string, SearchIndexEntry[]> = {};
    for (const r of results) {
      (groups[r.projectId] ??= []).push(r);
    }
    return groups;
  }, [results]);

  const projectNameById = useMemo(() => {
    const m: Record<string, string> = {};
    manifest?.projects.forEach((p) => (m[p.id] = p.name));
    return m;
  }, [manifest]);

  const select = (entry: SearchIndexEntry) => {
    navigation().push({
      projectId: entry.projectId,
      diagramId: entry.diagramId,
      focusNodeId: entry.nodeId,
    });
    storeActions.setPulseTarget({
      projectId: entry.projectId,
      diagramId: entry.diagramId,
      nodeId: entry.nodeId,
    });
    setRecent((prev) => {
      const next = [query, ...prev.filter((q) => q !== query)].slice(0, 10);
      if (query.trim()) localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
    setOpen(false);
    setQuery("");
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-[20%] z-50 w-[640px] max-w-[90vw] -translate-x-1/2 overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-2xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Dialog.Title className="sr-only">Search palette</Dialog.Title>
          <Command label="Search palette" shouldFilter={false}>
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search nodes by name, tag, description…"
              className="w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              {!index && (
                <div className="p-4 text-sm text-muted-foreground">Loading…</div>
              )}

              {index && results.length === 0 && (
                <Command.Empty className="p-4 text-sm text-muted-foreground">
                  No results.
                </Command.Empty>
              )}

              {!query.trim() && recent.length > 0 && (
                <Command.Group heading="Recent" className="px-2 py-1 text-xs text-muted-foreground">
                  {recent.map((r) => (
                    <Command.Item
                      key={r}
                      value={`recent-${r}`}
                      onSelect={() => setQuery(r)}
                      className="cursor-pointer rounded-sm px-2 py-1 text-sm text-foreground aria-selected:bg-accent"
                    >
                      {r}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {Object.entries(groupedByProject).map(([pid, entries]) => (
                <Command.Group
                  key={pid}
                  heading={projectNameById[pid] ?? pid}
                  className="px-2 py-1 text-xs text-muted-foreground"
                >
                  {entries.map((e) => (
                    <Command.Item
                      key={`${e.projectId}:${e.diagramId}:${e.nodeId}`}
                      value={`${e.projectId}:${e.diagramId}:${e.nodeId}`}
                      onSelect={() => select(e)}
                      className="cursor-pointer rounded-sm px-2 py-1.5 text-sm text-foreground aria-selected:bg-accent"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{e.name}</span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {e.kind} · {e.diagramId}
                        </span>
                      </div>
                      {e.description && (
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {e.description}
                        </div>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
