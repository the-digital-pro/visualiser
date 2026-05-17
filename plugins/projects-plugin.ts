import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";
import { ProjectInputSchema, type ProjectInput } from "../src/lib/schema";

/**
 * Build-time projects plugin (ADR-0002, ADR-0010).
 *
 * For every file matching `public/projects/*.json` (excluding generated files):
 *   1. Parse JSON.
 *   2. Validate against ProjectInputSchema. STRUCTURAL ERRORS FAIL THE BUILD.
 *   3. Emit `public/projects/search-index.json`: one entry per node.
 *   4. Emit `public/projects/manifest.json`: project metadata + content hash
 *      for draft/manifest hash-conflict detection in Phase 2 (ADR-0004).
 *
 * Runs in both dev and build via the `buildStart` hook. Generated files are
 * gitignored.
 */

const GENERATED = new Set(["manifest.json", "search-index.json"]);

function hashContent(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 16);
}

interface ManifestEntry {
  id: string;
  name: string;
  description?: string;
  owners?: string[];
  tags?: string[];
  homeDiagramId: string;
  file: string;
  hash: string;
}

interface SearchIndexEntry {
  projectId: string;
  diagramId: string;
  nodeId: string;
  name: string;
  kind: string;
  tags: string[];
  description: string;
}

function buildIndex(project: ProjectInput): SearchIndexEntry[] {
  const out: SearchIndexEntry[] = [];
  for (const diagram of project.diagrams) {
    for (const node of diagram.nodes) {
      out.push({
        projectId: project.id,
        diagramId: diagram.id,
        nodeId: node.id,
        name: node.name,
        kind: node.kind,
        tags: node.tags ?? [],
        description: node.description ? node.description.slice(0, 200) : "",
      });
    }
  }
  return out;
}

export function projectsPlugin(): Plugin {
  let projectsDir = "";

  function regenerate(): void {
    if (!existsSync(projectsDir)) {
      // No projects directory yet — emit empty artifacts so the app can boot.
      return;
    }
    const files = readdirSync(projectsDir)
      .filter((f) => f.endsWith(".json") && !GENERATED.has(f))
      .sort();

    const manifest: { projects: ManifestEntry[] } = { projects: [] };
    const searchIndex: SearchIndexEntry[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const path = join(projectsDir, file);
      const raw = readFileSync(path, "utf8");
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        errors.push(`${file}: invalid JSON — ${(err as Error).message}`);
        continue;
      }
      const result = ProjectInputSchema.safeParse(parsed);
      if (!result.success) {
        const detail = result.error.issues
          .map((i) => `  • ${i.path.join(".") || "<root>"}: ${i.message}`)
          .join("\n");
        errors.push(`${file}: structural validation failed\n${detail}`);
        continue;
      }
      const project = result.data;
      manifest.projects.push({
        id: project.id,
        name: project.name,
        ...(project.description !== undefined && { description: project.description }),
        ...(project.owners !== undefined && { owners: project.owners }),
        ...(project.tags !== undefined && { tags: project.tags }),
        homeDiagramId: project.homeDiagramId,
        file,
        hash: hashContent(raw),
      });
      searchIndex.push(...buildIndex(project));
    }

    if (errors.length > 0) {
      throw new Error(
        `[projects-plugin] structural validation failed — bad JSON must not ship:\n\n${errors.join("\n\n")}`,
      );
    }

    writeFileSync(
      join(projectsDir, "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
      "utf8",
    );
    writeFileSync(
      join(projectsDir, "search-index.json"),
      JSON.stringify(searchIndex, null, 2) + "\n",
      "utf8",
    );
  }

  return {
    name: "arcviz:projects-plugin",
    configResolved(config) {
      projectsDir = resolve(config.root, "public/projects");
    },
    buildStart() {
      try {
        regenerate();
      } catch (err) {
        this.error((err as Error).message);
      }
    },
    configureServer(server) {
      const watchPath = join(projectsDir, "*.json");
      server.watcher.add(watchPath);
      const onChange = (file: string): void => {
        if (
          file.startsWith(projectsDir) &&
          file.endsWith(".json") &&
          !GENERATED.has(file.split("/").pop() ?? "")
        ) {
          try {
            regenerate();
            server.ws.send({ type: "full-reload" });
          } catch (err) {
            server.config.logger.error(
              `[projects-plugin] ${(err as Error).message}`,
              { timestamp: true },
            );
          }
        }
      };
      server.watcher.on("add", onChange);
      server.watcher.on("change", onChange);
      server.watcher.on("unlink", onChange);
    },
  };
}
