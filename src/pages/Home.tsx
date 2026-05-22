import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  Eye,
  FileBox,
  FileUp,
  Folder,
  Layers,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { ManifestSchema, ProjectInputSchema, type Manifest } from "@/lib/schema";
import { navigation } from "@/lib/navigation";

const EDITOR_ENABLED = import.meta.env.VITE_EDITOR_ENABLED !== "false";

// Tree-shaken in the present-only build — the lazy() targets are unreachable
// when EDITOR_ENABLED is false, so the dialogs + their deps don't ship.
const NewProjectDialog = EDITOR_ENABLED
  ? lazy(() =>
      import("@/components/editor/NewProjectDialog").then((m) => ({
        default: m.NewProjectDialog,
      })),
    )
  : null;
const ImportProjectDialog = EDITOR_ENABLED
  ? lazy(() =>
      import("@/components/editor/ImportProjectDialog").then((m) => ({
        default: m.ImportProjectDialog,
      })),
    )
  : null;

interface ProjectStats {
  diagrams: number;
  tours: number;
}

interface DraftOverlay {
  name?: string;
  description?: string;
  owners?: string[];
  tags?: string[];
  hasDraft: boolean;
}

interface LocalDraft {
  id: string;
  name: string;
  savedAt: number;
}

export function Home() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [stats, setStats] = useState<Record<string, ProjectStats>>({});
  const [overlays, setOverlays] = useState<Record<string, DraftOverlay>>({});
  const [localDrafts, setLocalDrafts] = useState<LocalDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const refreshHidden = useCallback(async () => {
    if (!EDITOR_ENABLED) {
      setHidden(new Set());
      return;
    }
    const { listHiddenProjects } = await import("@/lib/hiddenProjects");
    setHidden(new Set(listHiddenProjects()));
  }, []);

  // Read draft metadata for each bundled project and overlay it on the card.
  // Re-runs on `storage` events so edits in another tab (or made after this
  // page mounted) surface live without a full page reload.
  const refreshOverlays = useCallback(async (projectIds: string[]) => {
    if (!EDITOR_ENABLED) {
      setOverlays({});
      return;
    }
    const { readDraft } = await import("@/lib/drafts");
    const next: Record<string, DraftOverlay> = {};
    for (const id of projectIds) {
      const env = readDraft(id);
      if (!env) continue;
      try {
        const proj = JSON.parse(env.json) as {
          name?: string;
          description?: string;
          owners?: string[];
          tags?: string[];
        };
        next[id] = {
          name: typeof proj.name === "string" ? proj.name : undefined,
          description:
            typeof proj.description === "string" ? proj.description : undefined,
          owners: Array.isArray(proj.owners) ? proj.owners : undefined,
          tags: Array.isArray(proj.tags) ? proj.tags : undefined,
          hasDraft: true,
        };
      } catch {
        // Broken JSON — skip; the user's editor will surface the issue.
      }
    }
    setOverlays(next);
  }, []);

  // Discover local-only drafts (editor builds only). Re-runs whenever the
  // dialog closes so a freshly-created project surfaces immediately.
  const refreshDrafts = useCallback(async () => {
    if (!EDITOR_ENABLED) return;
    const { summariseDrafts } = await import("@/lib/drafts");
    const summaries = summariseDrafts();
    const live = summaries.flatMap((s) =>
      "broken" in s ? [] : [{ id: s.id, name: s.name, savedAt: s.savedAt }],
    );
    setLocalDrafts(live);
  }, []);

  useEffect(() => {
    fetch("/projects/manifest.json")
      .then((r) => r.json())
      .then(async (data) => {
        const result = ManifestSchema.safeParse(data);
        if (!result.success) {
          setError(`manifest.json failed schema validation: ${result.error.message}`);
          return;
        }
        setManifest(result.data);
        const perProject = await Promise.all(
          result.data.projects.map(async (p) => {
            const r = await fetch(`/projects/${p.id}.json`).then((res) => res.json());
            const parsed = ProjectInputSchema.safeParse(r);
            if (!parsed.success) {
              return [p.id, { diagrams: 0, tours: 0 }] as const;
            }
            return [
              p.id,
              {
                diagrams: parsed.data.diagrams.length,
                tours: (parsed.data.tours ?? []).length,
              },
            ] as const;
          }),
        );
        setStats(Object.fromEntries(perProject));
        refreshOverlays(result.data.projects.map((p) => p.id));
      })
      .catch((e: Error) => setError(`failed to load manifest: ${e.message}`));
    refreshDrafts();
    refreshHidden();
  }, [refreshDrafts, refreshOverlays, refreshHidden]);

  // Pick up draft edits made in another tab or while this page is mounted.
  useEffect(() => {
    if (!EDITOR_ENABLED || !manifest) return;
    const onStorage = (e: StorageEvent) => {
      if (!e.key || !e.key.startsWith("arcviz:draft:")) return;
      refreshOverlays(manifest.projects.map((p) => p.id));
      refreshDrafts();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [manifest, refreshOverlays, refreshDrafts]);

  const takenIds = useMemo(() => {
    const s = new Set<string>();
    manifest?.projects.forEach((p) => s.add(p.id));
    localDrafts.forEach((d) => s.add(d.id));
    return s;
  }, [manifest, localDrafts]);

  // Hide drafts that ARE in the manifest — those are edit-in-progress copies
  // of bundled projects and are surfaced via the project card itself.
  const localOnlyDrafts = useMemo(() => {
    const manifestIds = new Set(manifest?.projects.map((p) => p.id) ?? []);
    return localDrafts.filter((d) => !manifestIds.has(d.id));
  }, [localDrafts, manifest]);

  const exportDraft = async (id: string) => {
    const { readDraft } = await import("@/lib/drafts");
    const env = readDraft(id);
    if (!env) return;
    const blob = new Blob([env.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteDraft = async (id: string) => {
    if (!confirm(`Delete the local draft "${id}"? Export the JSON first if you want to keep it.`)) return;
    const { clearDraft } = await import("@/lib/drafts");
    clearDraft(id);
    refreshDrafts();
  };

  // Hide a bundled project from the home view + clear any local draft for
  // it. Bundled JSON lives on disk so we can't truly delete it from the
  // browser — hide + clear is the closest we get. Reversible via "Show all".
  const deleteProject = async (id: string, name: string) => {
    if (
      !confirm(
        `Delete "${name}" from your home? The bundled JSON stays on disk, but the card will be hidden and any local draft cleared. Use "Show all hidden" to restore it later.`,
      )
    )
      return;
    const { hideProject } = await import("@/lib/hiddenProjects");
    const { clearDraft } = await import("@/lib/drafts");
    hideProject(id);
    clearDraft(id);
    refreshHidden();
    refreshDrafts();
    refreshOverlays(manifest?.projects.map((p) => p.id) ?? []);
  };

  const restoreHidden = async () => {
    const { clearHiddenProjects } = await import("@/lib/hiddenProjects");
    clearHiddenProjects();
    refreshHidden();
  };

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm">
        {error}
      </div>
    );
  }

  if (!manifest) {
    return <div className="text-muted-foreground">Loading projects…</div>;
  }

  const visibleProjects = manifest.projects.filter((p) => !hidden.has(p.id));
  const projectCount = visibleProjects.length;
  const hiddenCount = hidden.size;

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 px-4 pb-10 pt-4">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-background to-background px-6 py-8 sm:px-10 sm:py-12">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" aria-hidden />
        <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Architecture Visualizer
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Welcome back.
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Pick a project to start exploring — drill into containers and
              follow service edges across project boundaries. Press{" "}
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
                ⌘K
              </kbd>{" "}
              any time to search every diagram at once.
            </p>
          </div>
          {EDITOR_ENABLED && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3.5 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
              >
                <FileUp className="h-4 w-4" /> Import project
              </button>
              <button
                type="button"
                onClick={() => setNewOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" /> New project
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Projects</h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {EDITOR_ENABLED && hiddenCount > 0 && (
              <button
                type="button"
                onClick={restoreHidden}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 hover:bg-accent"
                title="Restore hidden projects"
              >
                <Eye className="h-3 w-3" />
                Show {hiddenCount} hidden
              </button>
            )}
            <span>
              {projectCount} {projectCount === 1 ? "project" : "projects"}
            </span>
          </div>
        </div>
        {projectCount === 0 ? (
          <div className="text-muted-foreground">
            {hiddenCount > 0
              ? `All projects are hidden. Click "Show ${hiddenCount} hidden" above to restore them.`
              : "No bundled projects."}
          </div>
        ) : (
          <ul className="grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProjects.map((p) => {
              const s = stats[p.id];
              const overlay = overlays[p.id];
              // Draft fields override the published manifest field; an explicit
              // empty array in the draft is treated as "user cleared it".
              const name = overlay?.name ?? p.name;
              const description = overlay?.description ?? p.description;
              const owners = overlay?.owners ?? p.owners;
              const tags = overlay?.tags ?? p.tags;
              return (
                <li key={p.id} className="group relative pt-3">
                  {/* Folder tab */}
                  <div
                    aria-hidden
                    className="absolute left-5 top-0 z-0 h-4 w-28 rounded-t-lg border border-b-0 border-border bg-card transition-transform group-hover:-translate-y-0.5"
                  />
                  {/* Stacked-paper edge */}
                  <div
                    aria-hidden
                    className="absolute inset-x-3 -bottom-1 h-1 rounded-b-lg border border-t-0 border-border/60 bg-card/60"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-x-2 -bottom-2 h-1 rounded-b-lg border border-t-0 border-border/40 bg-card/40"
                  />
                  {EDITOR_ENABLED && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProject(p.id, name);
                      }}
                      className="absolute right-2 top-5 z-20 rounded-md border border-transparent bg-card/80 p-1 text-muted-foreground opacity-0 transition-opacity hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Delete ${name}`}
                      title="Delete from home"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      navigation().push({
                        projectId: p.id,
                        diagramId: p.homeDiagramId,
                      })
                    }
                    className="relative z-10 flex h-full w-full flex-col gap-3 rounded-lg rounded-tl-none border border-border bg-card p-5 text-left shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:bg-accent/40 group-hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                        <Folder className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="truncate font-medium">{name}</div>
                          {overlay?.hasDraft && (
                            <span
                              className="shrink-0 rounded-sm border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300"
                              title="You have unpublished edits in your local draft."
                            >
                              Draft
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Layers className="h-3 w-3" />
                            {s ? `${s.diagrams} diagram${s.diagrams === 1 ? "" : "s"}` : "…"}
                          </span>
                          {s && s.tours > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Play className="h-3 w-3" />
                              {s.tours} tour{s.tours === 1 ? "" : "s"}
                            </span>
                          )}
                          {owners && owners.length > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {owners[0]}
                              {owners.length > 1 && ` +${owners.length - 1}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {description && (
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        {description}
                      </p>
                    )}
                    {tags && tags.length > 0 && (
                      <div className="mt-auto flex flex-wrap gap-1 pt-1">
                        {tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-sm bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {EDITOR_ENABLED && localOnlyDrafts.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Local drafts</h2>
            <span className="text-xs text-muted-foreground">
              In browser storage only — export to JSON to publish.
            </span>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {localOnlyDrafts.map((d) => (
              <li
                key={d.id}
                className="flex items-start gap-3 rounded-md border border-dashed border-border p-4"
              >
                <FileBox className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{d.name}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {d.id} · saved {new Date(d.savedAt).toLocaleString()}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Link
                      to={`/edit/p/${d.id}/d/context`}
                      className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Open editor
                    </Link>
                    <button
                      type="button"
                      onClick={() => exportDraft(d.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] hover:bg-accent"
                    >
                      <Download className="h-3 w-3" /> Export JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteDraft(d.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-destructive hover:bg-destructive/10"
                      aria-label={`Delete local draft ${d.id}`}
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {EDITOR_ENABLED && NewProjectDialog && (
        <Suspense fallback={null}>
          <NewProjectDialog
            open={newOpen}
            onOpenChange={(o) => {
              setNewOpen(o);
              if (!o) refreshDrafts();
            }}
            takenIds={takenIds}
          />
        </Suspense>
      )}
      {EDITOR_ENABLED && ImportProjectDialog && (
        <Suspense fallback={null}>
          <ImportProjectDialog
            open={importOpen}
            onOpenChange={(o) => {
              setImportOpen(o);
              if (!o && manifest) {
                refreshDrafts();
                refreshOverlays(manifest.projects.map((p) => p.id));
              }
            }}
            manifestIds={
              new Set(manifest?.projects.map((p) => p.id) ?? [])
            }
            draftIds={new Set(localDrafts.map((d) => d.id))}
          />
        </Suspense>
      )}
    </div>
  );
}
