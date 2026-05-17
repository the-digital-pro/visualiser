import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileBox, Play, Plus, Trash2 } from "lucide-react";
import { ManifestSchema, ProjectInputSchema, type Manifest } from "@/lib/schema";
import { navigation } from "@/lib/navigation";

const EDITOR_ENABLED = import.meta.env.VITE_EDITOR_ENABLED !== "false";

// Tree-shaken in the present-only build — the lazy() target is unreachable
// when EDITOR_ENABLED is false, so the dialog + its deps don't ship.
const NewProjectDialog = EDITOR_ENABLED
  ? lazy(() =>
      import("@/components/editor/NewProjectDialog").then((m) => ({
        default: m.NewProjectDialog,
      })),
    )
  : null;

interface TourSummary {
  projectId: string;
  tourId: string;
  name: string;
  description?: string;
  stops: number;
}

interface LocalDraft {
  id: string;
  name: string;
  savedAt: number;
}

export function Home() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [tours, setTours] = useState<TourSummary[]>([]);
  const [localDrafts, setLocalDrafts] = useState<LocalDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  // Discover local drafts (editor builds only). Re-runs whenever the dialog
  // closes so a freshly-created project surfaces immediately.
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
        const summaries = await Promise.all(
          result.data.projects.map(async (p) => {
            const r = await fetch(`/projects/${p.id}.json`).then((res) => res.json());
            const parsed = ProjectInputSchema.safeParse(r);
            if (!parsed.success) return [];
            return (parsed.data.tours ?? []).map(
              (t): TourSummary => ({
                projectId: p.id,
                tourId: t.id,
                name: t.name,
                description: t.description,
                stops: t.stops.length,
              }),
            );
          }),
        );
        setTours(summaries.flat());
      })
      .catch((e: Error) => setError(`failed to load manifest: ${e.message}`));
    refreshDrafts();
  }, [refreshDrafts]);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Click a project to enter its home diagram.{" "}
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-xs">⌘K</kbd> opens search across all projects.
          </p>
        </div>
        {EDITOR_ENABLED && (
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New project
          </button>
        )}
      </div>

      {manifest.projects.length === 0 ? (
        <div className="text-muted-foreground">No bundled projects.</div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {manifest.projects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() =>
                  navigation().push({
                    projectId: p.id,
                    diagramId: p.homeDiagramId,
                  })
                }
                className="block w-full rounded-md border border-border p-4 text-left transition-colors hover:bg-accent"
              >
                <div className="font-medium">{p.name}</div>
                {p.description && (
                  <div className="mt-1 text-sm text-muted-foreground">{p.description}</div>
                )}
                {p.tags && p.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.tags.map((t) => (
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
          ))}
        </ul>
      )}

      {EDITOR_ENABLED && localOnlyDrafts.length > 0 && (
        <section className="space-y-3 pt-2">
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

      {tours.length > 0 && (
        <section className="space-y-3 pt-2">
          <h2 className="text-lg font-semibold tracking-tight">Guided tours</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {tours.map((t) => (
              <li key={`${t.projectId}-${t.tourId}`}>
                <Link
                  to={`/tour/${t.projectId}/${t.tourId}?step=1`}
                  className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
                >
                  <Play className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="font-medium">{t.name}</div>
                    {t.description && (
                      <div className="mt-1 text-sm text-muted-foreground">
                        {t.description}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t.stops} stop{t.stops === 1 ? "" : "s"} · starts in {t.projectId}
                    </div>
                  </div>
                </Link>
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
    </div>
  );
}
