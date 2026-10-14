---
id: OVE_CONNUI012
title: Compliance note and the disabled API keys card
area: CONNUI
kind: ui
size: XS
priority: P2
mvp: true
status: todo
depends_on: [OVE_CONNUI001, OVE_DS040, OVE_DS079]
soft_depends_on: []
provides: []
needs: ["ui:InfoNote", "ui:ConnectionCard"]
owns: ["apps/desktop/src/features/connections/components/slots/ComplianceNote.panel.tsx", "apps/desktop/src/features/connections/components/slots/ApiKeysCard.card.tsx", "apps/desktop/src/features/connections/model/compliance.ts"]
reads: []
design: design.png
design_source: "Polaczenia#connections/compliance-note (crop 1130,890,300,110 CSS px, tall render); design-api-card.png = Polaczenia#connections/api-card (88,800,513,150)"
spec_refs: ["SPECIFICATION 14"]
adr_refs: [22]
---

# OVE_CONNUI012: Compliance note and the disabled API keys card

## 1. Summary

Implements the amber compliance note at the bottom of the right column and the disabled 'Klucze API' card ('po MVP').

## 2. Context

Connections and models (`Polaczenia`, VIEWS section 13; tab 'Polaczenia i modele' of the Workspace settings tab bar next to 'Ten Workspace' and 'Aplikacja') shows how Overmind reaches models: official CLIs (Claude Code, Codex CLI) that the Owner logs into inside an Overmind terminal ('Overmind nie widzi hasel ani tokenow'), Ollama as local fallback, Telegram as second channel and a disabled 'Klucze API' card ('po MVP'). Right column: 'Gdy konczy sie limit' (fallback order), 'Rownoleglosc' (concurrency stepper) and an amber compliance note. Spec 11, 14; ADR 0022 (official CLIs only, like herdr), 0007 (model per Agent and node), 0006, 0020. Prototype facts (docs/research/prototyp-wnioski.md): CLI logins live in a separate persistent volume inside the container; Overmind never reads credentials. Data: `api:connections.*` (PROV021): `Connection` statuses `unknown|not_installed|needs_login|ready|degraded|limit_reached|error|disabled`; `GET /connections/{id}/status` -> `{connection, usage?:ModelUsage, activeAgents, limit, queued}`. Limits are shown exactly as the CLI reports them with their source ('wg CLI'). Copy: Polish mock copy is the first translation; i18n namespace `connections`. Mock note: 'Automatyczne sterowanie CLI zalezy od zasad dostawcow. Overmind pokazuje limity tak, jak raportuje je CLI.' Disabled card: 'Klucze API' / 'Anthropic, OpenAI i inni', pill 'po MVP', row 'Status' `niedostepne w tej wersji`. Spec: API keys are post-MVP; PROV terms check (`provider.terms_changed`) may show a changed-terms warning.

## 3. Scope (in)

- `components/slots/ComplianceNote.panel.tsx` (order 90), `components/slots/ApiKeysCard.card.tsx` (order 90), `model/compliance.ts`.

## 4. Out of scope

- API key handling (post-MVP).

## 5. Detailed requirements

1. Note: `ui:InfoNote` amber with the mock text (EN: 'Automatic control of the CLIs depends on each provider's terms. Overmind shows limits exactly as the CLI reports them.'). When `api:provider-terms` reports a changed terms state (event `provider.terms_changed`) the note adds 'Provider terms changed on <date>. Check them.' with an acknowledge button (`AcknowledgeProviderTerms`) if the API is available (feature-detect).
2. API keys card: `ui:ConnectionCard` disabled variant (opacity .55, no actions), no inputs of any kind (no field to paste keys), pill 'after MVP', row Status 'not available in this version'.
3. Both are static; no polling.

## 6. Design notes

`design.png` (note, amber border/background) and `design-api-card.png` (disabled card).

## 7. Reuse

- `ui:InfoNote`, `ui:ConnectionCard`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/connections/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that change who can use Overmind's models or sign an account out (logout/remove a connection) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`. Specific: the disabled card contains NO key input so nobody can paste API keys into the app before the secret handling exists.

## 10. Errors and edge cases

- Terms API absent: plain note only.

## 11. Acceptance criteria

- [ ] Given the page, Then note and disabled card match the designs.
- [ ] Given the card, Then no input or button exists.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: component tests, visual of both crops. Commands: `pnpm --filter @overmind/desktop test features/connections/static, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/connections/components/slots/ComplianceNote.panel.tsx`, `apps/desktop/src/features/connections/components/slots/ApiKeysCard.card.tsx`, `apps/desktop/src/features/connections/model/compliance.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- GAP: terms-acknowledge route is not in PROV021 (usecases exist: AcknowledgeProviderTerms); feature-detected.
