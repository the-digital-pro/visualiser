import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { storeActions, useStore } from "@/lib/store";
import { loadProjectForEditor } from "@/lib/editorLoader";
import { CanvasHost } from "@/components/canvas/CanvasHost";
import { NodePalette } from "@/components/editor/NodePalette";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { EditorTopBar } from "@/components/editor/EditorTopBar";
import { ValidationPanel } from "@/components/editor/ValidationPanel";

const COLLAPSE_KEYS = {
  palette: "arcviz:ui:palette-collapsed",
  properties: "arcviz:ui:properties-collapsed",
} as const;

function readBool(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeBool(key: string, value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

/**
 * Editor surface (ADR-0010). Tree-shaken when VITE_EDITOR_ENABLED=false.
 *
 * Loading sequence:
 *   - Mark `editingProjectId` so the editor slices of the store are active.
 *   - Run `loadProjectForEditor` which:
 *       1. fetches manifest (for bundledHash),
 *       2. fetches bundled JSON,
 *       3. reads localStorage draft (if any), validates it, and surfaces a
 *          hash-conflict flag for the top-bar banner if applicable.
 */
export function EditorView() {
  const { projectId } = useParams();

  useEffect(() => {
    if (!projectId) return;
    storeActions.setEditingProject(projectId);
    loadProjectForEditor(projectId);
    return () => storeActions.setEditingProject(null);
  }, [projectId]);

  const status = useStore((s) =>
    projectId ? s.projectStatus[projectId] : null,
  );

  const [paletteCollapsed, setPaletteCollapsed] = useState<boolean>(() =>
    readBool(COLLAPSE_KEYS.palette),
  );
  const [propertiesCollapsed, setPropertiesCollapsed] = useState<boolean>(() =>
    readBool(COLLAPSE_KEYS.properties),
  );
  const togglePalette = useCallback(() => {
    setPaletteCollapsed((prev) => {
      const next = !prev;
      writeBool(COLLAPSE_KEYS.palette, next);
      return next;
    });
  }, []);
  const toggleProperties = useCallback(() => {
    setPropertiesCollapsed((prev) => {
      const next = !prev;
      writeBool(COLLAPSE_KEYS.properties, next);
      return next;
    });
  }, []);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="border-b border-border bg-background/95 px-4 py-2">
        <EditorTopBar />
        {status?.source === "draft" && !status.draftConflictHash && (
          <div className="mt-1 text-[10px] text-muted-foreground">
            {status.bundledHash ? (
              <>
                Editing local draft — bundled hash{" "}
                <code className="font-mono">{status.bundledHash.slice(0, 8)}</code>.
              </>
            ) : (
              <>Editing local-only draft — not yet in the bundle.</>
            )}
          </div>
        )}
      </div>
      <div className="flex min-h-0 flex-1">
        <NodePalette collapsed={paletteCollapsed} onToggle={togglePalette} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 p-3">
            <div className="h-full">
              <CanvasHost editable />
            </div>
          </div>
          <div className="border-t border-border bg-card p-2">
            <ValidationPanel />
          </div>
        </div>
        <PropertiesPanel collapsed={propertiesCollapsed} onToggle={toggleProperties} />
      </div>
    </div>
  );
}
