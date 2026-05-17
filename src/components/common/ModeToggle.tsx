import { useLocation, useNavigate } from "react-router-dom";
import { Eye, Pencil } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Present ↔ Edit segmented control (ADR-0010).
 *
 * Tree-shaken out when VITE_EDITOR_ENABLED is false — the import in Shell.tsx
 * is wrapped in the same env check.
 */
export function ModeToggle() {
  const location = useLocation();
  const navigate = useNavigate();
  const editing = location.pathname.startsWith("/edit/");

  // Only render in a project/diagram context.
  const onProject = /^(?:\/edit)?\/p\/[^/]+\/d\/[^/]+/.test(location.pathname);
  if (!onProject) return null;

  const toggle = () => {
    const next = editing
      ? location.pathname.replace(/^\/edit/, "")
      : `/edit${location.pathname}`;
    navigate(next + location.search, {
      state: location.state,
      replace: true,
    });
  };

  return (
    <div
      className="inline-flex items-center rounded-md border border-border bg-card text-xs"
      role="tablist"
      aria-label="Mode"
    >
      <button
        type="button"
        role="tab"
        aria-selected={!editing}
        onClick={editing ? toggle : undefined}
        className={cn(
          "flex items-center gap-1 rounded-l-md px-2.5 py-1",
          !editing
            ? "bg-primary text-primary-foreground"
            : "hover:bg-accent text-foreground",
        )}
      >
        <Eye className="h-3.5 w-3.5" /> Present
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={editing}
        onClick={!editing ? toggle : undefined}
        className={cn(
          "flex items-center gap-1 rounded-r-md px-2.5 py-1",
          editing
            ? "bg-primary text-primary-foreground"
            : "hover:bg-accent text-foreground",
        )}
      >
        <Pencil className="h-3.5 w-3.5" /> Edit
      </button>
    </div>
  );
}
