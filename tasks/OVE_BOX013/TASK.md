---
id: OVE_BOX013
title: Turn blocked new-domain requests into Owner Approvals (egress approval hook)
area: BOX
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH010, OVE_BOX011, OVE_ENGINE016, OVE_PAUSE001, OVE_PERM013]
soft_depends_on: [OVE_BOX012, OVE_BOX018]
provides: ["lib:egress-approval-hook", "event:sandbox.egress_blocked"]
needs: ["usecase:RequestNetworkApproval", "event:approval.decided", "port:AuditSink", "port:PauseState", "lib:define-event"]
owns:
  - packages/adapters/sandbox-macos/src/egress/approval/**
  - packages/contracts/src/events/sandbox-egress-blocked.event.ts
reads: ["packages/adapters/sandbox-macos/src/egress/allowlist/"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16"]
adr_refs: [3, 6, 21]
---

# OVE_BOX013: Turn blocked new-domain requests into Owner Approvals (egress approval hook)

## 1. Summary

When an Agent's tool tries to reach a domain that is not on the allowlist, the proxy must not simply fail silently: it files an Approval request (ADR 0021: entering a new domain needs a Zgoda), deduplicates concurrent requests, and applies the Owner's answer, either for the current Run (also from Telegram) or permanently for the Workspace (desktop only). Default is deny.

## 2. Context

`EgressPolicy.onNewHost` is `'block' | 'ask'` (OVE_ARCH012). PERM owns Approvals, Access Requests and the rule that Telegram can only approve for the current Run (SR-15, ADR 0006) and that lifting an approval requirement is a Local Approval (SR-25). This adapter piece sits between the proxy decider (OVE_BOX011) and PERM's use case `RequestNetworkApproval`. A tunnel for a blocked host is held open at most `askTimeoutMs` while waiting for the answer; the CLI sees a slow connect or a `403`.

## 3. Scope (in)

- `ApprovalBackedDecider` implementing `EgressDecider.decide` around the base allowlist decider.
- Deduplication, rate limits, TTL of grants, revocation on Run end.
- The event `sandbox.egress_blocked` and its payload.

## 4. Out of scope

- Approval UI and Telegram rendering (APPRUI, TG). Persisting permanent Workspace grants (PERM stores them; this task reads/writes through the use case). Proxy mechanics: BOX011.

## 5. Detailed requirements

1. **Decision flow:** `decide(req)`: (1) base allowlist decision; if `allow` return it. (2) If the host is syntactically invalid or resolves privately, return `deny` (never asked: asking cannot make SSRF safe). (3) If policy `onNewHost === 'block'`, deny with `not_allowed`. (4) If `'ask'`, call `RequestNetworkApproval.execute({ workspaceId, agentId, runId, host, port, scheme })` which returns a `ticket`; return `{ action: 'ask', ticket }`; the proxy waits for `approval.decided` events for that ticket (BOX011 requirement 1) up to `askTimeoutMs`.
2. **Approval scope:** the use case result carries `scope: 'run' | 'workspace'` and the channel; the hook records `RunGrant { runId, hostPattern, expiresAt }` for `run` (expires at Run end or after 4 h, whichever first) and notes a `workspace` grant by re-reading PERM policy (the base decider reads policy from PERM on each decision with a 5 s cache; this task does not store permanent grants itself).
3. **What the Owner approves:** the exact host (never a wildcard unless the Owner explicitly widens it in the desktop UI, a PERM concern); the port stays 443 unless the request named another allowed port; approvals do not cover subdomains. The Approval text built by PERM receives `{ host, port, agentName, taskTitle? }` only; no URL paths from the Agent.
4. **Deduplication:** concurrent requests for the same `(runId, host)` share one ticket; at most 5 open tickets per Run and 20 per installation; more are denied `rate_limited` with an audit event (prompt-injected loops cannot spam the Owner).
5. **Cooldown after deny:** a denied host is not asked again in the same Run for 15 minutes (decision cache), unless the Owner changes the policy.
6. **Pause:** when Global Pause is on, `ask` is not issued; denial `paused`. Open tickets are cancelled on Pause.
7. **Event `sandbox.egress_blocked`:** `{ envId, workspaceId, agentId, runId?, host, port, action: 'denied'|'asked', reason, at }` defined with `defineEvent('sandbox.egress_blocked', schema, { persisted: true })`; host strings pass the same normaliser as the proxy, max 253 chars. The Activity view and notifications consume it.
8. **Audit:** each ask and each decision applied writes `AuditEvent` via `AuditSink` with `actor: 'agent:<id>'`, `action: 'net.request_domain'`, `target: host`, `result`.
9. **Telegram constraint:** a run-scoped approval from Telegram is accepted by PERM; a request to make it permanent from Telegram is refused by PERM (`perm.local_approval_required`); this hook relays PERM's refusal as deny/keep-asking behaviour without special logic.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`EgressDecider` (BOX011), `RequestNetworkApproval` and `approval.decided` (PERM), `defineEvent` (ARCH010), `SecureRandom` for tickets (SEC005), host normaliser (BOX011).

## 8. Architecture and code placement

`packages/adapters/sandbox-macos/src/egress/approval/{approval-backed-decider.ts,run-grants.ts,dedupe.ts,deny-cache.ts}`; event contract file under `packages/contracts/src/events/`. Depends on application use case interfaces only.

## 9. Security and safety

An approval prompt is an attack surface (social engineering, flooding, look-alike hosts). Mitigations: show normalised punycode with the Unicode form (PERM/UI), dedupe and cap, never ask for private or invalid targets, deny by default after timeout, run-scoped grants expire, no wildcard grants from Agents, no URL paths forwarded. Content of the blocked request is never shown (could carry secrets). Fail closed: if PERM is unavailable, deny.

## 10. Errors and edge cases

- Owner approves after the CLI already gave up (timeout): the grant exists for retries; the next request is allowed.
- Approval for host A while the tunnel was to host B (ticket mix-up): tickets are bound to `(envId, runId, host)`; mismatch ignored.
- Run ends with open ticket: ticket cancelled, grant revoked.
- Agent switches to different subdomains rapidly (`a1.evil.com`, `a2.evil.com`): each is a separate ticket subject to caps, so flooding is bounded.
- `approval.decided` event lost (bus restart): proxy times out and denies; the Owner sees a stale pending approval resolved on next sync.
- Telegram approval arrives for a stale run id: PERM rejects.

## 11. Acceptance criteria

- [ ] A denied or timed-out ask results in a `403` from the proxy and an audit event.
- [ ] A run-scoped approval allows later connections to the exact host and expires when the Run ends.
- [ ] Concurrent identical requests produce one Approval; more than 5 open tickets per Run are denied.
- [ ] A private-resolving host is denied without creating an Approval.
- [ ] With Global Pause on, no Approval is created.
- [ ] PERM failure results in deny (fail closed).
- [ ] `sandbox.egress_blocked` events validate against their schema and never contain paths or headers.

## 12. Test plan

Unit tests with fake `RequestNetworkApproval`, fake bus and fake clock: dedupe, caps, cooldown, expiry. Integration with the real proxy and a stub target (Linux). Commands: `pnpm vitest run packages/adapters/sandbox-macos/src/egress/approval`.

## 13. Parallelization notes

Parallel with BOX012. PERM must publish `RequestNetworkApproval` and `approval.decided` contracts early; code against fakes until then.

## 14. Open questions and assumptions

- ASSUMPTION: PERM provides `RequestNetworkApproval` with `{ scope, channel }` in the decided event and an `ApprovalVerifier`.
- Open: wait time for the Owner (default 120 s); long enough for a notification round trip, short enough that CLIs do not hang. Owner may tune in settings later.
