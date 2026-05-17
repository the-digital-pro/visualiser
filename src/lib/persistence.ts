import type {
  Diagram,
  DiagramInput,
  Edge,
  EdgeInput,
  Node,
  NodeInput,
  Project,
  ProjectInput,
} from "./schema";

/**
 * Canonical serializer (ADR-0004).
 *
 * Single producer of project JSON for: draft autosave, export, FS Access write,
 * format conversions. Deterministic so that round-trip (parse → serialize) of an
 * unmodified seed file is byte-identical.
 *
 * Contract:
 *   - Object keys appear in the order defined by `canonicalize*` below.
 *   - `undefined` fields are omitted (not emitted as `null`).
 *   - JSON indented with 2 spaces.
 *   - File ends with a single trailing newline.
 *   - Arrays preserve input order (no implicit sorting).
 */

type AnyProject = Project | ProjectInput;
type AnyDiagram = Diagram | DiagramInput;
type AnyNode = Node | NodeInput;
type AnyEdge = Edge | EdgeInput;

const set = <T, K extends string>(
  obj: Record<K, T>,
  key: K,
  value: T | undefined,
): void => {
  if (value !== undefined) {
    obj[key] = value;
  }
};

function canonicalNode(node: AnyNode): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  out.id = node.id;
  out.kind = node.kind;
  out.name = node.name;
  set(out, "description", node.description);
  set(out, "parentId", node.parentId);
  set(out, "childDiagramId", node.childDiagramId);
  set(out, "tags", node.tags);
  set(out, "position", node.position);
  set(out, "metadata", node.metadata);
  return out;
}

function canonicalEdge(edge: AnyEdge): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  out.id = edge.id;
  out.source = edge.source;
  set(out, "target", edge.target);
  set(out, "targetRef", edge.targetRef);
  out.type = edge.type;
  set(out, "label", edge.label);
  set(out, "tags", edge.tags);
  set(out, "metadata", edge.metadata);
  return out;
}

function canonicalDiagram(diagram: AnyDiagram): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  out.id = diagram.id;
  out.name = diagram.name;
  set(out, "description", diagram.description);
  out.nodes = diagram.nodes.map(canonicalNode);
  out.edges = diagram.edges.map(canonicalEdge);
  return out;
}

function canonicalTour(tour: { id: string; name: string; description?: string; stops: { ref: string; note: string }[] }): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  out.id = tour.id;
  out.name = tour.name;
  set(out, "description", tour.description);
  out.stops = tour.stops.map((s) => ({ ref: s.ref, note: s.note }));
  return out;
}

function canonicalProject(project: AnyProject): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  out.schemaVersion = project.schemaVersion;
  out.id = project.id;
  out.name = project.name;
  set(out, "description", project.description);
  set(out, "owners", project.owners);
  set(out, "tags", project.tags);
  out.homeDiagramId = project.homeDiagramId;
  out.diagrams = project.diagrams.map(canonicalDiagram);
  if (project.tours !== undefined) {
    out.tours = project.tours.map(canonicalTour);
  }
  return out;
}

export function serializeProject(project: AnyProject): string {
  return JSON.stringify(canonicalProject(project), null, 2) + "\n";
}

/**
 * Stable content hash of a serialized project. Used by manifest emission and
 * draft/manifest conflict detection (ADR-0004).
 */
export async function hashProject(serialized: string): Promise<string> {
  const data = new TextEncoder().encode(serialized);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}
