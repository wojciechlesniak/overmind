---
id: OVE_ONB031
title: "Define onboarding contracts for steps 3-4: confirm, docs link, Telegram, summary, greeting"
area: ONB
kind: contract
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA016, OVE_ONB001, OVE_TG001]
soft_depends_on: []
provides: ["contract:OnboardingWorkspaceStep", "contract:OnboardingDocumentation", "contract:OnboardingTelegramDecision", "contract:OnboardingSummary", "contract:OnboardingGreeting", "lib:onboarding-step34-errors"]
needs: ["contract:OnboardingState", "contract:ProjectDocRef", "contract:TelegramChannelStatus"]
owns: ["packages/contracts/src/onboarding/workspace-step.ts", "packages/contracts/src/onboarding/documentation.ts", "packages/contracts/src/onboarding/telegram-decision.ts", "packages/contracts/src/onboarding/summary.ts", "packages/contracts/src/onboarding/greeting.ts", "packages/contracts/src/onboarding/step34-errors.ts", "packages/contracts/src/onboarding/__tests__/step34-*.test.ts"]
reads: ["packages/contracts/src/onboarding/state.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [6, 10, 16, 28]
---

# OVE_ONB031: Define onboarding contracts for steps 3-4: confirm, docs link, Telegram, summary, greeting

## 1. Summary

Adds the zod schemas, error codes and route shapes that wizard steps 3 'Pierwszy Workspace' and 4 'Telegram (opcjonalnie)' and the completion screen need beyond ONB001: confirming the Workspace step, suggesting and linking Project Documentation, persisting the Telegram decision, the completion summary, and the first Chief greeting. Additive only; no behaviour.

## 2. Context

ONB001 defines `OnboardingState`, whose `steps.workspace.done` and `steps.telegram.status` exist but have no dedicated write paths. ONB019 flags this as an open amendment. Steps 3 and 4 have no mock; their UI composes wizard-kit components (the visual follows steps 1-2: Kreator-Folder.png and Kreator-Polaczenia.png). Project Documentation (ADR 0016, glossary) is the Markdown files in the project folder in Git; registering one is `RegisterProjectDoc` (DATA017). The contracts are written first (CONVENTIONS section 6) so the use-case, route and UI tasks (ONB032..ONB043) can start in parallel against stubs.

## 3. Scope (in)

- One contract file per concept under `packages/contracts/src/onboarding/` (listed in `owns`); barrel is generated (ARCH009).
- Error codes and their HTTP mapping and `errors:` message keys.
- Contract tests (valid, invalid, strictness, no secret fields).

## 4. Out of scope

- Use cases and routes: ONB032 (workspace confirm), ONB033 (docs), ONB034 (Telegram decision), ONB035 (summary), ONB036 (greeting).
- Any change to ONB001 files (this task only adds files; `OnboardingState` stays as is).

## 5. Detailed requirements

1. **WorkspaceConfirm.** `ConfirmWorkspaceStepInput = { workspaceId: string; name: string (trimmed 1..80, no control chars); isolated: boolean }` (strict). Route shape `POST /v1/onboarding/workspace/confirm` (owner scope, `Idempotency-Key` header required). `Result = { workspaceId; name; isolated; stepDone: true; currentStep: 4 }`.
2. **Documentation suggestions.** `DocSuggestion = { id: string (opaque, stable hash of workspace+relative path); relativePath: string (max 300, shown as-is, plain text); title?: string (max 200, from first heading, plain text); kind: 'readme'|'specification'|'docs_folder_file'|'adr'|'other_markdown'; sizeBytes: int }`. `SuggestDocsResult = { suggestions: DocSuggestion[] (max 12); scanned: { truncated: boolean } }`. Route `GET /v1/onboarding/documentation/suggestions?workspaceId=`.
3. **Link documentation.** `LinkDocumentationInput = { workspaceId: string; source: { kind: 'suggestion'; suggestionId: string } | { kind: 'picked_path'; pathText: string (1..1024, untrusted) } }`; `Result = { projectDocId: string; relativePath: string; title?: string }`. Route `POST /v1/onboarding/documentation/link` (key required). `GET /v1/onboarding/documentation/linked?workspaceId=` returns `{ linked: { projectDocId; relativePath; title? } | null }`. Unlink: `DELETE /v1/onboarding/documentation/link/{projectDocId}` (only while onboarding is not completed).
4. **Telegram decision.** `TelegramDecisionInput = { decision: 'skipped' | 'undecided' }` (`'done'` is never client-writable; the engine derives it from the pairing). Route `PUT /v1/onboarding/telegram-decision`. `Result = { telegram: 'pending'|'skipped'|'done' }`.
5. **Summary.** `OnboardingSummary = { workspace: { id; name; isolated: boolean; displayPath; rights: { read: true; write: boolean; execute: boolean } }; clis: { id: 'claude'|'codex'; planText?: string (max 60, verbatim plain text) }[]; isolation: { status: 'passed'|'failed'|'unknown'; checkedAt?: ISODateTime }; documentation: { relativePath; title? } | null; telegram: { status: 'pending'|'skipped'|'done'; botUsername?: string (max 64); paired: boolean } }`. No tokens, codes or absolute paths. Route `GET /v1/onboarding/summary`.
6. **Greeting.** `ChiefGreeting = { textKey: 'onboarding.greeting.withDocs'|'onboarding.greeting.noDocs'; params: { workspaceName: string; docTitle?: string }; text: string (English fallback, max 600) }`. Route `GET /v1/onboarding/greeting/preview?workspaceId=` returns it (used by the step 3 preview and by the posting use case, so both show the same text).
7. **Errors (closed set, additive to ONB001):** `onboarding.workspace_missing` (404), `onboarding.workspace_name_invalid` (422, `details.reason` in `empty|too_long|control_chars`), `onboarding.workspace_name_conflict` (409), `onboarding.doc_rejected` (422, `details.reason` in `outside_workspace|not_markdown|too_large|symlink|not_found|not_allowed`), `onboarding.doc_already_linked` (409), `onboarding.step_not_active` (409, writes allowed only for the current or an earlier step), `onboarding.already_completed` (reused from ONB001).
8. All schemas `.strict()`; none contains `token`, `code`, `secret`, canonical path fields; a contract test walks every schema and fails if such a key is introduced (guards ADR 0006 and SEC003).
9. Every route registered in `OnboardingRoutes`-style metadata (method, path, scope `owner`, `idempotent`) so ENGINE docs and api-client generation (ARCH008) pick them up.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

ONB001 (`OnboardingState`, error helper `lib:onboarding-errors`), DATA `ProjectDocRef`, TG001 `TelegramChannelStatus`, the contract pipeline (ARCH008), the `Result` and error model (ARCH003). Do not redefine `Workspace` or `ProjectDocRef`; reference their ids only.

## 8. Architecture and code placement

`packages/contracts/src/onboarding/*.ts` (domain-free, zod only). No imports from other layers. Types are inferred from schemas; JSON Schema is generated, not handwritten.

## 9. Security and safety

- No schema can carry a secret: the Telegram bot token and pairing code are not part of any onboarding contract (they live in the TG contracts and never in onboarding state or summary).
- `pathText` and `relativePath` are untrusted text: contracts bound the length only; canonicalisation is the use case's job (SEC002).
- `decision: 'done'` is not writable by the client so the UI cannot fake a pairing.
- Display strings (`title`, `planText`, `botUsername`) are `userVisibleVerbatim` plain text, never rendered as markup.

## 10. Errors and edge cases

- Unknown extra keys rejected with a validation error.
- Name with only whitespace -> `workspace_name_invalid`.
- Greeting `docTitle` longer than 200 is truncated by the producer; schema rejects longer input.

## 11. Acceptance criteria

- [ ] Given each schema when valid fixtures are parsed then they pass, and invalid or extra-key fixtures fail.
- [ ] Given the contract walker then no schema contains a forbidden key (`token`, `code`, `secret`, `canonicalPath`).
- [ ] Given the additive-only check (ARCH008) then it passes against ONB001.
- [ ] Given the route metadata then every route has scope `owner` and mutating routes are marked idempotent.
- [ ] Given each error code then HTTP status and message key exist.

## 12. Test plan

Vitest in `packages/contracts`: `step34-schemas.test.ts` (fixtures), `step34-forbidden-keys.test.ts` (walker), `step34-errors.test.ts`. Command: `pnpm --filter @overmind/contracts test onboarding`.

## 13. Parallelization notes

Blocks ONB032..ONB036 and the UI tasks (which can start against the exported types). Conflict hotspot: none (new files only; barrel is generated).

## 14. Open questions and assumptions

- ASSUMPTION: a dedicated confirm route is cleaner than overloading `SaveOnboardingProgress` (resolves the open amendment in ONB019; ONB019 SHOULD call ONB032 instead; see proposal in section 14 of ONB032).
- ASSUMPTION: `'undecided'` lets the Owner reopen the Telegram choice after pressing Skip then Back.
- OPEN: whether the greeting text is later model-generated; the MVP default is a fixed localized template.
