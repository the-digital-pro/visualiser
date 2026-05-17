import { create } from "zustand";
import type { Project } from "./schema";
import type { Frame } from "./url";
import type { ValidationIssue } from "./loader";

/**
 * Zustand store.
 *
 * INVARIANT (ADR-0007): `projects` ONLY holds validated `Project` objects.
 * Loader must validate via Zod before writing.
 */

export interface Selection {
  nodeId?: string;
  edgeId?: string;
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface ProjectLoadStatus {
  state: "loading" | "loaded" | "error";
  error?: string;
  issues?: ValidationIssue[];
  bundledHash?: string;
  source?: "bundled" | "draft";
  draftConflictHash?: string;
}

export interface History {
  past: Project[];
  future: Project[];
}

export const HISTORY_CAP = 50;

export interface AppState {
  projects: Record<string, Project>;
  projectStatus: Record<string, ProjectLoadStatus>;

  navStack: Frame[];
  selection: Selection | null;
  viewportsByDiagram: Record<string, ViewportState>;
  pulseTarget: { projectId: string; diagramId: string; nodeId: string } | null;

  // Editor state — only mutated under /edit/* (ADR-0009).
  editingProjectId: string | null;
  history: History;
  /** Pre-edit snapshot captured at the start of a "burst" (focus / drag-start). */
  pendingBefore: Project | null;
}

export const useStore = create<AppState>(() => ({
  projects: {},
  projectStatus: {},
  navStack: [],
  selection: null,
  viewportsByDiagram: {},
  pulseTarget: null,
  editingProjectId: null,
  history: { past: [], future: [] },
  pendingBefore: null,
}));

// Dev: expose store + canonical serializer on window for in-browser debugging
// and e2e tests. Stripped by Vite in production because import.meta.env.DEV
// resolves to a literal.
if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as unknown as { __arcvizStore: typeof useStore }).__arcvizStore = useStore;
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  import("./persistence").then((m) => {
    (window as unknown as { __arcvizSerialize: typeof m.serializeProject }).__arcvizSerialize =
      m.serializeProject;
  });
}

export const storeActions = {
  // ── project lifecycle ─────────────────────────────────────────────────
  setProjectLoading(projectId: string): void {
    useStore.setState((s) => ({
      projectStatus: { ...s.projectStatus, [projectId]: { state: "loading" } },
    }));
  },

  setProjectLoaded(
    projectId: string,
    project: Project,
    issues: ValidationIssue[] = [],
    extra: Partial<ProjectLoadStatus> = {},
  ): void {
    useStore.setState((s) => ({
      projects: { ...s.projects, [projectId]: project },
      projectStatus: {
        ...s.projectStatus,
        [projectId]: { state: "loaded", issues, ...extra },
      },
    }));
  },

  setProjectError(projectId: string, error: string, issues: ValidationIssue[] = []): void {
    useStore.setState((s) => ({
      projectStatus: {
        ...s.projectStatus,
        [projectId]: { state: "error", error, issues },
      },
    }));
  },

  /** Replace the project with a fresh canonical shape (e.g., after import). */
  replaceProject(projectId: string, project: Project): void {
    useStore.setState((s) => ({
      projects: { ...s.projects, [projectId]: project },
    }));
  },

  setSelection(selection: Selection | null): void {
    useStore.setState({ selection });
  },

  setViewport(projectId: string, diagramId: string, viewport: ViewportState): void {
    const key = `${projectId}:${diagramId}`;
    useStore.setState((s) => ({
      viewportsByDiagram: { ...s.viewportsByDiagram, [key]: viewport },
    }));
  },

  setPulseTarget(
    target: { projectId: string; diagramId: string; nodeId: string } | null,
  ): void {
    useStore.setState({ pulseTarget: target });
  },

  /** Imperative setter — for the tour player, which drives the stack without a
   * matching URL change. Avoid elsewhere; prefer NavigationController. */
  setNavStack(stack: import("./url").Frame[]): void {
    useStore.setState({ navStack: stack });
  },

  // ── editor lifecycle (ADR-0009) ───────────────────────────────────────
  setEditingProject(projectId: string | null): void {
    useStore.setState((s) =>
      s.editingProjectId === projectId
        ? {}
        : {
            editingProjectId: projectId,
            history: { past: [], future: [] },
            pendingBefore: null,
          },
    );
  },

  resetHistory(): void {
    useStore.setState({
      history: { past: [], future: [] },
      pendingBefore: null,
    });
  },
};

export function viewportKey(projectId: string, diagramId: string): string {
  return `${projectId}:${diagramId}`;
}
