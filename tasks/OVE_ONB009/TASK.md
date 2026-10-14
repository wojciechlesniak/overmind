---
id: OVE_ONB009
title: "Expose onboarding state, folders, checks and completion through routes and api-client"
area: ONB
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ENGINE011, OVE_ENGINE013, OVE_ENGINE014, OVE_ENGINE015, OVE_ENGINE018, OVE_ENGINE019, OVE_ONB003, OVE_ONB004, OVE_ONB005, OVE_ONB006, OVE_ONB007]
soft_depends_on: []
provides: ["api:onboarding.state", "api:onboarding.progress", "api:onboarding.folders.suggest", "api:onboarding.folders.validate", "api:onboarding.folder.provision", "api:onboarding.checks", "api:onboarding.checks.run", "api:onboarding.checks.setup", "api:onboarding.complete", "lib:api-client-onboarding"]
needs: ["lib:route-registrar", "lib:gateway-pipeline", "lib:gateway-idempotency", "lib:gateway-rate-limit", "lib:api-client", "lib:gateway-test-support", "usecase:SuggestFolders", "usecase:ValidateFolderCandidate"]
owns: ["packages/gateway/src/routes/onboarding/state.route.ts", "packages/gateway/src/routes/onboarding/folders.route.ts", "packages/gateway/src/routes/onboarding/checks.route.ts", "packages/gateway/src/routes/onboarding/complete.route.ts", "packages/gateway/src/routes/onboarding/index.ts", "packages/api-client/src/onboarding/index.ts", "packages/api-client/src/onboarding/onboarding-client.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [5, 10]
---

# OVE_ONB009: Expose onboarding state, folders, checks and completion through routes and api-client

## 1. Summary

Registers the owner-scope gateway routes for the onboarding state, progress, folder suggestions, validation, provisioning, the wizard checks (read and run) and completion, adds the typed api-client namespace and wires the onboarding engine module.

## 2. Context

Contracts exist (ONB001) and so do the use cases (ONB003..007). The wizard UI talks only to the api-client (SHELL004/005). Routes follow the gateway conventions of ENGINE011/013/015: schema validation, correlation ids, idempotency for mutating calls, rate limiting and audit of mutations. Long operations (checks including an image build) must not hold a request open: the run route returns 202 and progress arrives by events and polling `GET /checks`.

## 3. Scope (in)

- Route modules under `packages/gateway/src/routes/onboarding/` (one file per route group).
- api-client functions `onboarding.state()`, `.saveProgress()`, `.suggestFolders()`, `.validateFolder()`, `.provisionFolder()`, `.checks()`, `.runChecks()`, `.complete()`.
- Wiring into `onboarding.module.ts` (ONB003 owns the file; this task adds routes through the module's registration hook, not by editing it: the module reads `routes/onboarding/index.ts`).
- Contract tests with `createGatewayUnderTest` (ENGINE018) and a hostile-client suite.
- Rate limits and body size caps.

## 4. Out of scope

- The login terminal routes and stream (ONB010).
- UI.
- Telegram and Workspace routes (TG012, DATA011).

## 5. Detailed requirements

1. **Routes (scope owner; method path -> use case):** `GET /v1/onboarding/state` -> `GetOnboardingState`; `PUT /v1/onboarding/progress` -> `SaveOnboardingProgress` (idempotency natural); `GET /v1/onboarding/folders/suggest` -> `SuggestFolders`; `POST /v1/onboarding/folders/validate` -> `ValidateFolderCandidate` (body max 2 KiB); `POST /v1/onboarding/folders/provision` -> `ProvisionFirstFolder` (idempotency key required; body max 1 KiB; the proof travels in the body field `proof` and is redacted from logs); `GET /v1/onboarding/checks` -> `GetWizardChecks`; `POST /v1/onboarding/checks/run` -> starts `RunWizardChecks` in the background and returns `202 { runningAny: true }`; `POST /v1/onboarding/checks/setup` -> `SetupIsolationSystem` (key required, body `{ proof }` redacted from logs, 202 and progress by events); `POST /v1/onboarding/complete` -> `CompleteOnboarding` (key required, long timeout 90 s).
2. **Principal.** All owner scope; agent and channel tokens get 403 (tests). The desktop session is the only principal that can create a Local Approval proof for provisioning (PERM009).
3. **Rate limits.** `folders/validate` 30 per minute; `checks/run` 6 per minute and one concurrent; `provision` 10 per minute; default for others.
4. **Errors.** Mapping of `onboarding.*` codes (ONB001) to HTTP: `step_blocked` 409, `folder_rejected` 422, `folder_already_provisioned` 409, `checks_failed` 200 with result (not an error), `not_ready_to_complete` 409, `login_busy` 409.
5. **Audit.** Mutating routes audited by the gateway pipeline (ENGINE016) with route name and outcome; bodies are never audited (paths and proofs).
6. **Redaction.** Logging of requests excludes `pathText`, `proof`; a redaction test asserts that a request with a sentinel path leaves no trace in the log sink.
7. **Events to clients.** `onboarding.state_changed`, `onboarding.check_updated`, `onboarding.completed` are published through the push hub with the normal replay (they contain no secrets).
8. **api-client.** Typed functions return `Result<T, AppError>` per ENGINE019, validate responses with the contract schemas and attach idempotency keys for mutating calls via the shared helper; `runChecks` returns immediately.
9. **Docs.** Route table appended to the generated API docs (automatic from contracts).

## 6. Design notes

N/A, functionality only (no mock region).

## 7. Reuse

- Route registrar (ENGINE013), pipeline (ENGINE011), idempotency (ENGINE015), push hub (ENGINE017), api-client core (ENGINE019), use cases ONB003..007.

## 8. Architecture and code placement

`packages/gateway/src/routes/onboarding/{state.route.ts,folders.route.ts,checks.route.ts,complete.route.ts,index.ts}`, `packages/api-client/src/onboarding/{index.ts,onboarding-client.ts}`. Gateway adapter layer; no business logic.

## 9. Security and safety

- Owner-scope enforcement and per-route rate limits; body size caps; strict schema validation.
- Path text and proofs excluded from logs and audit bodies.
- `provision` requires an idempotency key and a Local Approval proof bound server-side (PERM009), so a replayed HTTP request cannot widen permissions twice.
- Responses never include canonical paths.

## 10. Errors and edge cases

- Run requested while a run is in progress: 202 with current state.
- Client disconnect during `complete`: the transaction finishes; a retry with the same key returns the stored result.
- Invalid JSON or unknown keys: 400 `validation.invalid_input` (strict).
- Engine starting (not ready): `gateway.not_ready`.
- Large concurrent calls: rate limiter returns 429 with `Retry-After`.

## 11. Acceptance criteria

- [ ] Given the owner token then each route responds with the contract-valid body.
- [ ] Given an agent token then 403 on every route.
- [ ] Given `provision` without a key then 400; with the same key twice then the same result.
- [ ] Given a sentinel path then the log sink contains no occurrence of it.
- [ ] Given `checks/run` then 202 within 100 ms and events follow.

## 12. Test plan

- Gateway contract tests with `createGatewayUnderTest`; hostile-client tests (wrong scope, oversize body, unknown keys); api-client tests against the in-process transport.
- Commands: `pnpm vitest run packages/gateway/src/routes/onboarding packages/api-client/src/onboarding`.

## 13. Parallelization notes

After ONB003..007 (can start against fakes). Parallel with ONB010. ONB011+ UI depends on the api-client.

## 14. Open questions and assumptions

- OPEN: confirm that module registration by directory index is the ARCH009 extension pattern for routes (otherwise one-line registration file).
- ASSUMPTION: `checks/run` background execution uses the engine's job scheduler (`JobScheduler` port) or a simple in-process promise with lock; implementation detail in ONB006.
