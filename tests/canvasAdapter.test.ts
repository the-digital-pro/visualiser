import { describe, it, expect } from "vitest";
import { buildCanvasGraph, externalSyntheticId } from "@/lib/canvasAdapter";
import type { Project } from "@/lib/schema";

const payments: Project = {
  schemaVersion: 1,
  id: "payments",
  name: "Payments",
  homeDiagramId: "container",
  diagrams: [
    {
      id: "container",
      name: "Container",
      nodes: [
        {
          id: "order-api",
          kind: "service",
          name: "Order API",
          position: { x: 0, y: 0 },
        },
        {
          id: "auth-engine",
          kind: "service",
          name: "Auth Engine",
          position: { x: 200, y: 0 },
        },
      ],
      edges: [
        { id: "e1", source: "order-api", target: "auth-engine", type: "rest" },
      ],
    },
  ],
};

const booking: Project = {
  schemaVersion: 1,
  id: "booking",
  name: "Booking",
  homeDiagramId: "context",
  diagrams: [
    {
      id: "context",
      name: "Context",
      nodes: [
        {
          id: "booking-web",
          kind: "application",
          name: "Booking Web",
          position: { x: 0, y: 0 },
        },
      ],
      edges: [
        {
          id: "x1",
          source: "booking-web",
          targetRef: "payments:container:order-api",
          type: "rest",
          label: "POST /authorise",
        },
      ],
    },
  ],
};

describe("canvas adapter", () => {
  describe("outbound cross-project edges", () => {
    it("emits a synthetic external node for each unique targetRef", () => {
      const graph = buildCanvasGraph({
        project: booking,
        diagramId: "context",
        loadedProjects: { booking },
      });
      const externals = graph.nodes.filter((n) =>
        n.id.startsWith(externalSyntheticId("").slice(0, -1)),
      );
      expect(externals).toHaveLength(1);
      expect(externals[0].id).toBe(externalSyntheticId("payments:container:order-api"));
    });

    it("connects the source node to the synthetic external", () => {
      const graph = buildCanvasGraph({
        project: booking,
        diagramId: "context",
        loadedProjects: { booking },
      });
      const xprojectEdge = graph.edges.find((e) => e.id === "x1");
      expect(xprojectEdge).toBeDefined();
      expect(xprojectEdge!.source).toBe("booking-web");
      expect(xprojectEdge!.target).toBe(
        externalSyntheticId("payments:container:order-api"),
      );
    });

    it("uses the target node's real name when its project is loaded", () => {
      const graph = buildCanvasGraph({
        project: booking,
        diagramId: "context",
        loadedProjects: { booking, payments },
      });
      const ext = graph.nodes.find((n) =>
        n.id === externalSyntheticId("payments:container:order-api"),
      );
      expect(ext).toBeDefined();
      expect((ext!.data as { name: string }).name).toBe("Order API");
    });
  });

  describe("reverse-edge derivation (ADR-0001)", () => {
    it("emits inbound synthetic + reverse-edge when source project is also loaded", () => {
      const graph = buildCanvasGraph({
        project: payments,
        diagramId: "container",
        loadedProjects: { payments, booking },
      });
      const inboundEdges = graph.edges.filter(
        (e) => typeof e.id === "string" && e.id.startsWith("rev-"),
      );
      expect(inboundEdges).toHaveLength(1);
      const rev = inboundEdges[0];
      expect(rev.target).toBe("order-api");
      // Source is the synthetic inbound node, not booking-web directly.
      expect(typeof rev.source).toBe("string");
      expect(rev.source.startsWith("__ext__in:")).toBe(true);
    });

    it("does NOT emit reverse-edges when the source project is not loaded", () => {
      const graph = buildCanvasGraph({
        project: payments,
        diagramId: "container",
        loadedProjects: { payments },
      });
      const inbound = graph.edges.filter(
        (e) => typeof e.id === "string" && e.id.startsWith("rev-"),
      );
      expect(inbound).toHaveLength(0);
    });

    it("marks reverse-edges with reverse: true in data", () => {
      const graph = buildCanvasGraph({
        project: payments,
        diagramId: "container",
        loadedProjects: { payments, booking },
      });
      const rev = graph.edges.find(
        (e) => typeof e.id === "string" && e.id.startsWith("rev-"),
      );
      expect(rev?.data).toMatchObject({ reverse: true, crossProject: true });
    });
  });

  describe("pulse target", () => {
    it("propagates pulsing flag onto the matching node", () => {
      const graph = buildCanvasGraph({
        project: payments,
        diagramId: "container",
        loadedProjects: { payments },
        pulseNodeId: "order-api",
      });
      const node = graph.nodes.find((n) => n.id === "order-api");
      expect((node!.data as { pulsing: boolean }).pulsing).toBe(true);
      const other = graph.nodes.find((n) => n.id === "auth-engine");
      expect((other!.data as { pulsing: boolean }).pulsing).toBe(false);
    });
  });
});
