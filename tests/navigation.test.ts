import { describe, it, expect } from "vitest";
import { __nav } from "@/lib/navigation";
import type { Frame } from "@/lib/url";

const F = (projectId: string, diagramId?: string, focusNodeId?: string): Frame => ({
  projectId,
  ...(diagramId !== undefined && { diagramId }),
  ...(focusNodeId !== undefined && { focusNodeId }),
});

describe("NavigationController stack semantics", () => {
  describe("pushFrame", () => {
    it("appends a new frame onto an empty stack", () => {
      expect(__nav.pushFrame([], F("payments", "context"))).toEqual([
        F("payments", "context"),
      ]);
    });

    it("appends a new frame onto a non-empty stack", () => {
      const stack = [F("payments", "context")];
      expect(__nav.pushFrame(stack, F("payments", "container"))).toEqual([
        F("payments", "context"),
        F("payments", "container"),
      ]);
    });

    it("is a no-op when frame equals current top", () => {
      const stack = [F("payments", "context")];
      const next = __nav.pushFrame(stack, F("payments", "context"));
      expect(next).toBe(stack);
    });

    it("pushes across projects", () => {
      const stack = [F("booking", "context")];
      expect(__nav.pushFrame(stack, F("payments", "container", "order-api"))).toEqual([
        F("booking", "context"),
        F("payments", "container", "order-api"),
      ]);
    });

    it("treats different focusNodeId as a distinct frame", () => {
      const stack = [F("payments", "container")];
      const next = __nav.pushFrame(stack, F("payments", "container", "order-api"));
      expect(next).toHaveLength(2);
    });
  });

  describe("replaceTop", () => {
    it("replaces an empty stack with the new frame", () => {
      expect(__nav.replaceTop([], F("payments", "context"))).toEqual([
        F("payments", "context"),
      ]);
    });

    it("swaps the top frame", () => {
      const stack = [F("booking", "context"), F("booking", "internals")];
      expect(__nav.replaceTop(stack, F("payments", "context"))).toEqual([
        F("booking", "context"),
        F("payments", "context"),
      ]);
    });
  });

  describe("popTo", () => {
    it("truncates the stack to the given index", () => {
      const stack = [
        F("booking", "context"),
        F("booking", "internals"),
        F("payments", "context"),
      ];
      expect(__nav.popTo(stack, 0)).toEqual([F("booking", "context")]);
      expect(__nav.popTo(stack, 1)).toEqual([
        F("booking", "context"),
        F("booking", "internals"),
      ]);
    });

    it("is a no-op for out-of-range indices", () => {
      const stack = [F("payments", "context")];
      expect(__nav.popTo(stack, -1)).toBe(stack);
      expect(__nav.popTo(stack, 5)).toBe(stack);
    });
  });
});
