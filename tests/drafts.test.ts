import { describe, it, expect, beforeEach } from "vitest";
import type { Project } from "@/lib/schema";
import { useStore } from "@/lib/store";
import { clearDraft, loadDraft, readDraft, recordSourceHash, saveDraft } from "@/lib/drafts";

const baseProject: Project = {
  schemaVersion: 1,
  id: "x",
  name: "X",
  homeDiagramId: "h",
  diagrams: [
    {
      id: "h",
      name: "H",
      nodes: [{ id: "a", kind: "service", name: "A", position: { x: 0, y: 0 } }],
      edges: [],
    },
  ],
};

beforeEach(() => {
  localStorage.clear();
  useStore.setState({
    projects: {},
    projectStatus: { x: { state: "loaded", bundledHash: "bundled-aaaa" } },
    navStack: [],
    selection: null,
    viewportsByDiagram: {},
    pulseTarget: null,
    editingProjectId: null,
    history: { past: [], future: [] },
    pendingBefore: null,
  });
});

describe("draft persistence (ADR-0004)", () => {
  it("first saveDraft stamps the current bundled hash from store", () => {
    saveDraft("x", baseProject);
    const envelope = readDraft("x");
    expect(envelope?.sourceHash).toBe("bundled-aaaa");
    expect(envelope?.json).toContain('"id": "x"');
  });

  it("falls back to '<unknown>' when no bundled hash is known yet", () => {
    useStore.setState({ projectStatus: {} });
    saveDraft("x", baseProject);
    expect(readDraft("x")?.sourceHash).toBe("<unknown>");
  });

  it("recordSourceHash promotes an '<unknown>' draft once we know the bundle hash", () => {
    useStore.setState({ projectStatus: {} });
    saveDraft("x", baseProject);
    recordSourceHash("x", "bundled-bbbb");
    expect(readDraft("x")?.sourceHash).toBe("bundled-bbbb");
  });

  it("clearDraft removes the entry", () => {
    saveDraft("x", baseProject);
    expect(readDraft("x")).not.toBeNull();
    clearDraft("x");
    expect(readDraft("x")).toBeNull();
  });
});

describe("hash-conflict detection (ADR-0004)", () => {
  it("loadDraft returns the draft and the recorded sourceHash for conflict checks", async () => {
    saveDraft("x", baseProject);
    const result = await loadDraft("x");
    expect(result).not.toBeNull();
    expect(result!.sourceHashAtDraft).toBe("bundled-aaaa");
    expect(result!.result.ok).toBe(true);
  });

  it("loadDraft rejects malformed JSON gracefully", async () => {
    localStorage.setItem(
      "arcviz:draft:x",
      JSON.stringify({ v: 1, sourceHash: "h", savedAt: 0, json: "{not json" }),
    );
    const result = await loadDraft("x");
    expect(result).toBeNull();
  });

  it("loadDraft surfaces structural errors via the loader (still returns the envelope info)", async () => {
    localStorage.setItem(
      "arcviz:draft:x",
      JSON.stringify({
        v: 1,
        sourceHash: "h",
        savedAt: 0,
        json: JSON.stringify({ schemaVersion: 1, id: "X_UPPER" }),
      }),
    );
    const result = await loadDraft("x");
    expect(result?.result.ok).toBe(false);
  });
});
