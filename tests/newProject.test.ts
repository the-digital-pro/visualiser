import { describe, it, expect } from "vitest";
import { newProjectScaffold, slugify } from "@/lib/newProject";
import { ProjectSchema } from "@/lib/schema";
import { serializeProject } from "@/lib/persistence";

describe("slugify", () => {
  it("lowercases and replaces non-alphanumeric runs with hyphens", () => {
    expect(slugify("Identity Platform")).toBe("identity-platform");
    expect(slugify("Foo  /  Bar")).toBe("foo-bar");
    expect(slugify("ALL CAPS")).toBe("all-caps");
  });

  it("strips leading/trailing hyphens", () => {
    expect(slugify("  --foo-- ")).toBe("foo");
  });

  it("falls back to 'untitled' for empty/all-punctuation input", () => {
    expect(slugify("")).toBe("untitled");
    expect(slugify("!!!")).toBe("untitled");
    expect(slugify("---")).toBe("untitled");
  });

  it("preserves digits and existing kebab segments", () => {
    expect(slugify("v2 Platform")).toBe("v2-platform");
    expect(slugify("foo-bar-baz")).toBe("foo-bar-baz");
  });
});

describe("newProjectScaffold", () => {
  it("produces a Project that passes ProjectSchema validation", () => {
    const p = newProjectScaffold("my-project", "My Project");
    expect(ProjectSchema.safeParse(p).success).toBe(true);
  });

  it("includes exactly one diagram named 'System context' with id 'context'", () => {
    const p = newProjectScaffold("x", "X");
    expect(p.diagrams).toHaveLength(1);
    expect(p.diagrams[0].id).toBe("context");
    expect(p.diagrams[0].name).toBe("System context");
    expect(p.diagrams[0].nodes).toEqual([]);
    expect(p.diagrams[0].edges).toEqual([]);
  });

  it("sets homeDiagramId to the only diagram", () => {
    const p = newProjectScaffold("x", "X");
    expect(p.homeDiagramId).toBe(p.diagrams[0].id);
  });

  it("survives a serialize → JSON.parse round-trip into the same shape", () => {
    const p = newProjectScaffold("x", "X");
    const round = JSON.parse(serializeProject(p));
    expect(round).toEqual(JSON.parse(serializeProject(p)));
    expect(ProjectSchema.safeParse(round).success).toBe(true);
  });
});
