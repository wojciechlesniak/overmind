---
id: OVE_CONNUI013
title: Connections states, boundaries and end-to-end, accessibility and security tests
area: CONNUI
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CONNUI003, OVE_CONNUI004, OVE_CONNUI005, OVE_CONNUI006, OVE_CONNUI007, OVE_CONNUI008, OVE_CONNUI009, OVE_CONNUI010, OVE_CONNUI011, OVE_CONNUI012, OVE_DS032, OVE_DS040, OVE_TEST004]
soft_depends_on: []
provides: []
needs: ["lib:ui-test-harness", "ui:Skeleton", "ui:InfoNote"]
owns: ["apps/desktop/tests/connections/**", "apps/desktop/src/features/connections/components/boundary/**", "apps/desktop/src/features/connections/components/SectionSkeleton.tsx", "apps/desktop/src/features/connections/components/OfflineBanner.tsx"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 14"]
adr_refs: [22, 3]
---

# OVE_CONNUI013: Connections states, boundaries and end-to-end, accessibility and security tests

## 1. Summary

Adds the missing states (loading, error, offline, detect in progress, per-card boundary) and the end-to-end, accessibility, visual and abuse-case suites for the whole Connections feature.

## 2. Context

Connections and models (`Polaczenia`, VIEWS section 13; tab 'Polaczenia i modele' of the Workspace settings tab bar next to 'Ten Workspace' and 'Aplikacja') shows how Overmind reaches models: official CLIs (Claude Code, Codex CLI) that the Owner logs into inside an Overmind terminal ('Overmind nie widzi hasel ani tokenow'), Ollama as local fallback, Telegram as second channel and a disabled 'Klucze API' card ('po MVP'). Right column: 'Gdy konczy sie limit' (fallback order), 'Rownoleglosc' (concurrency stepper) and an amber compliance note. Spec 11, 14; ADR 0022 (official CLIs only, like herdr), 0007 (model per Agent and node), 0006, 0020. Prototype facts (docs/research/prototyp-wnioski.md): CLI logins live in a separate persistent volume inside the container; Overmind never reads credentials. Data: `api:connections.*` (PROV021): `Connection` statuses `unknown|not_installed|needs_login|ready|degraded|limit_reached|error|disabled`; `GET /connections/{id}/status` -> `{connection, usage?:ModelUsage, activeAgents, limit, queued}`. Limits are shown exactly as the CLI reports them with their source ('wg CLI'). Copy: Polish mock copy is the first translation; i18n namespace `connections`. Proves OVE_CONNUI001..012.

## 3. Scope (in)

- `components/boundary/*.boundary.tsx` + `SectionSkeleton`, `OfflineBanner` for this feature; `apps/desktop/tests/connections/*`.

## 4. Out of scope

- Unit tests.

## 5. Detailed requirements

1. States: skeleton cards on first load; per-card error boundary with Retry; offline banner (all actions disabled, fail closed); 'checking...' pill during detect.
2. Visual comparison with each `design.png`.
3. Security: sign-out needs Local Approval with args and proof in body; login dialog has no credential inputs and never opens engine URLs; usage text with HTML stays text; no `principal/channel/local` fields in any body; Telegram transport receives 403 for login/remove.
4. Flows on the mock gateway: detect, login success/expiry/cancel, sign-out, reorder fallback, change concurrency, Ollama pull, Telegram card actions.
5. Accessibility: axe, keyboard, drag via keyboard, focus return from dialogs; i18n PL and pseudo-locale.

## 6. Design notes

Test code plus the small state components.

## 7. Reuse

- OVE_TEST004/005/010, OVE_WSPACE016.

## 8. Architecture and code placement

Owns tests under `apps/desktop/tests/connections/`, boundaries and the skeleton/offline components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that change who can use Overmind's models or sign an account out (logout/remove a connection) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`.

## 10. Errors and edge cases

- Fake timers for polling.

## 11. Acceptance criteria

- [ ] Given a throwing card, Then others work.
- [ ] Given offline, Then controls are disabled.
- [ ] Security matrix passes; visuals within tolerance; axe zero violations.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: as listed. Commands: `pnpm --filter @overmind/desktop test:e2e -g connections`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/tests/connections/**`, `apps/desktop/src/features/connections/components/boundary/**`, `apps/desktop/src/features/connections/components/SectionSkeleton.tsx`, `apps/desktop/src/features/connections/components/OfflineBanner.tsx` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: TEST005 tolerance.
