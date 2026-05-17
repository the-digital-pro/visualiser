import { storeActions, useStore } from "@/lib/store";
import { fetchProject } from "@/lib/loader";
import { ManifestSchema } from "@/lib/schema";
import { loadDraft, recordSourceHash } from "@/lib/drafts";

/**
 * Editor-only project loader.
 *
 *   1. Fetch manifest to know the bundled `sourceHash`.
 *   2. Fetch bundled JSON (used as the "publish" baseline and for reset).
 *   3. If a draft is present:
 *        - matching hash → silently load draft into store.
 *        - mismatched hash → load draft AND record the conflict on
 *          projectStatus.draftConflictHash so the UI banner can render.
 *      Else: load bundled.
 *   4. Whichever wins is what `projects[projectId]` holds.
 */
export async function loadProjectForEditor(projectId: string): Promise<void> {
  storeActions.setProjectLoading(projectId);
  try {
    const manifest = await fetch("/projects/manifest.json")
      .then((r) => r.json())
      .then((d) => ManifestSchema.parse(d));
    const entry = manifest.projects.find((p) => p.id === projectId);

    // Local-only project (no manifest entry): editor reads from localStorage
    // straight away. There's no bundle to compare against, so no conflict.
    if (!entry) {
      const draft = await loadDraft(projectId);
      if (!draft || !draft.result.ok) {
        storeActions.setProjectError(
          projectId,
          `Project "${projectId}" doesn't exist in the manifest or your local drafts. Create a new one from the home page.`,
        );
        return;
      }
      storeActions.setProjectLoaded(projectId, draft.result.project, draft.result.issues, {
        source: "draft",
      });
      return;
    }

    const bundled = await fetchProject(projectId);
    if (!bundled.ok) {
      storeActions.setProjectError(
        projectId,
        bundled.issues.map((i) => `${i.path}: ${i.message}`).join("\n"),
        bundled.issues,
      );
      return;
    }

    const draft = await loadDraft(projectId);
    if (draft && draft.result.ok) {
      const conflict = draft.sourceHashAtDraft !== entry.hash;
      storeActions.setProjectLoaded(projectId, draft.result.project, draft.result.issues, {
        bundledHash: entry.hash,
        source: "draft",
        draftConflictHash: conflict ? draft.sourceHashAtDraft : undefined,
      });
      // For a brand-new draft (sourceHash was "<unknown>"), stamp the current
      // manifest hash so the next session can detect conflicts.
      if (draft.sourceHashAtDraft === "<unknown>") {
        recordSourceHash(projectId, entry.hash);
      }
      return;
    }

    storeActions.setProjectLoaded(projectId, bundled.project, bundled.issues, {
      bundledHash: entry.hash,
      source: "bundled",
    });
    // Stamp the source hash so the first commit attaches the right hash.
    recordSourceHash(projectId, entry.hash);
  } catch (e) {
    storeActions.setProjectError(projectId, (e as Error).message);
  }
}

/**
 * Reset the editor's working copy to the bundled file. Wipes the draft.
 */
export async function resetToBundled(projectId: string): Promise<void> {
  const { clearDraft } = await import("@/lib/drafts");
  clearDraft(projectId);
  useStore.setState((s) => ({
    history: { past: [], future: [] },
    pendingBefore: null,
    projects: Object.fromEntries(
      Object.entries(s.projects).filter(([id]) => id !== projectId),
    ),
    projectStatus: Object.fromEntries(
      Object.entries(s.projectStatus).filter(([id]) => id !== projectId),
    ),
  }));
  await loadProjectForEditor(projectId);
}
