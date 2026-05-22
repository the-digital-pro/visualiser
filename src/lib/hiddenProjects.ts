/**
 * "Hidden" projects (editor-only).
 *
 * Bundled projects (those in the manifest) ship as JSON files inside the
 * built bundle, so they can't be truly deleted from the browser. To let the
 * user remove them from their home view we maintain a localStorage set of
 * hidden project ids. The home screen filters bundled projects through this
 * set; a "Show all" affordance restores them.
 *
 * Local-only drafts are deleted outright via `clearDraft` — they don't need
 * this mechanism.
 */

const KEY = "arcviz:hidden-projects";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch {
    /* ignore quota / private-mode failures */
  }
}

export function listHiddenProjects(): string[] {
  return read();
}

export function hideProject(id: string): void {
  write([...read(), id]);
}

export function unhideProject(id: string): void {
  write(read().filter((x) => x !== id));
}

export function clearHiddenProjects(): void {
  write([]);
}
