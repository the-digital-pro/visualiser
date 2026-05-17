import { hashProject, serializeProject } from "./persistence";
import { loadProject, type LoadResult } from "./loader";
import type { Project } from "./schema";
import { useStore } from "./store";

/**
 * Draft persistence (ADR-0004).
 *
 * Editor open compares the draft's recorded source hash against the manifest's
 * current hash and shows a non-blocking banner on mismatch — NEVER auto-merge.
 *
 * Present mode never reads localStorage at all (the `EDITOR_ENABLED` gate
 * ensures even the import boundary doesn't reach in there in the consumer
 * build).
 *
 * Storage layout — one key per project, value is a JSON envelope so we can
 * version + hash without polluting the canonical project JSON itself:
 *
 *   localStorage["arcviz:draft:<projectId>"] = {
 *     v: 1,
 *     sourceHash: "...",   // manifest hash at the time the draft was first started
 *     savedAt: 1700000000,
 *     json: "...",         // canonical project JSON (the byte-identical thing)
 *   }
 */

const KEY = (projectId: string) => `arcviz:draft:${projectId}`;
const ENVELOPE_VERSION = 1;

export interface DraftEnvelope {
  v: number;
  sourceHash: string;
  savedAt: number;
  json: string;
}

/** Synchronous save — invoked on every commit. */
export function saveDraft(projectId: string, project: Project): void {
  if (typeof window === "undefined") return;
  const existing = readDraft(projectId);
  // On first save, stamp the current bundled hash so future sessions can
  // detect a hash conflict (ADR-0004). If the bundled hash isn't known yet
  // (loader hasn't finished), fall back to "<unknown>" — the loader will
  // upgrade it once it knows.
  const status = useStore.getState().projectStatus[projectId];
  const sourceHash =
    existing?.sourceHash && existing.sourceHash !== "<unknown>"
      ? existing.sourceHash
      : status?.bundledHash ?? "<unknown>";
  const envelope: DraftEnvelope = {
    v: ENVELOPE_VERSION,
    sourceHash,
    savedAt: Date.now(),
    json: serializeProject(project),
  };
  try {
    localStorage.setItem(KEY(projectId), JSON.stringify(envelope));
  } catch {
    // Quota or private-mode storage failures are non-fatal — undo still works
    // in memory; the next successful save will catch up.
  }
}

/** Set the recorded sourceHash for a project. Called on first editor open. */
export function recordSourceHash(projectId: string, sourceHash: string): void {
  if (typeof window === "undefined") return;
  const existing = readDraft(projectId);
  if (!existing) return;
  const envelope: DraftEnvelope = { ...existing, sourceHash };
  try {
    localStorage.setItem(KEY(projectId), JSON.stringify(envelope));
  } catch {
    // ignore
  }
}

export function readDraft(projectId: string): DraftEnvelope | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== ENVELOPE_VERSION || typeof parsed.json !== "string") {
      return null;
    }
    return parsed as DraftEnvelope;
  } catch {
    return null;
  }
}

export function clearDraft(projectId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY(projectId));
  } catch {
    // ignore
  }
}

/**
 * Enumerate the IDs of every draft currently in localStorage. Editor-only
 * surface — the present-only build never calls this.
 */
export function listDraftIds(): string[] {
  if (typeof window === "undefined") return [];
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith("arcviz:draft:") && !key.includes(":meta")) {
        out.push(key.slice("arcviz:draft:".length));
      }
    }
  } catch {
    // ignore
  }
  return out;
}

export interface DraftSummary {
  id: string;
  name: string;
  savedAt: number;
  sourceHash: string;
}

/**
 * Build a list-friendly summary for every local draft. Returns `null` for an
 * entry whose JSON couldn't be parsed (so the caller can decide whether to
 * silently skip or surface a repair affordance).
 */
export function summariseDrafts(): (DraftSummary | { id: string; broken: true })[] {
  return listDraftIds().map((id) => {
    const env = readDraft(id);
    if (!env) return { id, broken: true as const };
    try {
      const project = JSON.parse(env.json) as { name?: string };
      return {
        id,
        name: typeof project.name === "string" ? project.name : id,
        savedAt: env.savedAt,
        sourceHash: env.sourceHash,
      };
    } catch {
      return { id, broken: true as const };
    }
  });
}

/**
 * Load a draft from localStorage and validate it through the same loader the
 * bundled fetcher uses. Result includes hash-conflict info for the banner.
 */
export interface DraftLoadResult {
  result: LoadResult;
  draftHash: string;
  sourceHashAtDraft: string;
  savedAt: number;
}

export async function loadDraft(projectId: string): Promise<DraftLoadResult | null> {
  const envelope = readDraft(projectId);
  if (!envelope) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(envelope.json);
  } catch {
    return null;
  }
  const result = loadProject(raw);
  const draftHash = await hashProject(envelope.json);
  return {
    result,
    draftHash,
    sourceHashAtDraft: envelope.sourceHash,
    savedAt: envelope.savedAt,
  };
}
