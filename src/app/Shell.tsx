import { lazy, Suspense, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandPalette } from "@/components/common/CommandPalette";
import { ShortcutsDialog } from "@/components/common/ShortcutsDialog";
import { useNavigationController } from "@/lib/navigation";

const EDITOR_ENABLED = import.meta.env.VITE_EDITOR_ENABLED !== "false";
const ModeToggle = EDITOR_ENABLED
  ? lazy(() =>
      import("@/components/common/ModeToggle").then((m) => ({ default: m.ModeToggle })),
    )
  : null;

export function Shell({ children }: { children: ReactNode }) {
  // Mount the NavigationController once for the entire app.
  useNavigationController();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 h-14 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-full items-center justify-between px-4">
          <Link
            to="/"
            state={{ navStack: [] }}
            className="font-semibold tracking-tight"
          >
            Architecture Visualizer
          </Link>
          <div className="flex items-center gap-2">
            {ModeToggle && (
              <Suspense fallback={null}>
                <ModeToggle />
              </Suspense>
            )}
            <ShortcutsDialog />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main>{children}</main>
      <CommandPalette />
    </div>
  );
}
