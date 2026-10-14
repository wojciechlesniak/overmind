---
id: OVE_WSPACE014
title: "Local Approval client: hook, state machine and operation describers"
area: WSPACE
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_ARCH011, OVE_DATA007, OVE_DS037, OVE_ENGINE019, OVE_PERM009]
soft_depends_on: []
provides: ["lib:use-local-approval", "ui:LocalApprovalProvider"]
needs: ["api:perm.local-confirmation.create", "lib:api-client", "lib:canonical-json", "lib:feature-manifest", "lib:i18n-ui", "ui:useToast"]
owns: ["apps/desktop/src/features/local-approval/api/**", "apps/desktop/src/features/local-approval/hooks/**", "apps/desktop/src/features/local-approval/describers/**", "apps/desktop/src/features/local-approval/provider/**", "apps/desktop/src/features/local-approval/feature.manifest.ts", "apps/desktop/src/locales/en/local-approval.json", "apps/desktop/src/locales/pl/local-approval.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.9", "SPECIFICATION 16.10"]
adr_refs: [3, 6, 21]
---

# OVE_WSPACE014: Local Approval client: hook, state machine and operation describers

## 1. Summary

Provides `useLocalApproval()`, the single UI mechanism for every action that needs Local Approval: it shows the confirmation, asks the engine for a bound one-time proof and runs the widening call with exactly the confirmed arguments. All widening actions of this backlog (folders, delete Workspace, lift consent, relax isolation, backup folder) use it.

## 2. Context

Local Approval (Zgoda lokalna, glossary) is an approval given only at the computer with Overmind, never remotely (ADR 0003, 0006, 0021; spec 11; acceptance criteria 9 and 10). Actions that WIDEN access or weaken protection need it: permanent folder grant, deleting a Workspace, lifting a consent requirement, relaxing isolation, changing the backup folder. Backend (PERM009): the Owner desktop session calls `POST /v1/local-confirmations` with `{ operation, args, ttlSeconds }` (route scope owner, `local:true`, desktop principal only, rate limit 10/min) and receives `{ confirmationId, expiresAt, actionHash }`; the widening call then carries `localProof: { confirmationId }` in its BODY; the engine recomputes `sha256(canonicalJson({operation,args,installationId}))` from the ACTUAL call arguments, so a proof is bound to exactly those arguments, expires after at most 60 s on the engine's monotonic clock and is single use. Operations registered by area: `access.grant_permanent`, `policy.widen`, `override.lift` (PERM), `workspace.delete`, `workspace.make_shared` (DATA), `owner_rule.lift_consent` (DATA), `backup.folder.change` (BACKUP). Telegram, Agents and Chief can never obtain a proof (PERM008): the UI cannot make it possible either, because the UI contains no way to mint or forward a proof for another channel.

## 3. Scope (in)

- `api/localApprovalClient.ts` (`createLocalConfirmation`).
- `hooks/useLocalApproval.ts`: `run({operation,args,call})` state machine.
- `describers/*.describer.ts` registry (one per operation, glob-collected): produce the human summary rows from `args`.
- Types `LocalApprovalRequest`, `LocalApprovalOutcome`.
- `provider/LocalApprovalProvider.tsx` mounting one dialog host (UI in OVE_WSPACE015).

## 4. Out of scope

- The dialog component (OVE_WSPACE015).
- Security test suite (OVE_WSPACE016).
- Server side (PERM009).

## 5. Detailed requirements

1. API: `run<TArgs, TRes>(req: { operation: LocalOperation; args: Readonly<TArgs>; target?: { kind: string; id: string }; call: (proof: { confirmationId: string }) => Promise<Result<TRes, ApiError>> }): Promise<LocalApprovalOutcome<TRes>>` with `LocalApprovalOutcome = { status:'done', value:TRes } | { status:'cancelled' } | { status:'failed', error:ApiError }`. `LocalOperation` is a string union generated from the contracts registry (`packages/contracts/src/perm/local-actions/*`), not retyped.
2. State machine (pure reducer `localApprovalMachine`): `idle -> confirming(summary) -> minting -> calling -> done | failed`, plus `cancelled`. `confirming` waits for the Owner; the countdown is NOT started yet. `minting`: `POST /v1/local-confirmations { operation, args, ttlSeconds: 60 }` (route owner, desktop); `calling`: `call({confirmationId})` immediately (target < 100 ms after minting; expiry 60 s). Only ONE run at a time (a second `run` while busy resolves `{status:'failed', error: local_approval_busy}`).
3. Argument binding: `args` is deep-frozen (`Object.freeze` recursively) when `run` starts and the SAME object is passed to both the mint call and (by closure) the widening call; the hook exposes `args` to `call` as its first parameter `call(proof, args)` so callers cannot accidentally send different values. A dev-mode assertion hashes `canonicalJson(args)` before mint and before call and throws if they differ.
4. The proof is never stored: it lives in a local variable of the async function, is passed only to `call`, and is dropped. It is not put in React state, context, URL, localStorage, logs, error messages or Redux-like devtools. The redaction list of the UI logger includes `localProof`, `confirmationId`.
5. Describers: `describe(args): { title: MessageRef; rows: {label, value, tone?}[]; severity: 'normal'|'danger' }`; examples: `policy.widen`/`access.grant_permanent` -> rows Workspace, Folder (display path), Rights ('read, write'); `workspace.delete` -> Workspace name + counts from the deletion preview + the warning key `workspace.delete.warning`; `workspace.make_shared` -> 'Isolation will be turned OFF: Decisions and Memory become visible to Chief and other Workspaces'; `override.lift`/`owner_rule.lift_consent` -> 'Agents will no longer need your Approval for: git push'; `backup.folder.change` -> new folder. Unknown operation -> the run fails closed with `local_approval_unknown_operation` (no generic confirm).
6. Server errors: `perm.local_approval_required{reason}` from the widening call -> outcome `failed` with the reason mapped to `localApproval.error.expired|used|mismatch|session|missing` messages and a `retry` flag only for `expired` (a new confirmation is required; never reuse). `perm.channel_not_permitted`/`perm.owner_required` -> `failed`, message 'This action is only possible at this computer.' `gateway.rate_limited` (10/min) -> message with wait.
7. Presence: the Owner must press the confirm button in the dialog; the dialog is focus-trapped, not dismissible by backdrop click, and the confirm button is not auto-focused when severity is `danger` (cancel is the initial focus) per DS036 destructive dialog.
8. Idle timeout: if `confirming` lasts > 120 s the machine cancels (stale dialog protection) with a toast.
9. The provider holds `isLocalSession: true` only when the transport is the Tauri bridge (ENGINE022); in loopback dev mode (ENGINE023) the hook still works against the mock gateway but logs a dev banner `localApproval.devMode`.
10. Everything is i18n (`local-approval` namespace).

## 6. Design notes

N/A, functionality only (dialog UI is OVE_WSPACE015).

## 7. Reuse

- `lib:api-client` (`createLocalConfirmation` generated from `api:perm.local-confirmation.create`), `canonicalJson` helper from contracts (DATA007 `lib:canonical-json`, shared via contracts) for the dev assertion, `useToast`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/local-approval/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components. This feature has no routes; it exports a provider and the hook. Other features import ONLY `@features/local-approval` public exports (`useLocalApproval`, `LocalApprovalProvider`).

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Specific: this task is the UI half of the Local Approval boundary. Invariants: (1) the UI never constructs or forwards a proof for any channel except the desktop session that holds the dialog; (2) the proof is single-use and bound to args, and the UI enforces equality of the confirmed and sent args; (3) no automatic retry of a failed widening call (a retry always asks the Owner again); (4) nothing here is reachable from Telegram (separate process, the UI is desktop only); (5) mint rate limit 10/min is respected and surfaced; (6) `localProof` and `confirmationId` never reach logs/telemetry/crash dumps; (7) unknown operations fail closed.

## 10. Errors and edge cases

- Engine unreachable during mint: `failed`, nothing called.
- Mint succeeded but `call` threw synchronously: `failed`, proof dropped; a retry mints again.
- Component unmounts mid-run: abort mint (signal); if the call already started it is NOT aborted by the UI (the engine decides), the result is delivered to the stored callback only if the provider still lives.
- Two windows: confirmation ids are session-bound (`session` reason) so the second window cannot use the first one's proof.
- Args contain a function/undefined (programming error): `JSON` canonicalisation throws in dev, fails closed in prod.

## 11. Acceptance criteria

- [ ] Given `run` with `workspace.delete`, Then the dialog shows the describer rows, and only after confirm one mint call and one widening call occur, in this order, with identical args.
- [ ] Given cancel, Then no network call is made.
- [ ] Given the widening call fails with `expired`, Then the outcome is `failed` with `retry` and the next run mints a new confirmation id (different from the first).
- [ ] Given an unknown operation, Then it fails closed without showing a generic confirm.
- [ ] Given args mutated by the caller after `run`, Then the frozen copy is used (mutation throws in dev).
- [ ] Static check: grep test proves `confirmationId` and `localProof` are not passed to `console`, logger or storage APIs.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `localApprovalMachine.test.ts` (all transitions, busy, idle timeout), `useLocalApproval.test.tsx` (order, args identity, expiry retry, unmount), `describers.test.ts` (each operation, unknown), `no-proof-leak.test.ts` (spy on console/logger/storage), contract test against the mock gateway implementing PERM009 hash semantics. Commands: `pnpm --filter @overmind/desktop test features/local-approval`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/local-approval/api/**`, `apps/desktop/src/features/local-approval/hooks/**`, `apps/desktop/src/features/local-approval/describers/**`, `apps/desktop/src/features/local-approval/provider/**`, `apps/desktop/src/features/local-approval/feature.manifest.ts`, `apps/desktop/src/locales/en/local-approval.json`, `apps/desktop/src/locales/pl/local-approval.json` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files. Other areas needing a new operation add a describer file in `describers/` through a proposal (one file per operation). Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: this feature lives in WSPACE because the dashboard is its first user; APPRUI (permanent Access Request grants) and SHELL MUST reuse it (linker: avoid a second implementation).
- ASSUMPTION: external route bodies (DATA011/012/015, BACKUP004) carry `localProof:{confirmationId}` like PERM routes; their contracts do not declare it yet: gap in the final report.
- OPEN (PERM009 question 1): a native OS dialog or Touch ID as a stronger presence factor; the hook keeps a `presence` seam.
