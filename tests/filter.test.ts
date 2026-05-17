import { describe, it, expect } from "vitest";
import { parseFilter, encodeFilter, nodeMatches, isEmpty, EMPTY_FILTER } from "@/lib/filter";

describe("filter URL syntax", () => {
  it("parses a single kind token", () => {
    expect(parseFilter("kind:service")).toEqual({
      kinds: ["service"],
      tags: [],
    });
  });

  it("parses multiple kinds and tags", () => {
    expect(parseFilter("kind:service,kind:datastore,tag:critical,tag:public")).toEqual({
      kinds: ["service", "datastore"],
      tags: ["critical", "public"],
    });
  });

  it("treats null/empty as the empty filter", () => {
    expect(parseFilter(null)).toEqual(EMPTY_FILTER);
    expect(parseFilter("")).toEqual(EMPTY_FILTER);
    expect(parseFilter(undefined)).toEqual(EMPTY_FILTER);
  });

  it("ignores malformed tokens", () => {
    expect(parseFilter("foo,kind:,:bar,kind:service")).toEqual({
      kinds: ["service"],
      tags: [],
    });
  });

  it("round-trips through encode/parse", () => {
    const f = { kinds: ["service", "datastore"], tags: ["critical"] } as const;
    expect(parseFilter(encodeFilter(f as never))).toEqual(f);
  });
});

describe("nodeMatches", () => {
  it("matches everything when the filter is empty", () => {
    expect(nodeMatches(EMPTY_FILTER, { kind: "service" })).toBe(true);
    expect(nodeMatches(EMPTY_FILTER, { kind: "actor", tags: ["x"] })).toBe(true);
  });

  it("requires the node kind to be in the filter's kinds list", () => {
    const f = parseFilter("kind:service");
    expect(nodeMatches(f, { kind: "service" })).toBe(true);
    expect(nodeMatches(f, { kind: "datastore" })).toBe(false);
  });

  it("AND-joins kinds and tags but OR within each group", () => {
    const f = parseFilter("kind:service,kind:datastore,tag:critical");
    expect(nodeMatches(f, { kind: "service", tags: ["critical"] })).toBe(true);
    expect(nodeMatches(f, { kind: "datastore", tags: ["critical"] })).toBe(true);
    // Right kind, wrong tag.
    expect(nodeMatches(f, { kind: "service", tags: ["other"] })).toBe(false);
    // Right tag, wrong kind.
    expect(nodeMatches(f, { kind: "actor", tags: ["critical"] })).toBe(false);
  });

  it("isEmpty detects the no-op filter", () => {
    expect(isEmpty(EMPTY_FILTER)).toBe(true);
    expect(isEmpty(parseFilter("kind:service"))).toBe(false);
  });
});
