---
id: OVE_PERM009
title: Implement the Local Approval boundary (local confirmations and the require-local guard)
area: PERM
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH009, OVE_PERM001, OVE_PERM008, OVE_PERM020, OVE_SEC005]
soft_depends_on: [OVE_SEC005, OVE_PERM019]
provides: ["usecase:CreateLocalConfirmation", "usecase:RequireLocalProof", "contract:LocalProof", "port:LocalConfirmationStore", "api:perm.local-confirmation.create"]
needs: ["port:SecureRandom", "port:Clock", "usecase:AppendAudit", "lib:route-module"]
owns: ["packages/contracts/src/perm/local-proof.ts", "packages/application/src/perm/local-confirmation/**", "packages/application/src/ports/LocalConfirmationStore.ts", "packages/gateway/src/routes/perm/local-confirmation.route.ts"]
reads: ["packages/domain/src/perm/authority/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 11", "SPECIFICATION 16.9", "SPECIFICATION 16.10"]
adr_refs: [3, 6, 21]
---

# OVE_PERM009: Implement the Local Approval boundary

## 1. Summary

How the engine knows that a permission-widening decision comes from the Owner sitting at the computer and not from Telegram, an Agent, Chief or a script. A "local confirmation" is a short-lived, single-use proof, issued only to the desktop Owner session, bound to the exact operation (an action hash), and required by every `requiresLocalProof` operation.

## 2. Context

Glossary: Local Approval = approval given only on the computer with Overmind, never remotely. The gateway authenticates callers (SEC005): Owner desktop session, agent tokens, `channel:telegram` in-process. The Tauri shell starts the engine and holds the desktop session; Telegram runs inside the engine process. The threats here: a Telegram message or an Agent trying to call a widening route; a compromised webview replaying calls; a stale or reused confirmation; a confirmation for operation A being used for operation B; a malicious local process of the same OS user.

## 3. Scope (in)

- Route `POST /v1/local-confirmations` creating a proof; contracts `LocalProof`, request/response.
- `LocalConfirmationStore` port with its in-memory implementation (production and tests); SQLite not needed (proofs live in memory only, 60 s, lost on restart by design).
- `RequireLocalProof` guard used by use cases: verifies principal, consumes the proof atomically, checks the action hash.
- `actionHash(operation, canonicalArgs)` canonical hashing function (stable JSON, SHA-256).

## 4. Out of scope

- The confirmation dialog UI (APPRUI/WSPACE/SETUI use it). The optional native OS dialog or Touch ID hardening (open question 1). Session authentication itself (ENGINE/SEC005).

## 5. Detailed requirements

1. **Issuing.** `POST /v1/local-confirmations` body `{ operation: OwnerOperation (only those with requiresLocalProof), args: object (the exact arguments of the later call), ttlSeconds?: 5..60 default 60 }` → `{ confirmationId: 'lcf_'+ULID, expiresAt, actionHash }`. Route scope `owner`; the handler requires `principal.kind==='owner' && channel==='desktop' && local===true`, otherwise `Err(perm.local_approval_required)` and a violation audit event (PERM018). Telegram, agents, Chief, `owner/other` all fail.
2. **Binding.** `actionHash = sha256(canonicalJson({ operation, args, installationId }))`. The store keeps `{ confirmationId, actionHash, sessionId, issuedAt, expiresAt, usedAt: null }` in memory (Map, max 50 entries, oldest evicted, sweep on access). `args` are validated against the operation's argument schema (the use case schema, e.g. `{ path, rights, workspaceId }` for a permanent grant) so a proof cannot be minted for garbage.
3. **Consuming.** `RequireLocalProof({ principal, operation, args, proof })`:
   1. `authorize(principal, operation)` must succeed (PERM008);
   2. `proof.confirmationId` exists, not expired by `Clock`, `usedAt === null`, `sessionId === principal.sessionId`, `actionHash` equals the hash recomputed from the **actual** call arguments;
   3. mark used **atomically** (compare-and-set) before the operation is executed; if the operation then fails, the proof stays used (retry requires a new confirmation).
   Failure codes: `perm.local_approval_required` (missing/invalid/expired/used/mismatched), details only `{ reason: 'missing'|'expired'|'used'|'mismatch'|'session' }`.
4. **Where the proof travels.** In the request body field `localProof: { confirmationId }` of the widening routes (declared in each route contract), never in a header that a proxy could add, and never in URLs or logs (listed in the redaction key list as `localproof`/`confirmationid`).
5. **Time.** All expiry uses the injected `Clock` (monotonic, not wall clock) so setting the system clock back does not extend validity.
6. **Audit.** Issue, use, rejection (with reason) each write an audit event (`perm.local_confirmation.issued|used|rejected`), no proof ids in `details` beyond a truncated prefix (first 8 chars).
7. **Idempotency:** `POST /v1/local-confirmations` is not idempotent (each call mints a new id); creation rate-limited to 10 per minute per session (`gateway.rate_limited`).
8. **Presence factor (pluggable).** `LocalPresenceVerifier` port (default `NoopPresence` returns ok; MVP ships `WebviewModalPresence` semantics: the UI must show the operation summary derived from `args` before calling). The port exists so a native-dialog or Touch ID verifier (open question 1) can be added without changing callers.

## 6. Design notes

N/A, functionality only. UI must show the exact path, rights and Workspace taken from `args` in a modal with an explicit "Allow permanently" button before calling the route (specified in APPRUI).

## 7. Reuse

`SecureRandom` (SEC005) for id generation, `Clock` (ARCH007), `authorize` (PERM008), `AppendAudit` (PERM020), `defineRouteModule` and `RouteContract` (ARCH008/009).

## 8. Architecture and code placement

Application layer: `packages/application/src/perm/local-confirmation/{create-local-confirmation.ts,require-local-proof.ts,action-hash.ts}`; port in `packages/application/src/ports/LocalConfirmationStore.ts`; the in-memory implementation is also the production implementation (the `MemoryLocalConfirmationStore` in `packages/application/src/perm/local-confirmation/memory-store.ts` is the production implementation, a plain in-memory Map with the injected `Clock`, so no adapter and no fake are needed; no persistence is wanted). Route in `packages/gateway/src/routes/perm/`. Domain functions (`actionHash`) are pure.

## 9. Security and safety

This is the single boundary behind SR-25 and acceptance criteria 9 and 10. Threats and controls: Telegram or agent call (principal check, transport-derived); Chief call (principal check); reuse (single use, CAS); cross-operation use (hash binding to exact args); stale proof (60 s TTL, monotonic clock); proof theft by another session (session binding); logging of proofs (redaction keys); webview XSS minting proofs for attacker-chosen args (residual risk, mitigated by the presence verifier hook and CSP/Markdown sanitisation SR-35/SR-36; documented in `docs/security/local-approval.md`); same-user local process (needs the owner token; SR-10/SR-12). The engine fails closed if the store cannot be read. Restarting the engine invalidates all proofs.

## 10. Errors and edge cases

- Proof used twice concurrently: exactly one succeeds (test with `Promise.all`).
- Args differ by key order only: same hash (canonical JSON).
- Args differ by a trailing slash in a path: the use case canonicalises **before** hashing in both issue and consume (shared `canonicalArgs` function), so benign variations match while real changes do not; a different canonical path mismatches.
- Clock jump backwards: no extension (monotonic).
- Store eviction under 50+ outstanding proofs: oldest proof invalid, the Owner retries.
- Telegram-triggered flow that needs permanence: the response tells Telegram "approve at the computer" (message key) and creates nothing.

## 11. Acceptance criteria

- [ ] `POST /v1/local-confirmations` from agent token, Telegram, Chief and non-desktop Owner is rejected with `perm.local_approval_required` and a violation audit event.
- [ ] A proof is accepted exactly once for exactly the hashed arguments, within 60 s, for the issuing session.
- [ ] A proof for path A cannot authorise path B; for rights `read` cannot authorise `read,write`.
- [ ] Two concurrent consumptions: one success, one failure.
- [ ] No proof id appears in logs (redaction test) and only an 8-char prefix appears in audit details.
- [ ] Engine restart invalidates outstanding proofs.

## 12. Test plan

Unit with `FakeClock`: TTL boundaries (59.9 s, 60.1 s), CAS, hash binding table (20 cases). Route tests through the gateway test harness with each principal kind. Security suite hook for SEC005's authorisation matrix (this route must be present with scope owner/local). Commands: `pnpm vitest run packages/application/src/perm/local-confirmation packages/gateway/src/routes/perm/local-confirmation`.

## 13. Parallelization notes

Blocks every widening use case (PERM011, 012, 016). Can proceed in parallel with PERM010 using the fake store. Hotspot: none.

## 14. Open questions and assumptions

1. Open (recommended hardening, P1 follow-up): a native confirmation dialog or Touch ID prompt rendered by the Tauri shell (not the webview) as `LocalPresenceVerifier`, so a compromised webview cannot mint proofs. Default now: webview modal + hash binding.
2. ASSUMPTION: the desktop session is the only `local:true` principal; a future CLI is `local:false`.
3. ASSUMPTION: proofs are memory-only; a crash during an operation requires a new confirmation (safe).
