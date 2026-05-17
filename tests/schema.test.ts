import { describe, it, expect } from "vitest";
import { ProjectInputSchema } from "@/lib/schema";

describe("ProjectInputSchema", () => {
  it("accepts a schema-valid stub project", () => {
    const result = ProjectInputSchema.safeParse({
      schemaVersion: 1,
      id: "payments",
      name: "Payments Platform",
      homeDiagramId: "context",
      diagrams: [{ id: "context", name: "System context", nodes: [], edges: [] }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown schemaVersion", () => {
    const result = ProjectInputSchema.safeParse({
      schemaVersion: 99,
      id: "x",
      name: "X",
      homeDiagramId: "h",
      diagrams: [{ id: "h", name: "H", nodes: [], edges: [] }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an edge with neither target nor targetRef", () => {
    const result = ProjectInputSchema.safeParse({
      schemaVersion: 1,
      id: "x",
      name: "X",
      homeDiagramId: "h",
      diagrams: [
        {
          id: "h",
          name: "H",
          nodes: [{ id: "a", kind: "service", name: "A" }],
          edges: [{ id: "e1", source: "a", type: "rest" }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an edge with both target and targetRef", () => {
    const result = ProjectInputSchema.safeParse({
      schemaVersion: 1,
      id: "x",
      name: "X",
      homeDiagramId: "h",
      diagrams: [
        {
          id: "h",
          name: "H",
          nodes: [
            { id: "a", kind: "service", name: "A" },
            { id: "b", kind: "service", name: "B" },
          ],
          edges: [
            {
              id: "e1",
              source: "a",
              target: "b",
              targetRef: "other:home:node",
              type: "rest",
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed targetRef", () => {
    const result = ProjectInputSchema.safeParse({
      schemaVersion: 1,
      id: "x",
      name: "X",
      homeDiagramId: "h",
      diagrams: [
        {
          id: "h",
          name: "H",
          nodes: [{ id: "a", kind: "service", name: "A" }],
          edges: [{ id: "e1", source: "a", targetRef: "not-a-ref", type: "rest" }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("reports issue.path on structural failure", () => {
    const result = ProjectInputSchema.safeParse({
      schemaVersion: 1,
      id: "X_UPPER",
      name: "X",
      homeDiagramId: "h",
      diagrams: [{ id: "h", name: "H", nodes: [], edges: [] }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["id"]);
    }
  });
});
