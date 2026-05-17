/**
 * URL ↔ frame codec (ADR-0003).
 *
 * The URL only encodes the CURRENT frame (one node in NavigationController's
 * stack). The full back/forward stack lives in `window.history.state` and is
 * managed by NavigationController. This module is the only place that knows
 * how to translate between URL shape and frame shape.
 *
 * Route patterns (PRD §6.3):
 *   /                                            → no frame
 *   /p/:projectId                                → { projectId }
 *   /p/:projectId/d/:diagramId                   → { projectId, diagramId }
 *   /p/:projectId/d/:diagramId?focus=:nodeId     → { projectId, diagramId, focusNodeId }
 *
 * `?filter=...` is preserved verbatim in `extraSearch` so Phase 1 plumbing can
 * round-trip filter state without this codec needing to know its shape.
 */

export interface Frame {
  projectId: string;
  diagramId?: string;
  focusNodeId?: string;
}

export interface DecodedLocation {
  frame: Frame | null;
  filter: string | null;
}

export function encodeFrame(frame: Frame, filter?: string | null, edit = false): string {
  const segments = ["", ...(edit ? ["edit"] : []), "p", encodeURIComponent(frame.projectId)];
  if (frame.diagramId) {
    segments.push("d", encodeURIComponent(frame.diagramId));
  }
  const path = segments.join("/");
  const params = new URLSearchParams();
  if (frame.focusNodeId) {
    params.set("focus", frame.focusNodeId);
  }
  if (filter) {
    params.set("filter", filter);
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export function decodeLocation(pathname: string, search: string): DecodedLocation {
  // `/edit/p/...` is the editor surface for the same frame shape.
  const parts = pathname.replace(/^\/edit\//, "/").split("/").filter(Boolean);
  if (parts.length === 0 || parts[0] !== "p" || !parts[1]) {
    return { frame: null, filter: null };
  }
  const frame: Frame = { projectId: decodeURIComponent(parts[1]) };
  if (parts[2] === "d" && parts[3]) {
    frame.diagramId = decodeURIComponent(parts[3]);
  }
  const params = new URLSearchParams(search);
  const focus = params.get("focus");
  if (focus) {
    frame.focusNodeId = focus;
  }
  return { frame, filter: params.get("filter") };
}

export function framesEqual(a: Frame | null, b: Frame | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.projectId === b.projectId &&
    a.diagramId === b.diagramId &&
    a.focusNodeId === b.focusNodeId
  );
}
