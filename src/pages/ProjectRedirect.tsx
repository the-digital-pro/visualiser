import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ManifestSchema } from "@/lib/schema";
import { navigation } from "@/lib/navigation";

/**
 * Direct visits to `/p/:projectId` resolve the project's home diagram from
 * the manifest and replace the URL with `/p/:projectId/d/:homeDiagramId`.
 * Keeps URL = current frame (ADR-0003) while letting `/p/:projectId` work
 * as a typeable shorthand.
 */
export function ProjectRedirect() {
  const { projectId } = useParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    fetch("/projects/manifest.json")
      .then((r) => r.json())
      .then((data) => {
        const result = ManifestSchema.safeParse(data);
        if (!result.success) {
          setError(`manifest validation failed: ${result.error.message}`);
          return;
        }
        const entry = result.data.projects.find((p) => p.id === projectId);
        if (!entry) {
          setError(`Project "${projectId}" is not in the manifest.`);
          return;
        }
        navigation().replace({
          projectId,
          diagramId: entry.homeDiagramId,
        });
      })
      .catch((e: Error) => setError(e.message));
  }, [projectId]);

  if (error) {
    return (
      <div className="mx-auto max-w-screen-md px-4 py-4">
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm">
          {error}
        </div>
      </div>
    );
  }
  return (
    <div className="px-4 py-4 text-muted-foreground">Resolving home diagram…</div>
  );
}
