import { lazy, Suspense } from "react";
import { createBrowserRouter, Outlet, type RouteObject } from "react-router-dom";
import { Home } from "@/pages/Home";
import { ProjectRedirect } from "@/pages/ProjectRedirect";
import { DiagramPage } from "@/pages/DiagramPage";
import { TourView } from "@/pages/TourView";
import { NotFound } from "@/pages/NotFound";
import { Shell } from "./Shell";

/**
 * ADR-0010: when `VITE_EDITOR_ENABLED=false`, `/edit/*` routes do not exist
 * AND the editor module is tree-shaken from the bundle. The conditional
 * around `lazy(...)` ensures the import expression is unreachable in the
 * Present-only build.
 */
const EDITOR_ENABLED = import.meta.env.VITE_EDITOR_ENABLED !== "false";

const EditorView = EDITOR_ENABLED
  ? lazy(() => import("@/pages/EditorView").then((m) => ({ default: m.EditorView })))
  : null;

const editorRoutes: RouteObject[] =
  EDITOR_ENABLED && EditorView
    ? [
        {
          path: "edit/p/:projectId/d/:diagramId",
          element: (
            <Suspense fallback={<div className="p-6">Loading editor…</div>}>
              <EditorView />
            </Suspense>
          ),
        },
      ]
    : [];

export const router = createBrowserRouter([
  {
    element: (
      <Shell>
        <Outlet />
      </Shell>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: "p/:projectId", element: <ProjectRedirect /> },
      { path: "p/:projectId/d/:diagramId", element: <DiagramPage /> },
      { path: "tour/:projectId/:tourId", element: <TourView /> },
      ...editorRoutes,
      { path: "*", element: <NotFound /> },
    ],
  },
]);
