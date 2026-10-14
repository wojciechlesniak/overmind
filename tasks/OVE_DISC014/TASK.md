---
id: OVE_DISC014
title: "Expose Discussion routes, live event stream and api-client"
area: DISC
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_DISC009, OVE_DISC012, OVE_DISC013, OVE_ENGINE011, OVE_ENGINE013, OVE_ENGINE019, OVE_SHELL006]
soft_depends_on: []
provides: ["api:discussion.list", "api:discussion.get", "api:discussion.messages", "api:discussion.owner-post", "api:discussion.control", "api:discussion.outcome", "api:discussion.export", "lib:api-client-discussion"]
needs: ["lib:gateway-routes", "lib:caller-context", "lib:event-hub", "lib:api-client-core", "lib:error-catalogue"]
owns: ["packages/gateway/src/routes/discussion/**", "packages/api-client/src/discussion/**"]
reads: ["packages/contracts/src/discussion/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 6", "SPECIFICATION 8", "SPECIFICATION 16.6"]
adr_refs: [15, 23]
---

# OVE_DISC014: Expose Discussion routes, live event stream and api-client

## 1. Summary

Expose Discussions through the authenticated gateway: lists, detail, message paging, Owner posting and votes, controls (pause, resume, conclude now, cancel), outcome approval/rejection/edit, export, and the live stream mapping so the Owner watches a Discussion in real time. Include the typed api-client.

## 2. Context

Same infrastructure and rules as OVE_BOARD013 (route modules, strict schemas, caller context, hub replay by `afterEventId`). ADR 0023/SPEC 5: the Owner can watch live and post. Telegram can view summaries and comment (ASSUMPTION, see DISC009). Agents have no access to Discussion routes (they participate through the engine only).

## 3. Scope (in)

- Route modules and schemas, event visibility mapping, live stream subscription helper, api-client, contract tests.

## 4. Out of scope

- Gateway infrastructure: ENGINE. UI: DISCUI. Telegram formatting: TG.

## 5. Detailed requirements

1. **Routes** (`/api/v1`, `:wid` WorkspaceId): `GET /workspaces/:wid/discussions?section=running|finished&runId=&participantId=`; `GET /workspaces/:wid/discussions/:id`; `GET /workspaces/:wid/discussions/:id/messages?afterSeq=&limit=`; `POST .../:id/owner-posts` `{ kind: 'comment'|'vote', text, optionKey? }`; `POST .../:id/pause|resume|conclude-now|cancel`; `POST .../:id/outcome/approve` `{ revision, contentHash }`; `POST .../:id/outcome/reject` `{ reason }`; `POST .../:id/outcome/edit`; `GET .../:id/export?format=`. No create route for Owner (Discussions start by Node or Chief).
2. **Callers:** owner (all), channel Telegram (`GET` summaries, `owner-posts` comment, `pause`, `resume`), chief and agents none (system-to-system calls use use cases directly, not the gateway). Allowed callers declared per route; violation -> 403 and audit.
3. **Validation:** strict zod; bodies cannot carry `author`, `trust`, `workspaceId`, `actor`; `Idempotency-Key` honoured on `owner-posts` (prevents duplicate sends on retry); text length 1..2000.
4. **Live stream:** events `discussion.*` and `discussion.typing` visible to owner and channel (summary previews only to channel); hub filters by Workspace and `discussionId` subscription option `{ discussionId }` added through the generic filter (`types`, `workspaceId`, `afterEventId`, plus optional `subjectId` supported by the hub, ENGINE). Reconnect replays persisted events after `afterEventId`; typing is best-effort. The UI loads detail, then subscribes with the last `seq`/event id and fetches messages by `afterSeq` when it sees `message.posted` (payload has only a preview).
5. **Responses:** `Result` mapped by `toErrorResponse`; `409 disc.invalid_state` / `outcome_not_approved` carry the current status; approval with stale hash -> `422 disc.outcome_invalid` with `details.currentRevision`.
6. **api-client:** `packages/api-client/src/discussion/{discussions.client.ts,owner.client.ts,outcome.client.ts}` plus `subscribeDiscussion(workspaceId, discussionId, handlers)`.
7. **Rate limits:** `owner-posts` 10/min per Discussion; list 60/min.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

ENGINE gateway kit and hub, ARCH003 error mapping, DISC009/012/013 use cases. No logic in routes.

## 8. Architecture and code placement

`packages/gateway/src/routes/discussion/*.route.ts` (one per capability), `packages/api-client/src/discussion/**`. Depends on use cases and contracts.

## 9. Security and safety

Trust boundary for Owner authority: Owner-authored messages, votes and approvals exist only behind these routes with an authenticated owner caller; mass assignment of `author`/`trust` is rejected; Telegram has reduced rights (no vote, no approval, no conclude-now, no cancel); agents cannot call anything; stream events carry previews and are filtered per caller; stale-hash approval protects against TOCTOU; rate limits and idempotency keys limit abuse and duplicates; errors never include prompt text or paths.

## 10. Errors and edge cases

- Approve on a Discussion that needs no approval: `disc.invalid_state`.
- Stream reconnect beyond retention: `events.resync_required`; client refetches detail.
- Telegram caller requests export: refused.
- Foreign-Workspace discussion id: 404.

## 11. Acceptance criteria

- [ ] Every route has schemas, allowed callers and contract tests for success and error mapping.
- [ ] Mass assignment of `trust`/`author` is rejected; Telegram cannot vote, approve, conclude or cancel.
- [ ] Idempotent `owner-posts`.
- [ ] Live stream delivers `message.posted` in order and resumes after reconnect with `afterEventId`.
- [ ] Event previews only for channel callers.
- [ ] api-client covered by tests against the gateway harness.

## 12. Test plan

- `*.route.test.ts` with the gateway test harness and fake use cases; stream test with `FakeClock` and in-process hub; caller matrix test. Commands: `pnpm vitest run packages/gateway/src/routes/discussion packages/api-client/src/discussion`.

## 13. Parallelization notes

Parallel with DISC015. DISCUI depends on the api-client types.

## 14. Open questions and assumptions

- ASSUMPTION: Telegram may pause/resume and comment; confirm with TG tasks.
