# ADR-0003: Navigation state ownership

**Status:** Accepted (2026-05-17)
**Related:** PRD §4.1, §6.4, §7.1; ADR-0006 (canvas lifecycle)

## Context

The PRD asserts three things that don't fully reconcile:

1. "NavigationController owns the history stack of frames."
2. "Browser back/forward integrates via react-router's history."
3. "Every view, selection, and breadcrumb state is encoded in the URL."

Stuffing the whole breadcrumb stack into the URL produces ugly, fragile links. Storing only the current frame loses breadcrumb depth on refresh. We need to decide who actually owns what.

## Decision

**URL encodes the current frame only. The semantic stack rides inside `window.history.state`. NavigationController owns the stack; React Router owns the browser history primitive.**

- URLs stay copy-pasteable: `/p/payments/d/container?focus=order-svc`.
- Every navigation calls `history.pushState({ stack: [...] }, '', newUrl)` so the stack travels with the entry.
- Soft refresh (F5) preserves `history.state` → breadcrumb intact.
- Hard reload from a bookmark or Slack link arrives with no stack → renders as a deep-link entry with an empty breadcrumb. Semantically correct: a shared link is *a place*, not *a journey*.
- React Router's `useNavigationType()` POP events trigger `NavigationController.popFromBrowser()`, keeping its in-memory stack in lockstep with the browser.

## Consequences

**What this commits us to:**

- All in-app navigation goes through `NavigationController.push({...})`. No direct `navigate()` calls from anywhere except the controller. (Enforced by lint rule if it becomes a problem.)
- Breadcrumb is rendered directly from `NavigationController.stack` — never from URL parsing.
- The deep-link path and the in-app navigation path produce the *same* visible state for the current frame; the only difference is breadcrumb depth.
- Tours are the explicit way to share "a journey" — they're a structured, repeatable variant of a breadcrumb stack.

**What it costs us:**

- We can't share a breadcrumb in a link. We accept this as correct (see Tours above).
- `history.state` has a ~640KB browser limit; we'll never approach it (50 frames × tiny objects).

## Alternatives considered

- **URL-as-only-source-of-truth (stack serialised in URL).** Refresh-perfect, but ugly links and a fragile encoding. Rejected for sharability and aesthetics.
- **In-memory stack only; URL = current frame.** Clean URLs, but soft reload wipes the breadcrumb. Bad UX for the common F5 case.
- **Rebuild breadcrumb from semantic context.** Works for drill-down (`childDiagramId` reverse-lookup) but not for follow-connection — you can't recover "I came from Booking" from a Payments-only URL.

## Implementation notes

- `lib/navigation.ts` exports a `NavigationController` singleton (or hook-based context).
- Public API:
  ```ts
  push(frame: Frame): void;          // pushes URL + history.state
  pop(): void;                       // browser-back equivalent
  replace(frame: Frame): void;       // for filter changes etc.
  popFromBrowser(): void;            // wired to React Router POP events
  readonly stack: Frame[];
  ```
- `Frame = { projectId, diagramId, focusNodeId?, filters? }`.
- The URL ↔ Frame codec lives in `lib/url.ts` (Phase 0). The controller is built on top of it (Phase 1).
- `window.history.state` rehydration runs once on app boot; if `state.stack` exists, the controller initialises from it.
