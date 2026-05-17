import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Keyboard, X } from "lucide-react";
import { useHotkeys } from "react-hotkeys-hook";

interface Shortcut {
  keys: string;
  description: string;
}

const SHORTCUTS: { group: string; entries: Shortcut[] }[] = [
  {
    group: "Navigation",
    entries: [
      { keys: "⌘/Ctrl + K", description: "Open search palette" },
      { keys: "?", description: "Open this cheatsheet" },
      { keys: "Esc", description: "Clear selection / close drawer" },
    ],
  },
  {
    group: "Canvas",
    entries: [
      { keys: "Click", description: "Select a node or edge" },
      { keys: "Double-click", description: "Drill into child diagram / follow cross-project edge" },
      { keys: "Scroll / pinch", description: "Zoom" },
      { keys: "Drag pane", description: "Pan" },
    ],
  },
  {
    group: "Editor (when /edit/...)",
    entries: [
      { keys: "Drag from palette", description: "Create a new node" },
      { keys: "Drag handle to handle", description: "Connect two nodes" },
      { keys: "Delete / Backspace", description: "Delete the selected node or edge" },
      { keys: "⌘/Ctrl + Z", description: "Undo last commit" },
      { keys: "Shift + ⌘/Ctrl + Z", description: "Redo" },
    ],
  },
  {
    group: "Tour player",
    entries: [
      { keys: "→ / n", description: "Next stop" },
      { keys: "← / p", description: "Previous stop" },
      { keys: "Esc", description: "Exit tour" },
    ],
  },
];

export function ShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useHotkeys(
    "shift+/",
    (e) => {
      e.preventDefault();
      setOpen(true);
    },
    { enableOnFormTags: false },
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-accent"
          aria-label="Keyboard shortcuts"
        >
          <Keyboard className="h-4 w-4" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[80vh] w-[560px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border border-border bg-card text-card-foreground shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Dialog.Title className="text-sm font-semibold">Keyboard shortcuts</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md p-1 hover:bg-accent"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="p-4">
            <Dialog.Description className="mb-3 text-xs text-muted-foreground">
              Press <Kbd>?</Kbd> anywhere to re-open this list.
            </Dialog.Description>
            {SHORTCUTS.map((g) => (
              <section key={g.group} className="mb-4 last:mb-0">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {g.group}
                </h3>
                <ul className="space-y-1.5">
                  {g.entries.map((e) => (
                    <li
                      key={e.keys}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-foreground">{e.description}</span>
                      <Kbd>{e.keys}</Kbd>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
      {children}
    </kbd>
  );
}
