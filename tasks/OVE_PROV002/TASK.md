---
id: OVE_PROV002
title: Define the Connection and ModelUsage contracts and the connections API routes
area: PROV
kind: contract
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_ARCH008, OVE_ARCH012, OVE_PROV001]
soft_depends_on: [OVE_ARCH012]
provides: ["contract:Connection", "contract:ModelUsage", "contract:ConnectionStatus", "api:connections.list", "api:connections.detect", "api:connections.test", "api:connections.status"]
needs: ["contract:SecretRef", "lib:contract-pipeline", "contract:EntityId"]
owns:
  - packages/contracts/src/connection/**
  - packages/contracts/src/model-usage/**
reads: ["docs/SPECIFICATION.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 14", "SPECIFICATION 15"]
adr_refs: [7, 22]
---

# OVE_PROV002: Define the Connection and ModelUsage contracts and the connections API routes

## 1. Summary

Define the entities `Connection` (type cli/ollama/telegram, status, secretRef) and `ModelUsage` (what the CLI reported, with source label "per CLI"), plus the route contracts `connections.list`, `connections.detect`, `connections.test`, `connections.status`, so the Connections view (CONNUI), the wizard (ONB), Telegram settings (TG) and the engine share one definition.

## 2. Context

SPEC 14 lists `Connection { id, type (cli, ollama, telegram), status, secretRef }` and `ModelUsage { id, runId, provider, model, tokens, reportedLimit }`. ADR 0022: Overmind never sees CLI credentials, so a CLI connection has no `secretRef`; only Telegram (bot token in Keychain) has one. Limits and reset times are shown exactly as the CLI reports them, labelled with their source. Entities are owned by PROV (PLAN section 6); TG consumes the `telegram` type through the same entity but owns its pairing data.

## 3. Scope (in)

- Zod schemas, ids, enums, redaction metadata.
- Route contracts via `defineRoute` (request/response/errors/scope/idempotency).
- Examples in docs for the client generator.

## 4. Out of scope

- Persistence (PROV020, PROV017), route handlers (PROV021), detection logic (PROV022), usage parsing (PROV017).

## 5. Detailed requirements

1. **ConnectionId:** ULID with prefix `cn_` (registered with ARCH007 id prefixes).
2. **Connection:**
   ```ts
   Connection = {
     id: ConnectionId; type: 'cli'|'ollama'|'telegram'; providerId: 'claude'|'codex'|'ollama'|'telegram';
     displayName: string(1..80);
     status: 'unknown'|'not_installed'|'needs_login'|'ready'|'degraded'|'limit_reached'|'error'|'disabled';
     statusDetail?: { code: string; messageKey: string };      // i18n key, never raw CLI text
     version?: string; models: ModelInfo[];
     secretRef: SecretRef | null;                              // null for cli and ollama; REQUIRED for telegram
     endpoint?: string;                                        // ollama only, loopback URL
     lastCheckedAt?: ISODateTime; limitResetText?: string;     // verbatim CLI text, max 200 chars (open: sanitised)
     createdAt; updatedAt;
   }
   ```
   Invariants (zod refinements): type `cli` => `secretRef === null`; type `telegram` => `secretRef !== null`; `endpoint` host must be `127.0.0.1`, `localhost` or `::1`.
3. **ModelUsage:**
   ```ts
   ModelUsage = { id: ModelUsageId('mu_'), connectionId; providerId; modelId; runId?; agentId?; nodeExecutionId?;
     tokens?: { input?: int; output?: int; total?: int };
     reportedLimit?: { text: string(max 500, verbatim as shown by the CLI); kind: 'session'|'weekly'|'daily'|'unknown'; resetsAt?: ISODateTime; resetsInText?: string; parse: 'exact'|'best_effort'|'none' };
     source: 'per_cli'|'ollama_local'|'estimate'; recordedAt }
   ```
   `source` drives the UI label; i18n key suggestions `usage.source.per_cli` ("per CLI"), `usage.source.ollama_local`.
4. **Routes** (path pattern `/v1/<resource>/<action>`):
   - `connections.list`: `GET /v1/connections`, scope `owner`, response `{ items: Connection[] }`.
   - `connections.detect`: `POST /v1/connections/detect`, scope `owner`, idempotency `natural`, request `{ providers?: ProviderId[] }`, response `{ items: Connection[]; started: ISODateTime }`; errors `box.isolation_unavailable`, `provider.unavailable`.
   - `connections.test`: `POST /v1/connections/{id}/test`, scope `owner`, request `{}`, response `{ connection: Connection; checks: { id: string; ok: boolean; messageKey: string }[] }`; errors `provider.not_found`.
   - `connections.status`: `GET /v1/connections/{id}/status`, scope `owner` plus `channel:telegram` read-only for the summary, response `{ connection: Connection; usage?: ModelUsage; activeAgents: number }`.
   - No route returns secrets; Telegram token entry is TG's route.
5. **Redaction/metadata:** `limitResetText` and `reportedLimit.text` are marked `userVisibleVerbatim` (not redacted by default but passed through the redactor at write time, SEC003); `endpoint` marked non-secret.
6. **Events:** `connection.status_changed { connectionId, from, to, at }` (persisted) defined here for NOTIF and the UI stream.
7. **Examples:** one JSON example per route in `docs/api/examples/connections.md` generated from schemas.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`SecretRef` (ARCH012), `defineEntity/defineRoute/defineEvent` (ARCH008/ARCH010), `ModelInfo`/`ProviderId` (PROV001), id helper (ARCH007).

## 8. Architecture and code placement

`packages/contracts/src/connection/{connection.schema.ts,connection.routes.ts,connection-status.schema.ts}`, `packages/contracts/src/model-usage/model-usage.schema.ts`, event file `packages/contracts/src/events/connection-status-changed.event.ts` (owned here via the `connection/` ownership; listed in owns by glob addition: `packages/contracts/src/events/connection-*.event.ts`).

## 9. Security and safety

The type system encodes ADR 0022: no secret field exists for CLI connections, so a credential cannot be stored by accident. `statusDetail` carries codes and i18n keys, never raw CLI output (prompt injection and credential echo risk). `endpoint` is restricted to loopback to prevent SSRF through a malicious Owner-visible setting. Routes are owner-scoped; agents have no access to connections.

## 10. Errors and edge cases

- Telegram connection without `secretRef`: schema rejects.
- Unknown future `type`: the enum is open for responses (`openEnum`), clients tolerate it.
- `limitResetText` containing control characters or ANSI escapes: stripped at write time (PROV017), schema max length enforced.
- `detect` called while another detect runs: returns the in-flight result (natural idempotency).
- Status `limit_reached` without reset info: allowed, UI shows only the verbatim text if any.

## 11. Acceptance criteria

- [ ] Schemas enforce all invariants (table tests: valid/invalid combinations).
- [ ] Four routes exist with scopes, errors and examples; `contracts:check` snapshot updated and additive.
- [ ] No schema field can hold a credential for `cli` connections.
- [ ] `ModelUsage.source` has the three values and documentation of the UI label keys.
- [ ] `connection.status_changed` event is registered.

## 12. Test plan

Schema unit tests, snapshot test via the contract pipeline, example generation test. Commands: `pnpm vitest run packages/contracts/src/connection packages/contracts/src/model-usage`, `pnpm contracts:check`.

## 13. Parallelization notes

Merge early; CONNUI, ONB, TG, PROV020/021/022 depend on it. One file per concept; no shared barrels edited by hand.

## 14. Open questions and assumptions

- ASSUMPTION: `activeAgents` in status is computed by PROV021 from the scheduler.
- Open: whether a Telegram `Connection` row is created by TG at pairing time (assumed yes, via a PROV020 use case `SaveConnection`).
