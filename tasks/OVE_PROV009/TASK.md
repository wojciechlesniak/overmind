---
id: OVE_PROV009
title: Define the AgentSessionGateway port, session contracts and session error codes
area: PROV
kind: contract
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_ARCH008, OVE_PROV001, OVE_PROV006]
soft_depends_on: [OVE_AGENT001]
provides: ["port:AgentSessionGateway", "contract:SessionSnapshot", "contract:DeliveryReceipt", "contract:ReplyChunk", "lib:prov-errors"]
needs: ["lib:result", "lib:error-catalogue", "contract:EntityId", "lib:contract-pipeline"]
owns:
  - packages/application/src/ports/AgentSessionGateway.ts
  - packages/contracts/src/provider/session/**
  - packages/contracts/src/errors/prov.errors.ts
reads: ["docs/SPECIFICATION.md", "packages/contracts/src/terminal-state/"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 12", "SPECIFICATION 15"]
adr_refs: [5, 22, 26, 27]
---

# OVE_PROV009: Define the AgentSessionGateway port, session contracts and session error codes

## 1. Summary

AGENT, CHAT and the workflow runtime must talk to "the live CLI session of an Agent" without knowing about herdr, containers or screens. This task fixes that seam: the `AgentSessionGateway` port (snapshot, send a prompt, stream replies, interrupt, stop), its value types and its error codes. The implementation is PROV029, starting a session is PROV027.

## 2. Context

Other areas already consume this name: AGENT010 seeds Agent State from `snapshot(agentId)`; CHAT008 and AGENT012 deliver messages with `sendPrompt` and expect a refusal `prov.agent_blocked` when the CLI waits for an approval; DISC/Chief read replies through `replies()`. The state they see is a hint (ADR 0026), never completion proof. Sending is non-idempotent (Spec 12): no blind retry after a timeout.

## 3. Scope (in)

- The port and zod schemas for `SessionSnapshot`, `DeliveryReceipt`, `ReplyChunk`, `SendPromptRequest`.
- Error codes with HTTP mapping and `telegramSafe` flags.
- A pure helper `isDeliverableState(state)` shared by the guard and by callers.
- Docs of ordering and delivery semantics.

## 4. Out of scope

- Implementations (PROV029), the guard (PROV008), session start (PROV027), persistence (PROV028), `AgentState` itself (AGENT001; this port only transports `TerminalObservation` from PROV006).

## 5. Detailed requirements

1. **Port:**
   ```ts
   interface AgentSessionGateway {
     snapshot(agentId: AgentId): Promise<Result<SessionSnapshot, AppError>>;
     list(filter?: { workspaceId?: WorkspaceId }): Promise<Result<SessionSnapshot[], AppError>>;
     sendPrompt(req: SendPromptRequest, opts?: { signal?: AbortSignal }): Promise<Result<DeliveryReceipt, AppError>>;
     replies(agentId: AgentId, opts?: { sinceCursor?: string; signal?: AbortSignal }): AsyncIterable<ReplyChunk>;
     interrupt(agentId: AgentId): Promise<Result<void, AppError>>;     // sends the CLI's own interrupt key only when state is 'working'
     stop(agentId: AgentId, opts?: { graceMs?: number }): Promise<Result<void, AppError>>;
   }
   SessionSnapshot = { agentId; workspaceId; hasSession: boolean; sessionId?: string; connectionId?: ConnectionId; providerId?: ProviderId;
     observation?: TerminalObservation /* PROV006: hint:true */; titleHint?: string /* <=120, redacted */; startedAt?; lastOutputAt?; degraded?: { code: string }[] }
   SendPromptRequest = { agentId; runId?: RunId; kind: 'task'|'message'|'followup'; text: string /* <=200 KiB, already assembled per SEC004 */;
     idempotencyKey: string /* 1..128 */; allowWhileWorking?: boolean /* default false */ }
   DeliveryReceipt = { deliveryId; agentId; idempotencyKey; outcome: 'sent'|'sent_unverified'; stateBefore: TerminalState; sentAt; verifiedWorkingAt?: string }
   ReplyChunk = { agentId; cursor: string; text: string /* redacted, <=8 KiB */; final: boolean; at }
   ```
2. **Outcomes:** failures are errors, not receipt outcomes. A call that cannot tell whether the text arrived returns `Err(provider.delivery_unknown)` and records a journal entry (PROV008); only the same `idempotencyKey` replay returns the stored receipt; a new key after `delivery_unknown` is an explicit caller decision.
3. **Errors (`prov.errors.ts`, additions to PROV001's `provider.*`):** `prov.agent_blocked` (409, details `{ state }`, the CLI waits for approval, a choice dialog, login or limit), `prov.session_not_found` (404), `prov.session_exists` (409), `prov.session_unavailable` (503, retryable), `prov.paused` (423, Global Pause), `prov.concurrency_limit` (429, details `{ limit, active }`, retryable), `prov.duplicate_delivery` (409, same key different text hash), `prov.text_rejected` (422, size or control characters). Messages are generic, never CLI output (ARCH003 hostile-error test).
4. **`isDeliverableState(state): boolean`:** true only for `idle` and `done_unclaimed` (and `pending` when the CLI prompt is visible is NOT deliverable until it becomes `idle`). Every other state is not deliverable. `working` is deliverable only with `allowWhileWorking` for `followup` kind.
5. **Ordering rules (documented, tested with a helper):** per Agent, `sendPrompt` calls are serialised; replies are delivered in order with monotonically increasing cursors; `replies` never throws and ends with a chunk `final: true` or when the session stops; a consumer that stops reading is dropped after 1 MiB of buffered text with a `truncated` marker chunk.
6. **Pure consumers:** the port file exports no implementation, only types, the token `AgentSessionGatewayToken` and the fake-friendly helper `assertReceiptShape`.
7. **Contracts pipeline:** schemas under `packages/contracts/src/provider/session/`, one file per type; additive-only (ARCH008).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`TerminalObservation`/`TerminalState` (PROV006), `Result`/`AppError` (ARCH003), ids (ARCH007), `AssembledPrompt` rules of SEC004 are referenced (text is assembled by callers, this port treats it as opaque).

## 8. Architecture and code placement

Port in `packages/application/src/ports/AgentSessionGateway.ts`; contracts in `packages/contracts/src/provider/session/*.schema.ts`; errors in `packages/contracts/src/errors/prov.errors.ts`. Consumers (AGENT, CHAT, DISC, WFRT adapters) depend on the port only (DIP, ISP: five small methods, no herdr types leak).

## 9. Security and safety

The port is where untrusted text meets a CLI that executes commands. It encodes: text is opaque and size-capped; delivery to a waiting or unknown CLI is refused (`prov.agent_blocked`); non-idempotent semantics (no replay without the same key); no way to change permissions, working directory or environment; snapshots and replies carry redacted, bounded text only; `snapshot` never exposes raw screens. Fail closed on unknown agent or session.

## 10. Errors and edge cases

- `snapshot` for an Agent without a session returns `hasSession: false` (not an error) so AGENT can show "no session".
- Unknown future `outcome` values from a newer implementation: consumers treat unknown as not verified.
- Cursor too old for `replies`: starts from the oldest retained chunk and marks the first chunk `truncated`.
- Paused installation: `prov.paused`.

## 11. Acceptance criteria

- [ ] Schemas and port compile, appear in the contracts snapshot, additive-only check passes.
- [ ] All error codes pass the hostile-error test and carry HTTP and `telegramSafe` metadata.
- [ ] `isDeliverableState` table test covers every `TerminalState` value.
- [ ] `assertReceiptShape` rejects a receipt without `stateBefore`.
- [ ] No import of herdr, sandbox or provider adapters in the port module (boundary lint).

## 12. Test plan

Unit tests for schemas, helper and error mapping; type tests for the port; ordering helper tests. Command: `pnpm vitest run packages/contracts/src/provider/session packages/contracts/src/errors packages/application/src/ports`.

## 13. Parallelization notes

Merge early: PROV008, PROV027, PROV028, PROV029, PROV030 and the AGENT/CHAT consumers depend on it. Additive changes only; propose changes through `tasks/_proposals/`.

## 14. Open questions and assumptions

- ASSUMPTION: `done_unclaimed` is deliverable (the previous result is collected through the report or the effect check, PROV015, not through the screen).
- Open: whether `interrupt` is needed in the MVP; kept because Pause and cancel (Spec 12) need a way to stop work, default implementation sends the CLI's documented interrupt key only in state `working`.
