import { useState } from "react";
import { Camera, Download, FileUp, RotateCcw, Undo2, Redo2, Wand2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { editor } from "@/lib/editor";
import { serializeProject } from "@/lib/persistence";
import { loadProject } from "@/lib/loader";
import { storeActions } from "@/lib/store";
import { resetToBundled } from "@/lib/editorLoader";
import { runAutoLayout } from "@/lib/autoLayout";
import { capturePng } from "@/lib/capturePng";
import { useHotkeys } from "react-hotkeys-hook";

export function EditorTopBar() {
  const editingProjectId = useStore((s) => s.editingProjectId);
  const project = useStore((s) =>
    editingProjectId ? s.projects[editingProjectId] : null,
  );
  const navStack = useStore((s) => s.navStack);
  const history = useStore((s) => s.history);
  const status = useStore((s) =>
    editingProjectId ? s.projectStatus[editingProjectId] : null,
  );
  const current = navStack[navStack.length - 1];
  const [autoLaying, setAutoLaying] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useHotkeys(
    "mod+z",
    (e) => {
      e.preventDefault();
      if (editingProjectId) editor.undo(editingProjectId);
    },
    { enableOnFormTags: ["INPUT", "SELECT", "TEXTAREA"], preventDefault: true },
    [editingProjectId],
  );
  useHotkeys(
    "shift+mod+z",
    (e) => {
      e.preventDefault();
      if (editingProjectId) editor.redo(editingProjectId);
    },
    { enableOnFormTags: ["INPUT", "SELECT", "TEXTAREA"], preventDefault: true },
    [editingProjectId],
  );

  if (!project || !current) return null;

  const onExport = () => {
    const json = serializeProject(project);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportFile = async (file: File) => {
    setImporting(true);
    setImportError(null);
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const result = loadProject(raw);
      if (!result.ok) {
        setImportError(
          result.issues.map((i) => `${i.path}: ${i.message}`).join("\n"),
        );
        return;
      }
      storeActions.replaceProject(result.project.id, result.project);
      storeActions.resetHistory();
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const onAutoLayout = async () => {
    if (!editingProjectId || !current.diagramId) return;
    setAutoLaying(true);
    try {
      await runAutoLayout(editingProjectId, current.diagramId);
    } finally {
      setAutoLaying(false);
    }
  };

  const onCapturePng = async () => {
    if (!editingProjectId || !current.diagramId) return;
    try {
      await capturePng({
        projectId: editingProjectId,
        diagramId: current.diagramId,
      });
    } catch (e) {
      setImportError((e as Error).message);
    }
  };

  const conflict = status?.draftConflictHash;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {history.past.length}&nbsp;in past · {history.future.length}&nbsp;in future
        </span>
        <Button
          icon={<Undo2 className="h-3.5 w-3.5" />}
          label="Undo"
          onClick={() => editor.undo(editingProjectId!)}
          disabled={history.past.length === 0}
        />
        <Button
          icon={<Redo2 className="h-3.5 w-3.5" />}
          label="Redo"
          onClick={() => editor.redo(editingProjectId!)}
          disabled={history.future.length === 0}
        />
        <div className="mx-2 h-5 w-px bg-border" />
        <Button
          icon={<Wand2 className="h-3.5 w-3.5" />}
          label={autoLaying ? "Laying out…" : "Auto-arrange"}
          onClick={onAutoLayout}
          disabled={autoLaying}
        />
        <div className="mx-2 h-5 w-px bg-border" />
        <Button
          icon={<Download className="h-3.5 w-3.5" />}
          label="Export JSON"
          onClick={onExport}
        />
        <Button
          icon={<Camera className="h-3.5 w-3.5" />}
          label="Capture PNG"
          onClick={onCapturePng}
        />
        <label
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:bg-accent"
          aria-disabled={importing}
        >
          <FileUp className="h-3.5 w-3.5" />
          <span>{importing ? "Importing…" : "Import JSON"}</span>
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportFile(f);
              e.target.value = "";
            }}
          />
        </label>
        <Button
          icon={<RotateCcw className="h-3.5 w-3.5" />}
          label="Reset to published"
          onClick={() => editingProjectId && resetToBundled(editingProjectId)}
        />
      </div>
      {importError && (
        <pre className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
          {importError}
        </pre>
      )}
      {conflict && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-xs">
          <div className="font-medium text-amber-700 dark:text-amber-300">
            The published version of this project has advanced since you last
            edited.
          </div>
          <div className="mt-1 text-amber-700/80 dark:text-amber-300/80">
            Your draft is based on hash <code className="font-mono">{conflict.slice(0, 8)}</code> but the bundle is now <code className="font-mono">{status?.bundledHash?.slice(0, 8)}</code>.
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => editingProjectId && resetToBundled(editingProjectId)}
              className="rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground hover:bg-destructive/90"
            >
              Discard draft + start fresh
            </button>
            <button
              type="button"
              onClick={() => {
                if (editingProjectId) {
                  storeActions.setProjectLoaded(editingProjectId, project, status?.issues ?? [], {
                    bundledHash: status?.bundledHash,
                    source: "draft",
                  });
                }
              }}
              className="rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-accent"
            >
              Keep my draft
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Button({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
