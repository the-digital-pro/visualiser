import { useState } from "react";
import { Camera } from "lucide-react";
import { useStore } from "@/lib/store";
import { capturePng } from "@/lib/capturePng";

export function CapturePngButton() {
  const navStack = useStore((s) => s.navStack);
  const current = navStack[navStack.length - 1];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!current?.diagramId) return null;

  const onClick = async () => {
    if (!current.diagramId) return;
    setBusy(true);
    setError(null);
    try {
      await capturePng({
        projectId: current.projectId,
        diagramId: current.diagramId,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Capture diagram as PNG"
        title="Capture this diagram as a PNG"
      >
        <Camera className="h-3.5 w-3.5" />
        <span>{busy ? "Capturing…" : "PNG"}</span>
      </button>
      {error && (
        <div className="absolute right-0 top-full mt-1 max-w-xs rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
