---
id: OVE_ONB035
title: "Implement GetOnboardingSummary: a redacted read model for the completion screen"
area: ONB
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_DATA011, OVE_DATA017, OVE_ONB003, OVE_ONB006, OVE_ONB031, OVE_ONB034, OVE_PERM031, OVE_TG005]
soft_depends_on: ["OVE_ONB033"]
provides: ["usecase:GetOnboardingSummary", "api:onboarding.summary", "lib:api-client-onboarding-summary"]
needs: ["usecase:GetWorkspace", "usecase:GetWizardChecks", "port:AllowedDirectoryReader", "usecase:ListProjectDocs", "port:ChannelStatusReader", "lib:route-module"]
owns: ["packages/application/src/onboarding/summary/**", "packages/gateway/src/routes/onboarding/summary.route.ts", "packages/api-client/src/onboarding/summary.ts"]
reads: ["packages/application/src/onboarding/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [6, 10]
---

# OVE_ONB035: GetOnboardingSummary

## 1. Summary

A read-only use case and route that assembles one redacted summary of the four wizard steps (folder and rights, logged-in CLIs and isolation result, Workspace name and isolation, linked documentation, Telegram status) for the completion screen. Having one projection keeps the UI from stitching five queries and from seeing anything it should not.

## 2. Context

After step 4 the wizard shows a review ('Wszystko gotowe') before 'Wejdź do Pulpitu' (ONB040). The Owner needs to see what they are about to start working with, and to be able to jump back to fix something. The data already exists in onboarding state, Workspace, Allowed Directory, wizard checks and Telegram status; this task only projects it, with the rule that no secret and no canonical path leaves the engine.

## 3. Scope (in)

- `GetOnboardingSummary` use case returning `OnboardingSummary` (ONB031).
- Route `GET /v1/onboarding/summary`, api-client function.

## 4. Out of scope

- UI (ONB040). Completion (ONB007). Posting the greeting (ONB036).

## 5. Detailed requirements

1. Valid only when `steps.folder.done && steps.connections.done && steps.workspace.done` (else `onboarding.step_not_active`); allowed while status is `in_progress` and after `completed` (Dashboard may show it once more? no: after completion returns `already_completed`-flagged result with the same data; read is harmless).
2. Workspace: `name`, `isolated`, `displayPath` (the `~`-form from onboarding state, never canonical), `rights` from the stored policy via `AllowedDirectoryReader`.
3. CLIs: from the latest cached wizard checks (`GetWizardChecks`): the ids whose status is `ready`; `planText` copied verbatim (bounded 60, plain text); Ollama is not listed (it never counts for the gate). `isolation.status` is `passed` when `isolation_test` is ready, `failed` when failed, else `unknown`; `checkedAt` from the check.
4. Documentation: the wizard-linked ref (ONB033) as `{ relativePath, title? }` or `null`.
5. Telegram: `resolveTelegramStatus` (ONB034); `botUsername` only when a bot is configured; `paired` boolean. Never the token, never the code, never the chat id.
6. The response includes `Cache-Control: no-store`.
7. No side effects, no audit write (read of already-owned data), but access is logged at debug without bodies.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`GetWorkspace`, `GetWizardChecks` (ONB006), `AllowedDirectoryReader`, `ListProjectDocs`, `ChannelStatusReader`, `resolveTelegramStatus` (ONB034), the contract from ONB031.

## 8. Architecture and code placement

`packages/application/src/onboarding/summary/{get-onboarding-summary.ts, project-summary.ts}`; `project-summary.ts` is a pure mapper `(inputs) => OnboardingSummary` that is also the redaction point (an explicit allowlist, never spread of source objects). Route module `summary.route.ts`.

## 9. Security and safety

- Explicit allowlist mapping; a test fails if any field not in the schema is passed through.
- No canonical paths, tokens, codes, chat ids, raw CLI output; `planText` and `title` are plain text, length-bounded.
- Owner desktop principal only; Telegram principals 403.
- If any source cannot be read the whole call fails closed with a typed error rather than returning partial 'ready' data.

## 10. Errors and edge cases

- Cached checks missing: `isolation.status: 'unknown'` and `clis: []` would contradict the gate; in that case return `onboarding.checks_failed` (the UI sends the Owner to step 2).
- Workspace deleted: `workspace_missing`.
- Telegram adapter not started: status `pending` with `paired: false`.
- Very long names: already bounded by contracts.

## 11. Acceptance criteria

- [ ] Given all steps done then the summary has all five blocks and passes schema validation.
- [ ] Given a source object with extra fields (canonical path, token-like key) then they do not appear in the output.
- [ ] Given steps not done then `step_not_active`.
- [ ] Given Telegram skipped then `status: 'skipped'` and no `botUsername` unless a bot exists.
- [ ] Given a Telegram principal then 403.

## 12. Test plan

Unit: `project-summary.test.ts` (allowlist, property test with injected extra keys), use-case test with fakes, route test. Command: `pnpm --filter @overmind/application test onboarding/summary`.

## 13. Parallelization notes

Parallel with ONB032..ONB034, ONB036. Needs ONB034 only for the derivation function; stub it until merged.

## 14. Open questions and assumptions

- ASSUMPTION: the summary route stays available after completion (read-only) so the shell can reuse it later; if the Owner prefers it gone, the route returns `already_completed` without data.
