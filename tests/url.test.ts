import { describe, it, expect } from "vitest";
import { decodeLocation, encodeFrame, framesEqual } from "@/lib/url";

describe("URL codec", () => {
  it("encodes a project-only frame", () => {
    expect(encodeFrame({ projectId: "payments" })).toBe("/p/payments");
  });

  it("encodes a project + diagram frame", () => {
    expect(encodeFrame({ projectId: "payments", diagramId: "context" })).toBe(
      "/p/payments/d/context",
    );
  });

  it("encodes a frame with focus", () => {
    expect(
      encodeFrame({ projectId: "payments", diagramId: "context", focusNodeId: "api" }),
    ).toBe("/p/payments/d/context?focus=api");
  });

  it("preserves filter alongside focus", () => {
    expect(
      encodeFrame(
        { projectId: "p", diagramId: "d", focusNodeId: "n" },
        "kind:service",
      ),
    ).toBe("/p/p/d/d?focus=n&filter=kind%3Aservice");
  });

  it("decodes a project + diagram URL", () => {
    expect(decodeLocation("/p/payments/d/context", "")).toEqual({
      frame: { projectId: "payments", diagramId: "context" },
      filter: null,
    });
  });

  it("decodes a focus query param", () => {
    expect(decodeLocation("/p/payments/d/context", "?focus=api")).toEqual({
      frame: { projectId: "payments", diagramId: "context", focusNodeId: "api" },
      filter: null,
    });
  });

  it("returns no frame for the home route", () => {
    expect(decodeLocation("/", "")).toEqual({ frame: null, filter: null });
  });

  it("framesEqual ignores object identity", () => {
    expect(
      framesEqual(
        { projectId: "p", diagramId: "d" },
        { projectId: "p", diagramId: "d" },
      ),
    ).toBe(true);
    expect(
      framesEqual({ projectId: "p" }, { projectId: "p", diagramId: "d" }),
    ).toBe(false);
  });
});
