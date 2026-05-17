import type { NodeKind } from "./schema";

/**
 * URL filter syntax (PRD §6.3 + plan §1.11):
 *
 *   ?filter=kind:service,kind:datastore,tag:critical
 *
 * Multiple `kind:` and `tag:` tokens are OR'd within their group; the two
 * groups are AND'd against each other. An empty filter matches everything.
 *
 * The filter ONLY affects rendering — nodes/edges that don't match fade to
 * 30% opacity but are still selectable. This preserves spatial reference,
 * which matters for "where does this service live in the overall picture?"
 * questions.
 */

export interface ParsedFilter {
  kinds: NodeKind[];
  tags: string[];
}

export const EMPTY_FILTER: ParsedFilter = { kinds: [], tags: [] };

export function parseFilter(raw: string | null | undefined): ParsedFilter {
  if (!raw) return EMPTY_FILTER;
  const kinds: NodeKind[] = [];
  const tags: string[] = [];
  for (const token of raw.split(",").map((t) => t.trim()).filter(Boolean)) {
    const [key, value] = token.split(":");
    if (!key || !value) continue;
    if (key === "kind") kinds.push(value as NodeKind);
    else if (key === "tag") tags.push(value);
  }
  return { kinds, tags };
}

export function encodeFilter(filter: ParsedFilter): string {
  const parts: string[] = [];
  for (const k of filter.kinds) parts.push(`kind:${k}`);
  for (const t of filter.tags) parts.push(`tag:${t}`);
  return parts.join(",");
}

export function isEmpty(filter: ParsedFilter): boolean {
  return filter.kinds.length === 0 && filter.tags.length === 0;
}

/** A node matches the filter if it satisfies BOTH groups (when non-empty). */
export function nodeMatches(
  filter: ParsedFilter,
  node: { kind: NodeKind; tags?: string[] },
): boolean {
  if (isEmpty(filter)) return true;
  const kindOk =
    filter.kinds.length === 0 || filter.kinds.includes(node.kind);
  const tagOk =
    filter.tags.length === 0 ||
    (node.tags ?? []).some((t) => filter.tags.includes(t));
  return kindOk && tagOk;
}
