import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, FileUp, Upload, X } from "lucide-react";
import { loadProject, type ValidationIssue } from "@/lib/loader";
import { saveDraft } from "@/lib/drafts";
import { storeActions } from "@/lib/store";
import type { Project } from "@/lib/schema";

interface ImportProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Manifest ids — used to flag draft-on-bundled overlays. */
  manifestIds: Set<string>;
  /** Existing local draft ids — used to flag draft replacements. */
  draftIds: Set<string>;
}

interface Preview {
  project: Project;
  json: string;
  collidesWith: "manifest" | "draft" | null;
}

export function ImportProjectDialog({
  open,
  onOpenChange,
  manifestIds,
  draftIds,
}: ImportProjectDialogProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFileName(null);
      setIssues([]);
      setPreview(null);
      setParseError(null);
    }
  }, [open]);

  const onFile = async (file: File) => {
    setFileName(file.name);
    setIssues([]);
    setPreview(null);
    setParseError(null);
    let text: string;
    try {
      text = await file.text();
    } catch (e) {
      setParseError((e as Error).message);
      return;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      setParseError(`Not valid JSON: ${(e as Error).message}`);
      return;
    }
    const result = loadProject(raw);
    if (!result.ok) {
      setIssues(result.issues);
      return;
    }
    const id = result.project.id;
    const collidesWith: Preview["collidesWith"] = manifestIds.has(id)
      ? "manifest"
      : draftIds.has(id)
      ? "draft"
      : null;
    setIssues(result.issues);
    setPreview({ project: result.project, json: text, collidesWith });
  };

  const onConfirm = () => {
    if (!preview) return;
    const { project } = preview;
    storeActions.replaceProject(project.id, project);
    saveDraft(project.id, project);
    onOpenChange(false);
    navigate(`/edit/p/${project.id}/d/${project.homeDiagramId}`);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[560px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-card text-card-foreground shadow-2xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Dialog.Title className="text-sm font-semibold">
              Import project
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="rounded-md p-1 hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4 p-4">
            <Dialog.Description className="text-xs text-muted-foreground">
              Pick a project JSON file (the one the architecture-parse skill
              writes, or a previously exported draft). It's validated against
              the project schema, saved as a local draft in your browser, and
              opens in the editor.
            </Dialog.Description>

            <label
              className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-dashed border-border bg-background/40 px-3 py-3 text-sm hover:border-primary/40 hover:bg-accent/30"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) onFile(f);
              }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {fileName ?? "Choose or drop a project JSON…"}
                </span>
              </div>
              <span className="shrink-0 rounded-md border border-border bg-card px-2 py-1 text-xs">
                Browse
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  e.target.value = "";
                }}
              />
            </label>

            {parseError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
                {parseError}
              </div>
            )}

            {issues.length > 0 && (
              <div className="space-y-1 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs">
                <div className="font-medium text-destructive">
                  {issues.length} validation{" "}
                  {issues.length === 1 ? "issue" : "issues"}
                </div>
                <ul className="list-disc pl-4 text-destructive/90">
                  {issues.slice(0, 8).map((i, idx) => (
                    <li key={idx}>
                      <code className="font-mono">{i.path}</code> — {i.message}
                    </li>
                  ))}
                  {issues.length > 8 && (
                    <li className="text-destructive/70">
                      …and {issues.length - 8} more
                    </li>
                  )}
                </ul>
              </div>
            )}

            {preview && issues.length === 0 && (
              <div className="space-y-2 rounded-md border border-border bg-background/50 p-3 text-xs">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Preview
                </div>
                <div className="text-sm font-medium">{preview.project.name}</div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {preview.project.id}
                </div>
                {preview.project.description && (
                  <div className="text-xs text-muted-foreground">
                    {preview.project.description}
                  </div>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>
                    {preview.project.diagrams.length} diagram
                    {preview.project.diagrams.length === 1 ? "" : "s"}
                  </span>
                  {preview.project.tours && preview.project.tours.length > 0 && (
                    <span>
                      {preview.project.tours.length} tour
                      {preview.project.tours.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                {preview.collidesWith && (
                  <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div>
                      {preview.collidesWith === "manifest"
                        ? `A bundled project with id "${preview.project.id}" already exists. Importing will replace your local draft for that project — the published bundle isn't touched.`
                        : `A local draft for "${preview.project.id}" already exists. Importing will overwrite it.`}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-accent"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={onConfirm}
                disabled={!preview || issues.length > 0}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                Import + open editor
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
