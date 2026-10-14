---
id: OVE_MEM012
title: "Serve read-only Agent Memory to the Owner through the gateway"
area: MEM
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ENGINE011, OVE_ENGINE013, OVE_ENGINE019, OVE_MEM002, OVE_MEM003, OVE_MEM004, OVE_MEM007]
soft_depends_on: ["OVE_ENGINE010"]
provides: ["api:memory.list", "api:memory.get", "api:memory.diagnostics", "client:memory"]
needs: ["lib:gateway-routes", "lib:caller-context", "lib:api-client-core", "lib:authorised-scope", "port:MemoryReadModel"]
owns: ["packages/gateway/src/routes/memory/**", "packages/api-client/src/memory/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.3"]
adr_refs: [14, 28]
---

# OVE_MEM012: Serve read-only Agent Memory to the Owner through the gateway

## 1. Summary

Owner-only read routes for the memory panel: list and get entries of an Agent, withheld isolated Workspaces, failed summary jobs. No write routes exist.

## 2. Context

Mock Agenci panel: 'tylko podgląd', 'Pamięci nie edytujesz. Zachowanie Agenta korygujesz Regułami Właściciela.', and a lock note for isolated Workspace 'Projekt klienta (NDA)'.

## 3. Scope (in)

- `GET /agents/:id/memory`, `GET /memory/:entryId`, `GET /agents/:id/memory/diagnostics`; api-client.

## 4. Out of scope

- UI.

## 5. Detailed requirements

1. Routes require Owner caller context; scope from MEM002 with purpose `owner_view`.
2. List returns `MemoryEntryView[]` with workspace tags, filter by Workspace and q, cursor paging (limit 50).
3. `withheld` lists isolated Workspaces whose entries are hidden because the UI context differs.
4. Quarantined entries shown with flags.
5. Any PUT/PATCH/DELETE/POST on memory paths returns 405 and logs `mem.edit_forbidden` audit.
6. Content is returned as plain text with JSON content type; the client renders as text.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

Gateway helpers.

## 8. Architecture and code placement

Thin routes calling the read model.

## 9. Security and safety

Owner only (Agents and Chief tokens get 403); no write routes; content escaped as text; ids validated; rate limit for list.

## 10. Errors and edge cases

- Unknown agent id: 404.
- Telegram channel: summary-only (no content).

## 11. Acceptance criteria

- [ ] Non-Owner callers get 403.
- [ ] Write verbs 405 and audited.
- [ ] Isolated Workspace entries withheld outside their context.
- [ ] OpenAPI schema generated.

## 12. Test plan

- Route tests with fakes. Commands: `pnpm vitest run packages/gateway/src/routes/memory`.

## 13. Parallelization notes

Independent of MEM013.

## 14. Open questions and assumptions

- ASSUMPTION: Owner in isolated Workspace context sees that Workspace's memory.
