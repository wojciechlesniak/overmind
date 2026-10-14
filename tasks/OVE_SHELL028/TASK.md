---
id: OVE_SHELL028
title: "Provide the shared live-region announcer and the page-title hook alias"
area: SHELL
kind: feature
size: XS
priority: P1
mvp: true
status: todo
depends_on: [OVE_SHELL007, OVE_SHELL010, OVE_SHELL025]
soft_depends_on: ["OVE_SHELL025"]
provides: ["lib:live-announcer", "lib:use-announce", "lib:use-page-title"]
needs: ["lib:i18n-provider", "lib:use-document-title"]
owns: ["apps/desktop/src/app/a11y/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12"]
adr_refs: [18]
---

# OVE_SHELL028: Provide the shared live-region announcer and the page-title hook alias

## 1. Summary

One app-wide polite/assertive live region (`LiveAnnouncer`) and one hook `useAnnounce()` so any feature can announce changes (Workspace switched, message sent, Task moved) to screen readers without creating its own `aria-live` nodes. Also exposes `usePageTitle()` as the feature-facing name of the title hook from OVE_SHELL025.

## 2. Context

SHELL011, SHELL017 and SHELL025 each announce through a live region; view areas (Board drag and drop, Chat) need the same. A single mounted region avoids duplicate nodes, missed announcements (a region created and filled in the same tick is not read) and inconsistent politeness. Accessibility is part of the Definition of Done (CONVENTIONS 8.4).

## 3. Scope (in)

- `LiveAnnouncer` mounted once by SHELL010 inside the provider stack, rendering two visually hidden regions (`role="status" aria-live="polite"` and `role="alert" aria-live="assertive"`).
- `useAnnounce(): { polite(msg), assertive(msg) }` and non-hook `announce(msg, politeness)` for non-React code.
- `usePageTitle(titleKey | string, params?)`: thin wrapper over `useDocumentTitle` (SHELL025) with the title format `'<title> · Overmind'`.

## 4. Out of scope

- Route-change focus and announcement (OVE_SHELL025 uses this announcer).
- Toasts (OVE_SHELL022); toasts have their own live region from the DS `Toast`.

## 5. Detailed requirements

1. Messages are queued; the same message repeated within 1 s is collapsed; to force re-reading of an identical later message the region content is cleared then set 50 ms later.
2. `polite` messages never interrupt: a pending `assertive` message wins; the queue length is capped at 5 (oldest dropped).
3. Messages are plain text, truncated to 200 characters, HTML-escaped by React (never `dangerouslySetInnerHTML`).
4. Text is already translated by the caller (`t('shell:workspace.switched', {name})`); the announcer does not translate.
5. The regions are rendered once at the root, outside route content, so they survive navigation; `aria-atomic="true"`.
6. In tests a `FakeAnnouncer` (via `lib:desktop-test-providers`) records messages for assertions.
7. `usePageTitle` sets `document.title` on mount and update, restores nothing on unmount (the next route sets its own); empty title falls back to 'Overmind'.

## 6. Design notes

N/A, functionality only. The regions are visually hidden with the DS `sr-only` utility.

## 7. Reuse

`useDocumentTitle` (SHELL025), `useTranslation` (SHELL007), DS `VisuallyHidden`/`sr-only` token utility.

## 8. Architecture and code placement

`apps/desktop/src/app/a11y/{live-announcer.tsx,use-announce.ts,announcer-store.ts,use-page-title.ts,index.ts}`. UI infrastructure; no dependency on features.

## 9. Security and safety

Announcements may contain engine-originated text (agent names, Task titles) which is untrusted: it is rendered as text only, length-capped, and control characters are stripped. Nothing is announced that the visible UI does not show (no hidden disclosure of Private data, ADR 0028).

## 10. Errors and edge cases

- Announce before mount: buffered until the region exists.
- Empty or whitespace message: ignored.
- Rapid bursts (Board drag): capped queue prevents flooding.
- Locale switch: only affects future messages.

## 11. Acceptance criteria

- [ ] Given `announce('X','polite')` then the polite region contains 'X' within 100 ms.
- [ ] Given the same message twice within 1 s then it is announced once.
- [ ] Given an assertive message while polite ones are queued then the assertive one is announced first.
- [ ] Given a 500-character message then at most 200 characters are rendered.
- [ ] Given `usePageTitle('shell:title.board')` then `document.title` is 'Tablica Zadań · Overmind' in PL.

## 12. Test plan

Vitest + Testing Library with fake timers; axe check that exactly two live regions exist at the root. Command: `pnpm --filter @overmind/desktop test a11y`.

## 13. Parallelization notes

Small and independent after SHELL010; SHELL011/017/025 may stub `useAnnounce` until it lands.

## 14. Open questions and assumptions

- ASSUMPTION: `lib:use-page-title` is the feature-facing alias; SHELL025 owns the underlying implementation (`useDocumentTitle`).
