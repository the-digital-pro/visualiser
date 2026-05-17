import { useEffect, useRef } from "react";
import {
  useLocation,
  useNavigate,
  useNavigationType,
  type Location,
} from "react-router-dom";
import { useStore } from "./store";
import { decodeLocation, encodeFrame, framesEqual, type Frame } from "./url";

/**
 * NavigationController (ADR-0003).
 *
 * Single owner of the semantic back-stack. ALL in-app navigation must route
 * through `navigation().push(frame)` / `.replace(frame)`. The URL only encodes
 * the current frame; the full stack rides in `location.state.navStack`, which
 * React Router places into `window.history.state` so it survives soft reload.
 *
 * Browser back/forward (POP events) are translated by syncing the Zustand store
 * to the stack persisted under the destination history entry's state.
 *
 * Mount `useNavigationController()` once at the layout level — the imperative
 * API is then available as `navigation()` from anywhere in the React tree.
 */

const STACK_KEY = "navStack";

type LocationState = { [STACK_KEY]?: Frame[] } | null;

export interface NavigationApi {
  push: (frame: Frame) => void;
  replace: (frame: Frame) => void;
  popTo: (index: number) => void;
}

let actions: NavigationApi | null = null;

export function navigation(): NavigationApi {
  if (!actions) {
    throw new Error(
      "NavigationController not mounted. Add useNavigationController() to a layout component.",
    );
  }
  return actions;
}

function stackFromLocation(location: Location): Frame[] {
  const state = location.state as LocationState;
  const persisted = state?.[STACK_KEY];
  if (persisted && persisted.length > 0) {
    return persisted;
  }
  const { frame } = decodeLocation(location.pathname, location.search);
  return frame ? [frame] : [];
}

export function useNavigationController(): void {
  const navigate = useNavigate();
  const location = useLocation();
  const navType = useNavigationType();
  const lastSyncedKey = useRef<string>("");

  // Mirror the stack-of-record (location.state) into the store on every
  // navigation, including POP (browser back/forward) and PUSH that came from
  // our own action calls. One source of truth: location.state. Store mirrors.
  //
  // `/tour/*` is the exception: the tour player drives navStack imperatively
  // (the URL holds the tour id, not the current frame), so we leave the stack
  // alone while on that surface.
  useEffect(() => {
    if (location.pathname.startsWith("/tour/")) return;
    const stack = stackFromLocation(location);
    const key = `${location.pathname}|${location.search}|${stack.length}`;
    if (key === lastSyncedKey.current) return;
    lastSyncedKey.current = key;
    useStore.setState({ navStack: stack });
  }, [location, navType]);

  // Capture editor mode from the URL so push() preserves the surface.
  const inEditor = location.pathname.startsWith("/edit/");
  const inEditorRef = useRef(inEditor);
  inEditorRef.current = inEditor;

  useEffect(() => {
    actions = {
      push(frame) {
        const current = useStore.getState().navStack;
        // Suppress no-op push if frame matches current top
        if (current.length > 0 && framesEqual(current[current.length - 1], frame)) {
          return;
        }
        const next = [...current, frame];
        navigate(encodeFrame(frame, null, inEditorRef.current), {
          state: { [STACK_KEY]: next },
        });
      },
      replace(frame) {
        const current = useStore.getState().navStack;
        const next = current.length === 0 ? [frame] : [...current.slice(0, -1), frame];
        navigate(encodeFrame(frame, null, inEditorRef.current), {
          state: { [STACK_KEY]: next },
          replace: true,
        });
      },
      popTo(index) {
        const current = useStore.getState().navStack;
        if (index < 0 || index >= current.length - 1) return;
        const next = current.slice(0, index + 1);
        const frame = next[next.length - 1];
        navigate(encodeFrame(frame, null, inEditorRef.current), {
          state: { [STACK_KEY]: next },
        });
      },
    };
    return () => {
      actions = null;
    };
  }, [navigate]);
}

/**
 * Pure helpers — exported for testing without React Router.
 */
export const __nav = {
  pushFrame(stack: Frame[], frame: Frame): Frame[] {
    if (stack.length > 0 && framesEqual(stack[stack.length - 1], frame)) {
      return stack;
    }
    return [...stack, frame];
  },
  replaceTop(stack: Frame[], frame: Frame): Frame[] {
    return stack.length === 0 ? [frame] : [...stack.slice(0, -1), frame];
  },
  popTo(stack: Frame[], index: number): Frame[] {
    if (index < 0 || index >= stack.length) return stack;
    return stack.slice(0, index + 1);
  },
};
