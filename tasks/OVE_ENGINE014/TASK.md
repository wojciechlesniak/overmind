---
id: OVE_ENGINE014
title: Gateway rate limiting, concurrency limits and resource caps
area: ENGINE
kind: security
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_ENGINE011]
soft_depends_on: []
provides: ["lib:gateway-rate-limit"]
needs: ["lib:gateway-pipeline", "port:Clock", "port:Logger"]
owns: ["packages/gateway/src/ratelimit/**"]
reads: ["packages/gateway/src/pipeline/order.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 16"]
adr_refs: [6]
---

# OVE_ENGINE014: Rate limiting and resource caps

## 1. Summary

Protect the engine from runaway clients (a looping agent script, a buggy UI poll): token buckets per connection and per caller, per-route cost, in-flight request caps and SSE connection caps, mapped to `429 gateway.rate_limited` with `Retry-After`.

## 2. Context

SEC005 G9: 50 req/s per connection, body caps, 64 connections, header timeout. SR-37 resource exhaustion. Agents are the likeliest abusers: they run unattended inside the sandbox and call the API with a script. Limits are generous for the Owner UI and tighter for agents.

## 3. Scope (in)

- Token-bucket implementation on `Clock`, per-connection, per-caller (`owner`, `agent:<runId>`, `channel:telegram`) and per-route-cost limits, in-flight caps, SSE caps, config.

## 4. Out of scope

- Connection/header limits in the listener (ENGINE010). Telegram inbound rate limiting (TG).

## 5. Detailed requirements

1. Buckets (defaults, configurable under `AppConfig.gateway.limits`, additive section file `config/sections/gateway.config.ts`): per connection 50 req/s burst 100; Owner caller 200 req/s burst 400; agent caller 20 req/s burst 40 (per Run); `channel:telegram` 10 req/s burst 20. Route cost: default 1; list/search routes declare `cost: 3`; mutating routes `cost: 2` (route metadata `rateCost`, default 1).
2. Concurrency: max 32 in-flight requests globally, max 4 per agent caller, max 8 SSE streams total (extra -> `429 gateway.rate_limited` with detail `sse`). Slow handlers do not starve others because queues are bounded, not unlimited waits.
3. Decision before parsing the body (cheap) but after authentication (so unauthenticated floods hit the per-connection bucket only).
4. On rejection: `429`, `Retry-After: <seconds ceil>`, body `gateway.rate_limited` with `details: { retryAfterMs }`; `retryable: true`. Repeated violations by an agent (more than 100 rejections in a minute) raise an `agent.misbehaving` non-persisted event for Chief/diagnostics (no automatic block).
5. Limits use `Clock.monotonicMs` (immune to wall-clock jumps); bucket state in memory, bounded (LRU 10 000 callers); entries expire after 10 min idle.
6. The Owner UI must not be locked out by agent floods: buckets are per caller, never shared across caller kinds.
7. Metrics for diagnostics: rejected counts per caller kind and per route id (counts only).
8. Exempt: none, including health; health polling by the shell is cheap (cached).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Clock`, middleware slot `rateLimit` from the pipeline order table (ENGINE011), config sections (ARCH005).

## 8. Architecture and code placement

`packages/gateway/src/ratelimit/{token-bucket.ts,limiter.ts,middleware.ts}`; pure bucket logic testable with `FakeClock`.

## 9. Security and safety

Keeps a compromised or looping agent from degrading the Owner's session (SR-37) without granting it any new access. Fail-safe: if the limiter itself throws, the request is rejected with 503, not allowed through.

## 10. Errors and edge cases

- Clock identical across bursts: monotonic only.
- Huge `Retry-After`: capped at 60 s.
- Config sets 0: rejected by schema (min 1).
- Many short connections: per-connection bucket plus the 64 connection cap.

## 11. Acceptance criteria

- [ ] 10 000 small requests in a burst produce 429s and the server stays responsive (SEC005 test 12).
- [ ] Agent caller is limited tighter than Owner; Owner requests succeed during an agent flood.
- [ ] Bucket refill follows the fake clock exactly (unit test).
- [ ] 9th SSE stream is rejected.
- [ ] Limiter exception -> 503, not pass-through.

## 12. Test plan

Unit tests with `FakeClock`; integration flood test. Commands: `pnpm vitest run packages/gateway/src/ratelimit`.

## 13. Parallelization notes

Independent of ENGINE015/016 after ENGINE011.

## 14. Open questions and assumptions

- ASSUMPTION: limits above are starting values to tune after first usage.
