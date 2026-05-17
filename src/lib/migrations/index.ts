import { CURRENT_SCHEMA_VERSION } from "../schema";

/**
 * Migration ladder (ADR-0007).
 *
 * Each entry migrates a project from version `from` to version `from + 1`.
 * `migrate()` applies steps in order until the project reaches CURRENT_SCHEMA_VERSION.
 *
 * v1 happy-path only: no migrations registered yet. The ladder exists so future
 * versions can drop in a new step without touching loader code.
 */

type AnyProject = { schemaVersion: number } & Record<string, unknown>;

type MigrationStep = {
  from: number;
  to: number;
  apply: (input: AnyProject) => AnyProject;
};

const steps: MigrationStep[] = [
  // Example for v2 (when it lands):
  // { from: 1, to: 2, apply: (p) => ({ ...p, schemaVersion: 2, /* renames... */ }) },
];

export function migrate(raw: unknown): AnyProject {
  if (typeof raw !== "object" || raw === null || !("schemaVersion" in raw)) {
    throw new Error("project is missing `schemaVersion`");
  }
  let project = raw as AnyProject;
  while (project.schemaVersion < CURRENT_SCHEMA_VERSION) {
    const step = steps.find((s) => s.from === project.schemaVersion);
    if (!step) {
      throw new Error(
        `no migration registered from schemaVersion=${project.schemaVersion}`,
      );
    }
    project = step.apply(project);
  }
  if (project.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `project.schemaVersion=${project.schemaVersion} is newer than the app supports (${CURRENT_SCHEMA_VERSION}). Update the app.`,
    );
  }
  return project;
}
