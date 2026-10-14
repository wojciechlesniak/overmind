---
id: OVE_DECUI009
title: "Supersede form model: prefilled DecisionProposal with validation"
area: DECUI
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DEC001, OVE_DECUI001]
soft_depends_on: []
provides: ["lib:decision-supersede-form"]
needs: ["contract:DecisionProposal", "contract:DecisionErrors", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/decisions/dialogs/supersede-form.ts", "apps/desktop/src/features/decisions/dialogs/supersede-form.test-fixtures.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 10"]
adr_refs: [8]
---

# OVE_DECUI009: Supersede form model: prefilled DecisionProposal with validation

## 1. Summary

Pure form model for correcting a Decision: starts from the old Decision, lets the Owner change the fields and produces a valid `DecisionProposal` for `POST /decisions/:id/supersede`. No UI.

## 2. Context

ADR 0008: a Decision is never edited; `Zastąp nową Decyzją` creates a new Decision that `supersedes` the old one. The server sets `supersedesId`, `origin` (Owner), `status` and `seq`; the client sends the `DecisionProposal` subset (title, problem, context, alternatives, selectedOption, rationale, participants, evidenceRefs, assumptions, risks, skillsUsed, runId?, reviewDate?, confidence, tags?). Limits come from DEC001: title 1..160, problem 1..4000, alternatives 1..8, rationale 1..4000, assumptions/risks up to 10 items of <= 500, confidence 0..1.

## 3. Scope (in)

- `createSupersedeDraft(view)` (prefill), `validateSupersedeDraft(draft)`, `toSupersedeRequest(draft)`, error mapping `mapSupersedeErrors(issues)`.
- Field-level dirty tracking and `isUnchanged(draft, view)`.

## 4. Out of scope

- Dialog UI (OVE_DECUI010).

## 5. Detailed requirements

1. Prefill copies title, problem, context, alternatives (keys preserved), selectedOption, rationale, assumptions, risks, skillsUsed, tags and `confidence`; `rationale` is NOT cleared but the dialog asks the Owner to explain why (field `reasonForChange`, 1..500, required, sent as the first line of `context` prefixed `Powód zmiany: ` is NOT done: the contract has no such field; instead `reasonForChange` is appended to `rationale` under a `\n\nZmiana: ` marker built client-side, ASSUMPTION documented; reported to DEC to add `supersedeReason`).
2. Participants default to `[{ kind: 'owner', displayName: 'Ty' }]` plus the original participants removed? Decision: participants = original participants plus the Owner (kind `owner`), de-duplicated.
3. `origin`, `sourceKey`, `status`, `supersedesId`, `createdBy` are never in the request (zod `.strict()` check in a test).
4. Validation uses the contract schema from `@overmind/contracts` (`DecisionProposalSchema.omit({ supersedesId, origin, sourceKey })`) so limits are not duplicated; messages are mapped to i18n keys by issue code.
5. Alternatives editing rules: at least 1, at most 8; keys `[a-z0-9_]{1,32}` auto-generated from the title for new ones and unique; `selectedOption` must reference an existing key (switching it is the typical correction).
6. `isUnchanged` compares normalised JSON; an unchanged draft cannot be submitted (a correction must differ).
7. `toSupersedeRequest` returns `{ proposal }` with trimmed, NFC-normalised strings.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

Contract schemas (OVE_DEC001), i18n.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/decisions/` (feature `decisions`, route `/decisions`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `dialogs/supersede-form.ts` (pure), fixtures file. Imports zod/contracts only.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Old Decision with 8 alternatives: add disabled.
- Title cleared: invalid.
- `selectedOption` removed by deleting its alternative: invalid with message.
- Confidence outside 0..1: clamped in the UI control, rejected by schema.
- Skills used snapshot is copied as is; the Owner cannot add skills (they come from runs).

## 11. Acceptance criteria

- [ ] Given D-14, Then `createSupersedeDraft` returns a draft that validates.
- [ ] Given forbidden fields in the output, Then a strictness test fails.
- [ ] Given an unchanged draft, Then `isUnchanged` is true.
- [ ] Given invalid selectedOption, Then the validation error key is `decisions-supersede:errors.selectedOption`.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `supersede-form.test.ts` table tests. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test decisions`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_DECUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_DECUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- GAP (reported to DEC): add an optional `supersedeReason` (<= 500) to the supersede request/event; until then the reason is appended to `rationale`.
- ASSUMPTION: the Owner is added as a participant of the new Decision.
