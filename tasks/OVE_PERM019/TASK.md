---
id: OVE_PERM019
title: Define the AuditEvent contract, the action registry and the tamper-evident hash chain
area: PERM
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_ARCH008, OVE_ARCH010]
soft_depends_on: [OVE_SEC003]
provides: ["contract:AuditEvent", "lib:audit-chain", "lib:define-audit-action", "contract:AuditAction", "port:AuditSigner"]
needs: []
owns: ["packages/contracts/src/audit/audit-event.ts", "packages/contracts/src/audit/define-audit-action.ts", "packages/contracts/src/audit/actions/perm.actions.ts", "packages/domain/src/audit/**", "packages/application/src/ports/AuditSigner.ts", "docs/security/audit-log.md"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 14", "SPECIFICATION 15"]
adr_refs: [3, 8]
---

# OVE_PERM019: Define the AuditEvent contract and the hash chain

## 1. Summary

The immutable record of security-relevant decisions: who did what to which target with what result, correlated across Run and request, with no secrets. This task defines the shape, an action registry that makes every audit action and its details schema explicit, and a keyed hash chain that makes tampering detectable.

## 2. Context

SPEC 14: `AuditEvent: id, actor, action, target, result, timestamp`. SR-17: security-relevant decisions (allow/deny, approval, access request, policy change, pause) write append-only audit events to the event store, not just logs. CONVENTIONS 7: every such decision writes an append-only audit event. Many areas will add audit actions (PAUSE, TG, VIS, AGENT...), so the registry must allow parallel additions without conflicts.

## 3. Scope (in)

- `AuditEvent` zod contract and enumerations.
- `defineAuditAction(id, { category, severity, detailsSchema, targetKinds })` and the convention "one file per area" under `packages/contracts/src/audit/actions/<area>.actions.ts` (barrel generated, ARCH009); PERM's own actions file.
- Pure chain functions: `canonicalize(event)`, `computeHash(signer, prevHash, event)`, `verifyChain(events, signer, anchor?)`.
- Port `AuditSigner` (HMAC-SHA-256 with a Keychain-held key).
- Documentation of the tamper-evidence model and its residual risks.

## 4. Out of scope

Storage and append API (`OVE_PERM020`), redaction (`OVE_PERM021`), retention/export/verify jobs (`OVE_PERM022`), query routes (`OVE_PERM023`), Keychain adapter itself (ARCH012 + keychain-macos).

## 5. Detailed requirements

1. **AuditEvent**
   ```ts
   AuditEvent = { id: EntityId<'aud'>, seq: number /* int >=1, gap-free, assigned by the store */, occurredAt: IsoDateTime,
     actor: { kind: 'owner'|'chief'|'agent'|'channel'|'system', id?: string, channel?: 'desktop'|'telegram'|'agent'|'system', local?: boolean },
     action: AuditActionId /* dotted, registered */, category: 'decision'|'violation'|'config'|'approval'|'access'|'pause'|'visibility'|'auth'|'system',
     target: { kind: string, id?: string, display?: string /* <=200, ~-relative or name */ },
     result: 'allowed'|'denied'|'succeeded'|'failed'|'pending'|'expired'|'cancelled',
     reasonCode?: string /* registered error/deny code */, severity: 'info'|'warn'|'high',
     workspaceId?: EntityId<'ws'>, runId?: EntityId<'run'>, agentId?: EntityId<'agt'>, correlationId?: EntityId<'req'>, causationId?: EntityId<'aud'>,
     details: Record<string, JsonPrimitive|JsonPrimitive[]> /* flat, allowlisted by the action's schema, max 2 KiB serialised */,
     schemaVersion: 1, prevHash: string /* hex, 64 chars; '0'*64 for seq 1 */, hash: string }
   ```
   No free-form `message` field exists; human text is derived by the UI from `action` + `reasonCode` + `details` via i18n keys `audit:<action>`.
2. **Action registry:** `defineAuditAction('perm.policy.directory_added', { category: 'config', severity: 'info', targetKinds: ['policy'], detailsSchema: z.object({ rights: z.string().max(20), workspaceName: z.string().max(80).optional() }).strict() })`. Unregistered actions are rejected by the append API (`audit.unknown_action`, programmer error). The registry test checks: unique ids, dotted lowercase `<area>.<noun>.<verb_past>` pattern, `detailsSchema` is strict and has only primitive fields, no field name matches the secret key list (SEC003/ARCH004 patterns), every action has an i18n key in the `audit` namespace (checked when ARCH011 lint exists).
3. **PERM's registered actions** (file `perm.actions.ts`): `perm.policy.directory_added|directory_removed|rights_changed|capabilities_changed|profile_assigned`, `perm.profile.created|updated|deleted`, `perm.override.lifted|restored|lift_rejected`, `perm.approval.requested|approved|denied|expired|cancelled|consumed|decide_rejected`, `perm.access_request.filed|granted_run|granted_permanent|denied|expired|cancelled`, `perm.access.needs_approval`, `perm.local_confirmation.issued|used|rejected`, `perm.mounts.applied|blocked`, `perm.audit.exported|verified|verify_failed|retention_applied`, plus the violation actions registered in PERM018. Other areas add their own files.
4. **Hash chain:** `hash = HMAC_SHA256(key, prevHash || '\n' || canonicalJson(eventWithoutHash))` hex; `canonicalJson` = RFC 8785-style (sorted keys, no whitespace, numbers normalised, strings NFC). The key never leaves the `AuditSigner`; the chain can be verified only with the key (a database-only attacker cannot recompute valid hashes). `verifyChain(events, signer, { expectedFirstPrev, anchor })` returns `{ ok: true, head }` or `{ ok:false, firstBadSeq, reason: 'hash_mismatch'|'seq_gap'|'prev_mismatch'|'anchor_mismatch'|'schema_invalid' }`.
5. **AuditSigner port:** `{ keyId(): string; mac(data: Uint8Array): Promise<Result<string>> }`; the macOS adapter reads the key from the Keychain under `SecretRef keychain:app.overmind.audit-chain/key-v1` (new purpose `audit-chain`, proposal to ARCH012 owners as an additive extension of the allowed purposes); first run generates 256 random bits through `SecureRandom` and stores them; key rotation = new `keyId` starts a new chain **segment** (a `perm.audit.key_rotated` event signed by the old key closes the old segment and carries the new `keyId`).
6. **Tamper-evidence scope (documented honestly):** detects modification, deletion in the middle, reordering and insertion; detects tail truncation only against an anchor (head hash and seq written periodically to a file, see PERM022) or an exported copy; does not protect against an attacker who holds both the database and the Keychain item (same-user malware). The documentation states this and lists mitigations (backups, exports).
7. **Event ids and clocks:** `id` and `occurredAt` come from `IdGenerator`/`Clock`; `seq` and `prevHash` only from the store inside the append transaction (never from callers).
8. **Privacy:** `target.display` uses `~`-relative/Workspace-relative paths; user names are not recorded; Telegram chat ids are not recorded (only `channel:'telegram'`).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`defineEntity`/contract pipeline (ARCH008), `defineEvent` conventions (ARCH010), `SecureRandom` (SEC005), redaction key list (ARCH004/SEC003) reused in the registry test.

## 8. Architecture and code placement

Contracts in `packages/contracts/src/audit/`; pure chain code in `packages/domain/src/audit/{canonical.ts,chain.ts,verify.ts}` (no I/O; HMAC delegated to the `AuditSigner` port passed in); port in `packages/application/src/ports/AuditSigner.ts`. Area action files are separate (extension point, no shared file edits).

## 9. Security and safety

An audit log that can be edited silently is worthless. The chain is keyed (HMAC), the key lives in the Keychain, and verification is available to the Owner (PERM022/PERM023). The schema forbids free text and nested objects, which keeps secrets and prompt-injected content out by construction; `details` are validated against a strict per-action schema (allowlist), not filtered after the fact. Append failure is a hard failure for the operation being audited (callers abort, `perm.audit_unavailable`): an unaudited permission change must not happen. The documentation lists residual risks explicitly rather than claiming immutability.

## 10. Errors and edge cases

- Two events differing only by key order: identical canonical JSON.
- Unicode normalisation differences in `display`: NFC applied before hashing.
- Missing Keychain item at start: create (first run); if the Keychain is locked/unavailable: appends fail closed (`perm.audit_unavailable`), the engine reports degraded state.
- Wrong key (restored backup on another Mac): verification fails with `hash_mismatch` from the first event; the documentation tells the Owner how to verify with the exported anchor.
- Very long `details`: rejected at append (limit 2 KiB).

## 11. Acceptance criteria

- [ ] The registry test fails for a duplicate action id, a non-strict details schema, a nested details field, or a secret-looking field name.
- [ ] `verifyChain` detects: modified field, deleted middle event, inserted event, swapped order, wrong key, truncated tail (with anchor), first event with wrong `prevHash`.
- [ ] Canonical JSON is stable across key order and Unicode forms (property test).
- [ ] `AuditEvent` has no free-text message field and `details` max size is enforced.
- [ ] `docs/security/audit-log.md` states residual risks and the verification procedure.

## 12. Test plan

Unit tests for canonicalisation and hashing with a fake HMAC signer; chain tamper table (10 mutations); registry tests; fast-check: random chains verify, any single-field mutation fails verification. `pnpm vitest run packages/domain/src/audit packages/contracts/src/audit`.

## 13. Parallelization notes

Early merge unblocks every area that audits (`AppendAudit` consumers). Other areas create `packages/contracts/src/audit/actions/<area>.actions.ts` (their own files). Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: HMAC-SHA-256 with a Keychain key (no asymmetric signatures, KISS). A Merkle tree/transparency log is out of scope.
- ASSUMPTION: the `audit-chain` Keychain purpose is added to ARCH012's list through a proposal.
- Open: should audit events be mirrored into the general domain event log (DATA)? Default: audit store is separate and authoritative for security; the domain events (`approval.*`) are published independently.
