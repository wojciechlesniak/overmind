---
id: OVE_SHELL001
title: "Define the TopBarSummary contract and the shell.top-bar route contract"
area: SHELL
kind: contract
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH008, OVE_ARCH009, OVE_PAUSE001, OVE_PROV002, OVE_TG001]
soft_depends_on: []
provides: ["contract:TopBarSummary", "contract:ShellRoutes"]
needs: ["lib:contract-pipeline", "contract:EntityId", "contract:TelegramChannelStatus", "contract:Connection", "contract:PauseState", "lib:feature-manifest"]
owns: ["packages/contracts/src/shell/**", "docs/api/examples/shell-top-bar.md"]
reads: ["packages/contracts/src/events/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 6, 22]
---

# OVE_SHELL001: Define the TopBarSummary contract and the shell.top-bar route contract

## 1. Summary

Defines the zod contract `TopBarSummary` (limit entries per CLI, agent slots, Telegram status, pending Approval counts, pause flag) and the route contract `shell.top-bar` that the desktop top bar reads. One aggregate read keeps the top bar to one request plus push-triggered refreshes instead of five separate calls.

## 2. Context

The top bar of the mock (shell/top-bar) shows: Workspace switcher, 'Claude Max 62% · reset 3 h · wg CLI', 'Agenci 3 z 3 naraz', 'Telegram połączony', '3 czekają', 'Global Pause'. Each value is owned by a different backend area: limits by PROV (PROV017 `GetUsageSnapshot`, PROV020 connections), parallel slots by PROV019 (`ConcurrencyLimiter.status()`), Telegram by TG005 (`ChannelStatusReader`), waiting items by PERM014/PERM016 and CHIEF015 (Escalations), pause by PAUSE003. The desktop UI may only talk to the gateway (CONVENTIONS 6), and polling five routes from the shell would multiply load and give inconsistent snapshots, so SHELL owns a thin read-model. It contains no business rules: it only projects other areas' read use cases. Glossary: Approval = Zgoda, Access Request = Prośba o dostęp, Escalation = Eskalacja, Global Pause. IMPORTANT product rule (styl-wizualny): subscription limits are always shown 'wg CLI' (per CLI) exactly as the CLI reports; PROV017 requirement 8 forbids Overmind from computing a percentage, so the contract carries a percentage only when the CLI printed one.

## 3. Scope (in)

- Zod schemas `LimitEntry`, `SlotsInfo`, `TelegramPillStatus`, `PendingCounts`, `TopBarSummary` under `packages/contracts/src/shell/`.
- Route contract `shell.top-bar` (`GET /v1/shell/top-bar`, scope owner, optional `workspaceId` query) and its error list.
- The list of push event types that invalidate the summary (a constant `TOP_BAR_INVALIDATING_EVENTS`).
- JSON examples in `docs/api/examples/shell-top-bar.md` generated from the schemas.

## 4. Out of scope

- Use case and gateway route implementation: OVE_SHELL002.
- Percentage extraction from CLI text: OVE_SHELL002 (domain function).
- UI hooks: OVE_SHELL015.

## 5. Detailed requirements

1. `LimitEntry` = `{ connectionId: string; providerId: 'claude'|'codex'|'ollama'; cliLabel: string (1..60, e.g. 'Claude Max'); percentUsed: number|null (0..100, integer; non-null ONLY when the CLI-reported text contains an explicit percentage); resetsInText?: string (max 40, verbatim CLI wording such as 'reset 3 h'); resetsAt?: ISODateTime; limitText?: string (max 200, verbatim, plain text); parse: 'exact'|'best_effort'|'none'; stale: boolean; state: 'ok'|'limit_reached'|'needs_login'|'unavailable'; source: 'per_cli'|'ollama_local' }`. The field `source` is always present and drives the mandatory suffix 'wg CLI'.
2. `SlotsInfo` = `{ active: int>=0; limit: int 1..16; queued: int>=0 }`.
3. `TelegramPillStatus` = enum `not_configured|unpaired|connecting|connected|disconnected|degraded|error|locked` (mirrors TG001 `TelegramChannelStatus`; the contract re-exports the type by import, it does not copy the enum values).
4. `PendingCounts` = `{ approvals: int; accessRequests: int; escalations: int; total: int }` where `total` is the sum (the number on the amber button) and counts are for ALL Workspaces visible to the Owner (the button is global, not per Workspace).
5. `TopBarSummary` = `{ generatedAt: ISODateTime; limits: LimitEntry[] (max 8); slots: SlotsInfo; telegram: { status: TelegramPillStatus; botUsername?: string }; pending: PendingCounts; pause: { global: boolean; workspace: boolean }; engine: { state: 'ready'|'degraded' } }`. `pause.workspace` is computed only when the `workspaceId` query is supplied.
6. Route: `GET /v1/shell/top-bar?workspaceId=` with `scope: ['owner']`, `idempotency: 'natural'`, response `TopBarSummary`, declared errors `gateway.not_ready`, `validation.invalid_input`, `data.not_found` (unknown Workspace). Not available to agent or channel principals (the Telegram status line is served by TG008, not this route).
7. The schema is `.strict()`; `limitText` and `cliLabel` are marked `userVisibleVerbatim` for the redaction layer and MUST be rendered as plain text by the UI.
8. `TOP_BAR_INVALIDATING_EVENTS` lists exact event types: `provider.concurrency_changed`, `provider.usage_recorded`, `provider.limit_reached`, `provider.limit_reset`, `connection.status_changed`, `provider.login_needed`, `provider.login_restored`, `telegram.channel.status.changed`, `approval.requested`, `approval.decided`, `approval.expired`, `access_request.requested`, `access_request.decided`, `access_request.expired`, `pause.changed`, `workspace.deleted`. A contract test asserts every type exists in the event registry (ARCH009 generated registry) so a rename breaks the build.
9. Compatibility: additive-only (ARCH008). New optional fields may be added later; consumers MUST ignore unknown keys.

## 6. Design notes

N/A, functionality only. (The visual spec is in OVE_SHELL016.)

## 7. Reuse

- `defineRoute` / zod helpers from ARCH008, `EntityId`/`ISODateTime` from ARCH007, `TelegramChannelStatus` from TG001, `ConnectionStatus` from PROV002, `PauseState` from PAUSE001.
- Event registry from ARCH009 for the contract test.

## 8. Architecture and code placement

Layer: contracts only. Files: `packages/contracts/src/shell/top-bar.schema.ts`, `top-bar.routes.ts`, `top-bar.events.ts`, `docs/api/examples/shell-top-bar.md`. Barrels are generated. No imports from application, adapters or apps.

## 9. Security and safety

- The summary is a read-model of Owner-visible data only; it is registered with scope owner so Chief, agents and Telegram cannot call it.
- `limitText` is CLI-printed text: marked verbatim-untrusted; the UI renders it as text and never as HTML or Markdown (SEC004: CLI output is data).
- No secrets, no paths, no Workspace names in the payload (counts only), so a leaked summary reveals little.
- Isolated Workspaces (ADR 0028 / glossary) still count in `pending` because the Owner must see their Approvals; the count carries no content.

## 10. Errors and edge cases

- Zero connections: `limits: []` (the UI hides the meter; it is not an error).
- Ollama connection: `percentUsed: null`, `state: 'ok'`, `source: 'ollama_local'`.
- Connection `needs_login`: entry kept with `state: 'needs_login'` so the top bar can show a login hint.
- More than 8 CLIs: truncated to 8 by the use case; the contract rejects more than 8.
- Percent outside 0..100 is a contract violation (the use case clamps nothing, it omits the percent).

## 11. Acceptance criteria

- [ ] Schemas validate the example in the docs and reject unknown keys, `percentUsed: 101`, `limits` with 9 items, negative counts.
- [ ] The route contract appears in the generated JSON schema and passes the additive-only check.
- [ ] Every event type in `TOP_BAR_INVALIDATING_EVENTS` exists in the registry.
- [ ] `pending.total` equals the sum of the three counts (refinement test).

## 12. Test plan

- `packages/contracts/src/shell/top-bar.schema.test.ts` (valid/invalid tables), `top-bar.events.test.ts` (registry membership).
- Commands: `pnpm --filter @overmind/contracts test shell`, `pnpm gen --check`.

## 13. Parallelization notes

Merge first in the SHELL backend chain; OVE_SHELL002 and OVE_SHELL015 start from this contract (they may use the example JSON before it merges). One file per concern, no shared barrel edits.

## 14. Open questions and assumptions

- ASSUMPTION: one aggregate route is better than five client-side reads; if a later area exposes its own cheap count route, only OVE_SHELL002 changes.
- OPEN (design gap): the DS `LimitEntry.percent: null` means 'no limit' (Ollama). A CLI that reports no percentage needs a third presentation 'text only'. Default: SHELL015 maps it to a `LimitMeter` entry with `percent: null` and `resetLabel` carrying the verbatim text; request a DS variant `percent unknown` via proposal to OVE_DS042.
- OPEN: whether `engine.state` belongs here (engine health is also pushed by `system.state_changed`); default keeps it for convenience, the UI uses the push event for the engine-down gate.
