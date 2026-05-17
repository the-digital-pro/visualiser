import { describe, it, expect } from "vitest";
import { loadProject } from "@/lib/loader";

const valid = (overrides: Partial<Record<string, unknown>> = {}) => ({
  schemaVersion: 1,
  id: "x",
  name: "X",
  homeDiagramId: "h",
  diagrams: [
    {
      id: "h",
      name: "H",
      nodes: [
        { id: "a", kind: "service", name: "A", position: { x: 0, y: 0 } },
        { id: "b", kind: "service", name: "B", position: { x: 100, y: 0 } },
      ],
      edges: [{ id: "e1", source: "a", target: "b", type: "rest" }],
    },
  ],
  ...overrides,
});

describe("three-tier loader (ADR-0007)", () => {
  describe("tier 1 — structural", () => {
    it("fails the whole load on Zod failure", () => {
      const result = loadProject({ schemaVersion: 1, id: "X_UPPER" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues[0].tier).toBe("structural");
      }
    });

    it("emits readable issue paths", () => {
      const result = loadProject({
        schemaVersion: 1,
        id: "x",
        name: "X",
        homeDiagramId: "h",
        diagrams: [
          {
            id: "h",
            name: "H",
            nodes: [{ id: "a", kind: "service", name: "A" }],
            edges: [{ id: "e1", source: "a", type: "rest" }], // missing target/targetRef
          },
        ],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const paths = result.issues.map((i) => i.path);
        expect(paths.some((p) => p.includes("edges"))).toBe(true);
      }
    });
  });

  describe("tier 2 — referential", () => {
    it("flags a dangling edge target", () => {
      const result = loadProject(
        valid({
          diagrams: [
            {
              id: "h",
              name: "H",
              nodes: [{ id: "a", kind: "service", name: "A", position: { x: 0, y: 0 } }],
              edges: [{ id: "e1", source: "a", target: "ghost", type: "rest" }],
            },
          ],
        }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        const ref = result.issues.filter((i) => i.tier === "referential");
        expect(ref.some((i) => i.message.includes('"ghost"'))).toBe(true);
      }
    });

    it("flags a missing childDiagramId", () => {
      const result = loadProject(
        valid({
          diagrams: [
            {
              id: "h",
              name: "H",
              nodes: [
                {
                  id: "a",
                  kind: "service",
                  name: "A",
                  position: { x: 0, y: 0 },
                  childDiagramId: "nonexistent",
                },
              ],
              edges: [],
            },
          ],
        }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        const ref = result.issues.filter((i) => i.tier === "referential");
        expect(ref.some((i) => i.path.endsWith("childDiagramId"))).toBe(true);
      }
    });

    it("flags a missing homeDiagramId target", () => {
      const result = loadProject(
        valid({
          homeDiagramId: "ghost",
        }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        const ref = result.issues.filter((i) => i.tier === "referential");
        expect(ref.some((i) => i.path === "homeDiagramId")).toBe(true);
      }
    });

    it("flags a parentId on a non-group node", () => {
      const result = loadProject(
        valid({
          diagrams: [
            {
              id: "h",
              name: "H",
              nodes: [
                { id: "p", kind: "service", name: "P", position: { x: 0, y: 0 } },
                {
                  id: "c",
                  kind: "service",
                  name: "C",
                  parentId: "p",
                  position: { x: 0, y: 0 },
                },
              ],
              edges: [],
            },
          ],
        }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        const ref = result.issues.filter((i) => i.tier === "referential");
        expect(ref.some((i) => i.message.includes("not a group"))).toBe(true);
      }
    });
  });

  describe("tier 3 — soft", () => {
    it("flags missing positions (fallback grid)", () => {
      const result = loadProject({
        schemaVersion: 1,
        id: "x",
        name: "X",
        homeDiagramId: "h",
        diagrams: [
          {
            id: "h",
            name: "H",
            nodes: [{ id: "a", kind: "service", name: "A" }],
            edges: [],
          },
        ],
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.issues.some((i) => i.tier === "soft" && i.path.endsWith("position"))).toBe(true);
        // Position should still be filled in.
        expect(result.project.diagrams[0].nodes[0].position).toBeDefined();
      }
    });

    it("flags orphan nodes", () => {
      const result = loadProject(
        valid({
          diagrams: [
            {
              id: "h",
              name: "H",
              nodes: [
                { id: "a", kind: "service", name: "A", position: { x: 0, y: 0 } },
                { id: "b", kind: "service", name: "B", position: { x: 100, y: 0 } },
                { id: "c", kind: "service", name: "C", position: { x: 200, y: 0 } },
              ],
              edges: [{ id: "e1", source: "a", target: "b", type: "rest" }],
            },
          ],
        }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        const orphans = result.issues.filter(
          (i) => i.tier === "soft" && i.message.includes("orphan"),
        );
        expect(orphans).toHaveLength(1);
        expect(orphans[0].path).toContain("c");
      }
    });
  });

  describe("cross-project targetRef", () => {
    it("does NOT flag targetRef as referential (deferred to nav-time)", () => {
      const result = loadProject(
        valid({
          diagrams: [
            {
              id: "h",
              name: "H",
              nodes: [{ id: "a", kind: "service", name: "A", position: { x: 0, y: 0 } }],
              edges: [
                { id: "e1", source: "a", targetRef: "other:home:n", type: "rest" },
              ],
            },
          ],
        }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        const refIssues = result.issues.filter(
          (i) => i.tier === "referential" && i.message.includes("targetRef"),
        );
        expect(refIssues).toHaveLength(0);
      }
    });
  });
});
