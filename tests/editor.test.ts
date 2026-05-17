import { describe, it, expect, beforeEach } from "vitest";
import type { Project } from "@/lib/schema";
import { useStore, storeActions } from "@/lib/store";
import { editor } from "@/lib/editor";

const baseProject: Project = {
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
      ],
      edges: [],
    },
  ],
};

function renameNode(name: string) {
  return (p: Project): Project => ({
    ...p,
    diagrams: p.diagrams.map((d) => ({
      ...d,
      nodes: d.nodes.map((n) => (n.id === "a" ? { ...n, name } : n)),
    })),
  });
}

function getNodeName(): string {
  return useStore.getState().projects["x"]!.diagrams[0]!.nodes[0]!.name;
}

beforeEach(() => {
  // Reset store to a known shape for each test.
  useStore.setState({
    projects: { x: baseProject },
    projectStatus: { x: { state: "loaded" } },
    navStack: [],
    selection: null,
    viewportsByDiagram: {},
    pulseTarget: null,
    editingProjectId: "x",
    history: { past: [], future: [] },
    pendingBefore: null,
  });
  // Clean any leftover localStorage between tests.
  if (typeof localStorage !== "undefined") localStorage.clear();
});

describe("editor commit / undo / redo", () => {
  it("commit captures the pre-state and clears future", () => {
    editor.commit("x", renameNode("first"));
    let s = useStore.getState();
    expect(s.projects.x.diagrams[0].nodes[0].name).toBe("first");
    expect(s.history.past).toHaveLength(1);
    expect(s.history.past[0].diagrams[0].nodes[0].name).toBe("A");
    expect(s.history.future).toHaveLength(0);

    editor.commit("x", renameNode("second"));
    s = useStore.getState();
    expect(s.history.past).toHaveLength(2);
    expect(s.history.future).toHaveLength(0);
  });

  it("undo restores the previous snapshot and stacks current on future", () => {
    editor.commit("x", renameNode("first"));
    editor.commit("x", renameNode("second"));
    editor.undo("x");
    let s = useStore.getState();
    expect(s.projects.x.diagrams[0].nodes[0].name).toBe("first");
    expect(s.history.future).toHaveLength(1);
    expect(s.history.future[0].diagrams[0].nodes[0].name).toBe("second");

    editor.undo("x");
    s = useStore.getState();
    expect(s.projects.x.diagrams[0].nodes[0].name).toBe("A");
    expect(s.history.past).toHaveLength(0);
    expect(s.history.future).toHaveLength(2);
  });

  it("redo replays the most recent undone snapshot", () => {
    editor.commit("x", renameNode("first"));
    editor.undo("x");
    editor.redo("x");
    expect(getNodeName()).toBe("first");
    expect(useStore.getState().history.past).toHaveLength(1);
    expect(useStore.getState().history.future).toHaveLength(0);
  });

  it("commit clears future (new branch invalidates redo)", () => {
    editor.commit("x", renameNode("first"));
    editor.commit("x", renameNode("second"));
    editor.undo("x");
    expect(useStore.getState().history.future).toHaveLength(1);
    editor.commit("x", renameNode("branch"));
    expect(useStore.getState().history.future).toHaveLength(0);
  });

  it("caps history past at 50 entries (HISTORY_CAP)", () => {
    for (let i = 0; i < 60; i++) {
      editor.commit("x", renameNode(`v${i}`));
    }
    const s = useStore.getState();
    expect(s.history.past).toHaveLength(50);
    // The earliest 10 commits get evicted; oldest still in past is v10's *before*-state = v9
    expect(s.history.past[0].diagrams[0].nodes[0].name).toBe("v9");
  });
});

describe("editor transient burst", () => {
  it("captures pendingBefore on first applyTransient", () => {
    editor.applyTransient("x", renameNode("typing"));
    const s = useStore.getState();
    expect(s.pendingBefore).not.toBeNull();
    expect(s.pendingBefore!.diagrams[0].nodes[0].name).toBe("A");
    expect(getNodeName()).toBe("typing");
    expect(s.history.past).toHaveLength(0);
  });

  it("commitTransient pushes pendingBefore once and clears it", () => {
    editor.beginTransient("x");
    editor.applyTransient("x", renameNode("a"));
    editor.applyTransient("x", renameNode("ab"));
    editor.applyTransient("x", renameNode("abc"));
    editor.commitTransient("x");
    const s = useStore.getState();
    expect(s.history.past).toHaveLength(1);
    expect(s.history.past[0].diagrams[0].nodes[0].name).toBe("A");
    expect(getNodeName()).toBe("abc");
    expect(s.pendingBefore).toBeNull();
  });

  it("commitTransient with no pendingBefore is a no-op", () => {
    editor.commitTransient("x");
    expect(useStore.getState().history.past).toHaveLength(0);
  });
});

describe("setEditingProject resets history", () => {
  it("clears history.past and future when switching projects", () => {
    editor.commit("x", renameNode("first"));
    expect(useStore.getState().history.past).toHaveLength(1);
    storeActions.setEditingProject("y");
    const s = useStore.getState();
    expect(s.history.past).toHaveLength(0);
    expect(s.history.future).toHaveLength(0);
    expect(s.pendingBefore).toBeNull();
  });
});
