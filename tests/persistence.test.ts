import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serializeProject } from "@/lib/persistence";
import { ProjectInputSchema } from "@/lib/schema";

const seed = (name: string) =>
  readFileSync(join(process.cwd(), "public", "projects", `${name}.json`), "utf8");

describe("canonical serializer", () => {
  it("round-trips the payments seed byte-identically", () => {
    const raw = seed("payments");
    const project = ProjectInputSchema.parse(JSON.parse(raw));
    expect(serializeProject(project)).toBe(raw);
  });

  it("round-trips the booking seed byte-identically", () => {
    const raw = seed("booking");
    const project = ProjectInputSchema.parse(JSON.parse(raw));
    expect(serializeProject(project)).toBe(raw);
  });

  it("ends with a single trailing newline", () => {
    const raw = seed("payments");
    const out = serializeProject(ProjectInputSchema.parse(JSON.parse(raw)));
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
  });

  it("emits a stable key order for project fields", () => {
    const project = ProjectInputSchema.parse({
      schemaVersion: 1,
      // intentionally scrambled input order:
      diagrams: [{ id: "h", name: "H", nodes: [], edges: [] }],
      homeDiagramId: "h",
      tags: ["t"],
      owners: ["o"],
      description: "desc",
      name: "X",
      id: "x",
    });
    const out = serializeProject(project);
    const keys = Array.from(out.matchAll(/^\s{2}"(\w+)":/gm)).map((m) => m[1]);
    expect(keys).toEqual([
      "schemaVersion",
      "id",
      "name",
      "description",
      "owners",
      "tags",
      "homeDiagramId",
      "diagrams",
    ]);
  });

  it("omits undefined optional fields rather than emitting null", () => {
    const project = ProjectInputSchema.parse({
      schemaVersion: 1,
      id: "x",
      name: "X",
      homeDiagramId: "h",
      diagrams: [{ id: "h", name: "H", nodes: [], edges: [] }],
    });
    const out = serializeProject(project);
    expect(out).not.toContain("description");
    expect(out).not.toContain("owners");
    expect(out).not.toContain("tags");
    expect(out).not.toContain("null");
  });
});
