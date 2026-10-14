---
id: OVE_SKILL011
title: Expose Skills through gateway routes, push events and the api-client
area: SKILL
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_ENGINE012, OVE_ENGINE019, OVE_SHELL006, OVE_SKILL004, OVE_SKILL005, OVE_SKILL007, OVE_SKILL008, OVE_SKILL010]
soft_depends_on: []
provides: ["api:skills.list", "api:skills.get", "api:skills.create", "api:skills.version", "api:skills.archive", "api:skills.visibility", "api:skills.import", "api:skills.review", "lib:api-client-skills", "contract:SkillPushEvents"]
needs: ["lib:route-module", "lib:gateway-auth", "lib:event-hub", "lib:api-client-core", "usecase:CreateSkill", "usecase:AddSkillVersion", "usecase:ImportSkill", "usecase:DecideSkillVersion"]
owns: ["apps/engine/src/routes/skills/**", "packages/api-client/src/skills/**"]
reads: ["packages/contracts/src/skill/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 13"]
adr_refs: [12, 28, 5]
---

# OVE_SKILL011: Expose Skills through gateway routes, push events and the api-client

## 1. Summary

HTTP routes, push events and typed client for the Skills view: library, inspector, create, edit, import, review, visibility and archive.

## 2. Context

The Skills view (mock) lists cards, filters by source and visibility and shows an inspector. The UI (SKUI) uses only the typed client. Routes are Owner-session endpoints and are not exposed to the agent token surface.

## 3. Scope (in)

- Route module registration, validation, auth, error mapping, push events (`skill.*` over the event hub), client functions with zod parsing.

## 4. Out of scope

- UI. Agent-facing `/agent/v1` routes (AGENT015).

## 5. Detailed requirements

1. Routes: `GET /skills`, `GET /skills/:id`, `POST /skills`, `POST /skills/:id/versions`, `POST /skills/:id/archive`, `POST /skills/:id/visibility`, `POST /skills/import`, `GET /skills/reviews`, `POST /skills/:id/versions/:v/decision`. All require the Owner session; agent tokens and Telegram sessions get 403 `auth.forbidden_actor`.
2. Every route validates input with the SKILL001 schemas (strict), enforces body size (<= 300 KiB for text routes, import 300 KiB), maps `Result` errors through the error mapper (no stack traces), and sets `Cache-Control: no-store`.
3. Workspace comes from the session context, never from the body; a path id from another Workspace's private Skill returns 404.
4. Push: `skill.created`, `skill.version_added`, `skill.version_decided`, `skill.visibility_changed` forwarded to the event hub with ids only (no text); the client refetches.
5. Responses never include instruction text of pending imports in list endpoints; detail endpoint returns it flagged `untrusted`.
6. Idempotency keys supported on `POST` creates via `Idempotency-Key` header.
7. api-client functions typed from contracts, parsing responses with zod, with typed errors.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`lib:route-module`, error mapper, event hub.

## 8. Architecture and code placement

`apps/engine/src/routes/skills/{index.ts,handlers.ts}`; client `packages/api-client/src/skills/{index.ts,types.ts}`.

## 9. Security and safety

Owner-only surface; strict validation; rate limiting for import; no secrets in responses; CSRF/Origin handling follows gateway-auth. Text is returned as JSON strings only (never HTML).

## 10. Errors and edge cases

- Oversized body: 413.
- Unknown fields: 422.
- Import rate limit: 429 with retry-after.

## 11. Acceptance criteria

- [ ] Agent token and Telegram session refused on all routes.
- [ ] Cross-Workspace private Skill is 404.
- [ ] OpenAPI/contract snapshot test passes.
- [ ] Client parses every response.

## 12. Test plan

Route tests with in-memory app, contract snapshot, client tests with mock server. Command: `pnpm vitest run apps/engine/src/routes/skills packages/api-client/src/skills`.

## 13. Parallelization notes

Last of the Skills backend chain; SKUI depends on it.

## 14. Open questions and assumptions

- ASSUMPTION: Skill authoring is desktop-only (Telegram excluded).
