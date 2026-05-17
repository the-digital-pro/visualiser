import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { ProjectSchema } from "@/lib/schema";
import { newProjectScaffold, slugify } from "@/lib/newProject";
import { saveDraft } from "@/lib/drafts";
import { storeActions } from "@/lib/store";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** IDs already in use — checked at validation time so a fresh project can't
   *  collide with a bundled project OR with another local draft. */
  takenIds: Set<string>;
}

export function NewProjectDialog({
  open,
  onOpenChange,
  takenIds,
}: NewProjectDialogProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [idDirty, setIdDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on every open.
  useEffect(() => {
    if (open) {
      setName("");
      setId("");
      setIdDirty(false);
      setError(null);
    }
  }, [open]);

  const autoId = useMemo(() => (name ? slugify(name) : ""), [name]);
  const effectiveId = idDirty ? id : autoId;

  const validate = (): string | null => {
    if (!name.trim()) return "Name is required.";
    if (!effectiveId) return "ID is required.";
    if (!/^[a-z0-9][a-z0-9-]*$/.test(effectiveId)) {
      return "ID must be kebab-case (a–z, 0–9, hyphens) and start with a letter or digit.";
    }
    if (takenIds.has(effectiveId)) {
      return `An existing project or draft already uses the id "${effectiveId}".`;
    }
    return null;
  };

  const submit = () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    const scaffold = newProjectScaffold(effectiveId, name.trim());
    const parsed = ProjectSchema.safeParse(scaffold);
    if (!parsed.success) {
      // Should be unreachable — scaffold is hand-crafted to match the schema.
      setError(parsed.error.issues.map((i) => i.message).join(", "));
      return;
    }
    storeActions.replaceProject(scaffold.id, parsed.data);
    saveDraft(scaffold.id, parsed.data);
    onOpenChange(false);
    navigate(`/edit/p/${scaffold.id}/d/${scaffold.homeDiagramId}`);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[480px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-card text-card-foreground shadow-2xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Dialog.Title className="text-sm font-semibold">New project</Dialog.Title>
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="space-y-4 p-4"
          >
            <Dialog.Description className="text-xs text-muted-foreground">
              Creates a draft in your browser. Export the JSON when you're
              ready to commit it to <code className="font-mono">public/projects/</code>.
            </Dialog.Description>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Name</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Identity Platform"
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                ID <span className="text-muted-foreground/60">(kebab-case)</span>
              </span>
              <input
                value={effectiveId}
                onChange={(e) => {
                  setIdDirty(true);
                  setId(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="identity-platform"
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-sm outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-[10px] text-muted-foreground">
                Auto-derived from the name unless you edit this field.
              </span>
            </label>
            {error && (
              <p className="rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1 text-xs text-destructive">
                {error}
              </p>
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
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" /> Create + open editor
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
