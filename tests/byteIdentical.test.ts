import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadProject } from "@/lib/loader";
import { serializeProject } from "@/lib/persistence";

const projectsDir = join(process.cwd(), "public", "projects");

describe("Phase 2 byte-identical round-trip", () => {
  const seedFiles = readdirSync(projectsDir)
    .filter((f) => f.endsWith(".json"))
    .filter((f) => !["manifest.json", "search-index.json"].includes(f));

  for (const file of seedFiles) {
    it(`${file} survives loader → serializeProject byte-identically`, () => {
      const raw = readFileSync(join(projectsDir, file), "utf8");
      const parsed = JSON.parse(raw);
      const result = loadProject(parsed);
      expect(result.ok, JSON.stringify(result.ok === false && result.issues, null, 2)).toBe(
        true,
      );
      if (!result.ok) return;
      const reserialized = serializeProject(result.project);
      expect(reserialized).toBe(raw);
    });
  }
});
