import { fetchProject } from "./loader";
import { storeActions, useStore } from "./store";

/**
 * Module-level in-flight tracker — survives component re-renders and React
 * StrictMode's double-mount. Without this, the dev-mode double effect kicks
 * off duplicate fetches that race the store updates.
 */
const inFlight = new Set<string>();

export function ensureProjectLoaded(projectId: string): void {
  const state = useStore.getState();
  if (state.projects[projectId]) return;
  if (inFlight.has(projectId)) return;
  inFlight.add(projectId);
  storeActions.setProjectLoading(projectId);
  fetchProject(projectId)
    .then((result) => {
      inFlight.delete(projectId);
      if (result.ok) {
        storeActions.setProjectLoaded(projectId, result.project, result.issues);
      } else {
        storeActions.setProjectError(
          projectId,
          result.issues.map((i) => `${i.path}: ${i.message}`).join("\n"),
          result.issues,
        );
      }
    })
    .catch((e: Error) => {
      inFlight.delete(projectId);
      storeActions.setProjectError(projectId, e.message);
    });
}

let manifestLoaded = false;

export function ensureManifestPreloaded(): void {
  if (manifestLoaded) return;
  manifestLoaded = true;
  fetch("/projects/manifest.json")
    .then((r) => r.json())
    .then((m: { projects: { id: string }[] }) => {
      for (const p of m.projects) {
        ensureProjectLoaded(p.id);
      }
    })
    .catch(() => {
      manifestLoaded = false;
    });
}
