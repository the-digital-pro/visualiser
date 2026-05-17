import { ChevronRight, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { useStore } from "@/lib/store";
import { navigation } from "@/lib/navigation";

export function Breadcrumb() {
  const navStack = useStore((s) => s.navStack);
  const projects = useStore((s) => s.projects);

  if (navStack.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-sm text-muted-foreground"
    >
      <Link
        to="/"
        state={{ navStack: [] }}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        <Home className="h-3.5 w-3.5" />
        <span>Home</span>
      </Link>
      {navStack.map((frame, i) => {
        const project = projects[frame.projectId];
        const diagram = frame.diagramId
          ? project?.diagrams.find((d) => d.id === frame.diagramId)
          : null;
        const isTop = i === navStack.length - 1;
        const label = diagram
          ? `${project?.name ?? frame.projectId} · ${diagram.name}`
          : project?.name ?? frame.projectId;

        return (
          <span key={`${i}-${frame.projectId}-${frame.diagramId ?? ""}`} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5" />
            {isTop ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <button
                type="button"
                onClick={() => navigation().popTo(i)}
                className="hover:text-foreground"
              >
                {label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
