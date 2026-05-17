import type { Project } from "./schema";
import { HISTORY_CAP, useStore } from "./store";
import { saveDraft } from "./drafts";

/**
 * Snapshot-based undo/redo (ADR-0009).
 *
 *   commit(projectId, mutator)   atomic operation — captures the pre-state,
 *                                applies the mutator, pushes the pre-state to
 *                                history.past, clears future, autosaves.
 *
 *   beginTransient(projectId)    capture the pre-state on first call in a
 *                                burst. No-op if already captured.
 *
 *   applyTransient(p, mutator)   apply a mutation without committing. Used by
 *                                form onChange handlers and drag callbacks.
 *
 *   commitTransient(projectId)   end of a burst — push the captured pre-state
 *                                to past, clear pendingBefore, autosave.
 *
 *   undo() / redo()              swap project ↔ past/future top.
 *
 * Autosave shares the commit boundary by design (ADR-0004 + ADR-0009) — one
 * commit = one undo entry = one localStorage write.
 */

function pushPast(past: Project[], snapshot: Project): Project[] {
  const next = [...past, snapshot];
  if (next.length > HISTORY_CAP) {
    return next.slice(next.length - HISTORY_CAP);
  }
  return next;
}

export const editor = {
  commit(projectId: string, mutator: (p: Project) => Project): void {
    const s = useStore.getState();
    const before = s.projects[projectId];
    if (!before) return;
    const after = mutator(before);
    if (after === before) return;
    useStore.setState({
      projects: { ...s.projects, [projectId]: after },
      history: {
        past: pushPast(s.history.past, before),
        future: [],
      },
      pendingBefore: null,
    });
    saveDraft(projectId, after);
  },

  beginTransient(projectId: string): void {
    const s = useStore.getState();
    if (s.pendingBefore) return;
    const current = s.projects[projectId];
    if (!current) return;
    useStore.setState({ pendingBefore: current });
  },

  applyTransient(projectId: string, mutator: (p: Project) => Project): void {
    const s = useStore.getState();
    const current = s.projects[projectId];
    if (!current) return;
    const next = mutator(current);
    if (next === current) return;
    useStore.setState({
      projects: { ...s.projects, [projectId]: next },
      pendingBefore: s.pendingBefore ?? current,
    });
  },

  commitTransient(projectId: string): void {
    const s = useStore.getState();
    const before = s.pendingBefore;
    if (!before) return;
    const current = s.projects[projectId];
    if (!current || current === before) {
      useStore.setState({ pendingBefore: null });
      return;
    }
    useStore.setState({
      history: {
        past: pushPast(s.history.past, before),
        future: [],
      },
      pendingBefore: null,
    });
    saveDraft(projectId, current);
  },

  undo(projectId: string): void {
    const s = useStore.getState();
    if (s.history.past.length === 0) return;
    const current = s.projects[projectId];
    if (!current) return;
    const previous = s.history.past[s.history.past.length - 1];
    useStore.setState({
      projects: { ...s.projects, [projectId]: previous },
      history: {
        past: s.history.past.slice(0, -1),
        future: [...s.history.future, current],
      },
      pendingBefore: null,
    });
    saveDraft(projectId, previous);
  },

  redo(projectId: string): void {
    const s = useStore.getState();
    if (s.history.future.length === 0) return;
    const current = s.projects[projectId];
    if (!current) return;
    const next = s.history.future[s.history.future.length - 1];
    useStore.setState({
      projects: { ...s.projects, [projectId]: next },
      history: {
        past: [...s.history.past, current],
        future: s.history.future.slice(0, -1),
      },
      pendingBefore: null,
    });
    saveDraft(projectId, next);
  },
};

// ──────────────────────────────────────────────────────────────────────────
// Pure history helpers — exported for testing without store coupling.
// ──────────────────────────────────────────────────────────────────────────
export const __history = {
  pushPast,
  cap: HISTORY_CAP,
};
