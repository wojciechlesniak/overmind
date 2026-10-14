---
id: OVE_ONB001
title: "Define the onboarding contracts: state, wizard checks, folders, routes, events"
area: ONB
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH008, OVE_ARCH010, OVE_DATA009, OVE_PERM009, OVE_TG001]
soft_depends_on: []
provides: ["contract:OnboardingState", "contract:WizardChecks", "contract:OnboardingRoutes", "event:onboarding.state_changed", "event:onboarding.check_updated", "event:onboarding.completed", "lib:onboarding-errors", "lib:evaluate-wizard-gate"]
needs: ["lib:contract-pipeline", "contract:RouteContract", "contract:AppError", "contract:LocalProof", "contract:Workspace", "contract:TelegramChannelStatus", "lib:define-event"]
owns: ["packages/contracts/src/onboarding/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [10, 21, 22]
---

# OVE_ONB001: Define the onboarding contracts: state, wizard checks, folders, routes, events

## 1. Summary

Adds the zod schemas and TypeScript types for the first-run wizard: `OnboardingState` (resume point and per-step results), `WizardCheck` and `WizardChecksResult` (system checks of step 2), `FolderCandidate`, `ProvisionFirstFolderInput/Result`, the login-terminal session types, the route contracts under `/v1/onboarding/*`, the events and the error codes.

## 2. Context

The wizard has four steps (VIEWS 'Onboarding 1/2' plus steps 3 and 4 without mocks): 1 Allowed folder with rights, 2 CLI and isolation, 3 First Workspace, 4 Telegram (optional). It must resume after a crash or quit, must block the Owner from finishing without a folder (SPEC 16.1: no folder means no agent access) and without working isolation (SPEC 11: nothing runs without it), and must not duplicate what other areas own (PERM, BOX, PROV, TG, DATA). The contracts here are the shared language between the use cases (ONB003..008), the routes (ONB009/010) and the UI (ONB011..022). Contract-first (ARCH008): additive only.

## 3. Scope (in)

- `packages/contracts/src/onboarding/state.ts`: `OnboardingStepId`, `OnboardingState`, step result shapes.
- `.../checks.ts`: `WizardCheckId`, `WizardCheck`, `WizardChecksResult`, `WizardGate`.
- `.../folders.ts`: `FolderCandidate`, `SuggestFoldersResult`, `ValidateFolderInput/Result`, `ProvisionFirstFolderInput/Result`, `RightsInput`.
- `.../login.ts`: `LoginTerminalSession`, `LoginScreenFacts`, request/response bodies.
- `.../routes.ts`: route contracts and `ONBOARDING_INVALIDATING_EVENTS`.
- `.../events.ts` and `.../errors.ts`.
- Builders `buildOnboardingState`, `buildWizardChecks` under `@overmind/contracts/testing`.

## 4. Out of scope

- Use cases, persistence, routes and UI.
- Telegram contracts (TG001) and Workspace contract (DATA009): imported, not copied.
- Permission contracts (PERM001): imported.

## 5. Detailed requirements

1. **OnboardingState (strict).** `{ version: 1; status: 'not_started'|'in_progress'|'completed'; currentStep: 1|2|3|4; steps: { folder: { done: boolean; workspaceId?: string; directoryId?: string; rights?: { read: boolean; write: boolean; execute: boolean }; displayPath?: string }; connections: { done: boolean; loggedInClis: ('claude'|'codex')[] }; workspace: { done: boolean; workspaceId?: string }; telegram: { status: 'pending'|'skipped'|'done' } }; startedAt?: ISODateTime; completedAt?: ISODateTime; updatedAt: ISODateTime }`. Invariants documented and tested: `completed` implies folder, connections and workspace done; `currentStep` never exceeds the first not-done required step.
2. **Step ids.** `OnboardingStepId = 'folder'|'connections'|'workspace'|'telegram'` with numeric order 1..4; route names use ids, the counter shows 'Krok N z 4'.
3. **WizardCheckId** = `'apple_container'|'isolation_test'|'herdr'|'claude'|'codex'|'ollama'` (the six rows of the mock, in this order). `WizardCheck = { id; status: 'pending'|'running'|'ready'|'waiting'|'skipped'|'failed'; statusKey: string (closed key set e.g. 'ready','passed','logged_in','waiting_for_owner','skipped'); detail?: { versionText?: string (max 60, e.g. 'claude 2.4.1'); planText?: string (max 60, e.g. 'Claude Max'); progress?: { done: int; total: int } ; reasonCode?: string (closed set); remedyKey?: string }; checkedAt?: ISODateTime }`. `versionText` and `planText` originate from CLI output and are `userVisibleVerbatim` (plain text only, never interpreted). No raw CLI output field exists.
4. **WizardChecksResult** = `{ checks: WizardCheck[]; gate: { canContinue: boolean; blockedBy: ('isolation'|'herdr'|'no_cli_logged_in'|'container_missing')[] }; runningAny: boolean }`. Rule encoded in a pure function `evaluateGate(checks)` exported from contracts: continue only when `apple_container`, `isolation_test` and `herdr` are `ready` and at least one of `claude` or `codex` is `ready` (logged in); Ollama never counts.
5. **FolderCandidate** = `{ id: string (opaque, stable per canonical path hash); displayPath: string (with ~); label: string; depth: 0|1; parentId?: string; disabledReason?: 'system_path'|'outside_home'|'symlink'|'sensitive'|'already_added'|'not_a_directory'|'unreadable' }`. `SuggestFoldersResult = { nodes: FolderCandidate[]; root: { displayPath: string } }`.
6. **ValidateFolderInput** = `{ pathText: string (1..1024, untrusted, from the native picker) }` -> `{ candidate: FolderCandidate; canonical: never exposed }` or error `onboarding.folder_rejected` with `details.reason` from the same closed set. The canonical absolute path never appears in the response; the opaque `id` is the handle.
7. **ProvisionFirstFolderInput** = `{ folderId: string; rights: { read: true; write: boolean; execute: boolean }; proof: LocalProof (PERM009); idempotencyKey in header }`; `Result = { workspaceId; directoryId; policyId; displayPath; rights }`. Read is always true (a folder without read is meaningless; documented).
8. **Login terminal.** `LoginTerminalSession = { id; providerId: 'claude'|'codex'; state: 'preparing'|'awaiting_browser'|'awaiting_code'|'verifying'|'logged_in'|'failed'|'cancelled'|'expired'; loginUrl?: string (https only, already classified by `classifyLoginUrl`); expiresAt }`; `LoginInput = { data: string (max 4096, UTF-8) }`. Terminal output is NEVER part of any JSON schema here (streamed on a separate channel, ONB010).
9. **Routes (all scope owner):** `GET /v1/onboarding/state`; `PUT /v1/onboarding/progress { currentStep }` (non-skipping navigation); `GET /v1/onboarding/folders/suggest`; `POST /v1/onboarding/folders/validate`; `POST /v1/onboarding/folders/provision` (key-required, local proof); `GET /v1/onboarding/checks`; `POST /v1/onboarding/checks/run { ids?: WizardCheckId[] }`; `POST /v1/onboarding/checks/setup { proof: LocalProof }` (key-required; sets up the container kernel/system with Local Approval, see ONB006); `POST /v1/onboarding/complete` (key-required); `POST /v1/onboarding/login/start { providerId }`; `POST /v1/onboarding/login/:id/input`; `GET /v1/onboarding/login/:id/stream` (terminal stream); `POST /v1/onboarding/login/:id/cancel`. Telegram steps reuse `api:telegram.*` (TG012) and Workspace rename uses `api:workspaces.*` (DATA011): not redeclared.
10. **Events (ephemeral unless noted):** `onboarding.state_changed { step, status }`, `onboarding.check_updated { id, status }`, `onboarding.completed` (persisted domain event). `ONBOARDING_INVALIDATING_EVENTS` = these plus `sandbox.image_progress`, `provider.login_restored`, `connection.status_changed`, `telegram.channel.status.changed`.
11. **Error codes:** `onboarding.step_blocked`, `onboarding.folder_rejected`, `onboarding.folder_already_provisioned`, `onboarding.checks_failed`, `onboarding.not_ready_to_complete`, `onboarding.login_busy`, `onboarding.login_expired`, `onboarding.already_completed`; each with HTTP mapping and an `errors:` message key.
12. **Compatibility.** `.strict()` everywhere except forward-compatible enums handled by consumers; additive-only check (ARCH008); consumers ignore unknown keys.

## 6. Design notes

N/A, functionality only (no mock region).

## 7. Reuse

- Contract pipeline (ARCH008), `ErrorCode` catalogue (ARCH003), `LocalProof` (PERM009), `Workspace` (DATA009), `TelegramChannelStatus` (TG001), `classifyLoginUrl` types (SEC009).

## 8. Architecture and code placement

`packages/contracts/src/onboarding/**`. Contract layer; zod and constants only; `evaluateGate` is the only function (pure).

## 9. Security and safety

- Closed enums and length caps on every string; no field can carry a raw path except the user-visible display path (with `~`), which is derived by the engine.
- Canonical absolute paths never cross to the UI (they could reveal the user name; the UI works with opaque ids).
- Terminal output is excluded from JSON contracts and event payloads by construction (SEC009 L2).
- Login URLs appear only after classification (https + host allowlist); otherwise the field is absent.
- All routes owner scope; the Telegram and agent principals cannot call them.

## 10. Errors and edge cases

- Unknown step or check id from a newer engine: consumers treat unknown ids as 'other' and skip rendering the row.
- Completed state with missing step data (manual DB edit): contract test documents the repair rule in ONB003.
- `rights.write=false, execute=true`: allowed by contract (execute without write is unusual but valid); a UI warning only for write+execute.
- Path text with NUL or control characters: rejected by the schema (`validation.invalid_input`).
- Version text longer than 60: truncated by the engine, schema rejects longer.

## 11. Acceptance criteria

- [ ] Given the fixtures then all schemas parse and round-trip.
- [ ] Given `evaluateGate` with isolation failed then `canContinue` is false and `blockedBy` contains 'isolation'.
- [ ] Given only Ollama ready then `canContinue` is false with 'no_cli_logged_in'.
- [ ] Given a state with `status: 'completed'` and `folder.done: false` then parsing fails the invariant refinement.
- [ ] Given the route contracts then they appear in the generated route table with scope owner and the documented idempotency modes.

## 12. Test plan

- Vitest contract tests: parse tables, invariants, gate truth table (all 2^5 combinations), error catalogue guard, registry guard for events.
- Commands: `pnpm --filter @overmind/contracts test onboarding`.

## 13. Parallelization notes

First ONB task; everything else depends on it. Parallel with PERM, PROV, BOX tasks as they only provide capabilities.

## 14. Open questions and assumptions

- ASSUMPTION: Ollama never unlocks the wizard (it is an optional local fallback model, mock says 'Opcjonalny model zapasowy').
- OPEN: whether `execute` should be hidden when `write` is off; kept simple (independent toggles as in the mock).
- OPEN: the routes' final names are reviewed against ENGINE013 conventions during linking.
