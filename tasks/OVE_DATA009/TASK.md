---
id: OVE_DATA009
title: Define the Workspace contract (zod), events and error codes
area: DATA
kind: contract
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_ARCH008, OVE_ARCH010]
soft_depends_on: []
provides: ["contract:Workspace", "contract:WorkspaceBudget", "event:workspace.created", "event:workspace.renamed", "event:workspace.deleted", "event:workspace.updated", "contract:Budget"]
needs: ["lib:define-event", "lib:contract-pipeline"]
owns: ["packages/contracts/src/workspace/**", "packages/contracts/src/events/workspace.created.event.ts", "packages/contracts/src/events/workspace.renamed.event.ts", "packages/contracts/src/events/workspace.updated.event.ts", "packages/contracts/src/events/workspace.deleted.event.ts", "packages/contracts/src/kernel/id-prefixes/data.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 2", "SPECIFICATION 10", "SPECIFICATION 14"]
adr_refs: [10, 28]
---

# OVE_DATA009: Define the Workspace contract (zod), events and error codes

## 1. Summary

The single definition of a Workspace: fields, limits, create/rename/update inputs, summaries and events. Types, JSON Schema and the client types are generated from it (ARCH008).

## 2. Context

A Workspace is the unit of work, memory boundary and isolation (glossary, SPEC 10/11). The list of Allowed Directories belongs to the Permission Policy owned by PERM; a Workspace only references `policyId`. `isolated` Workspaces expose nothing to others (ADR 0008, SPEC 10). Visibility (public/private) applies to Agents, Skills, Workflows, not to Workspaces (ADR 0028).

## 3. Scope (in)

- Zod schemas: `Workspace`, `WorkspaceBudget`, `WorkspaceSummary`, `CreateWorkspaceInput`, `RenameWorkspaceInput`, `UpdateWorkspaceInput`, `DeleteWorkspaceInput`, `WorkspaceDeletionPreview`.
- Four event definitions (persisted, workspace scope).
- ID prefix registration file `kernel/id-prefixes/data.ts`: registers `pdr` (ProjectDocRef) only; `ws`, `rul`, `art` already exist in ARCH007.

## 4. Out of scope

- Repository and use cases: DATA010/011/012. Routes: DATA011/012. Allowed Directory and policy schema: PERM. UI: WSPACE.

## 5. Detailed requirements

1. `Workspace` (strict): `id: EntityId<'ws'>`, `name: string` (trimmed, 1..80 chars, no control characters, no leading/trailing dots), `slug: string` (derived, kebab-case, 1..80, unique), `description?: string` (<=500), `isolated: boolean`, `policyId: EntityId<'pol'> | null` (null until PERM creates the policy; PERM prefix `pol` registered by PERM), `budget: WorkspaceBudget`, `paused: boolean`, `pausedAt: IsoDateTime | null`, `status: 'active' | 'deleting'`, `createdAt`, `updatedAt`, `version: int >= 1`.
2. `WorkspaceBudget`: `{ maxCostUsd: number | null (>=0, <=1_000_000), maxTokens: int | null (>=0), window: 'run' | 'day' | 'month' | 'total', onExceed: 'ask_owner' }` (ASSUMPTION: the only action on exceed is the default consent from ADR 0021, "exceeding Budget needs Approval"; enforcement belongs to WFRT/PERM). Defaults: both limits `null`, window `total`.
3. `CreateWorkspaceInput` (request, strict): `name`, `description?`, `isolated?: boolean (default false)`, `budget?`. No `policyId`, no roots: roots are added through PERM routes with Local Approval.
4. `RenameWorkspaceInput`: `{ id, name, expectedVersion }`. `UpdateWorkspaceInput`: `{ id, description?, budget?, expectedVersion }` (isolation changes use a dedicated route in DATA011 because they expand/restrict exposure).
5. `WorkspaceSummary` for lists: `{ id, name, slug, isolated, paused, status, updatedAt }`.
6. `WorkspaceDeletionPreview`: `{ workspaceId, name, counts: Record<string, int> /* e.g. decisions, tasks, agentMemories, privateAgents, privateSkills, privateWorkflows, runs, artifacts */, warnings: string[] (i18n keys only) }`.
7. Events (all `persisted: true`, scope workspace, `visibleTo: ['owner']`, `audit: true` for deleted and isolation changes): `workspace.created {workspaceId, name, isolated}`, `workspace.renamed {workspaceId, from, to}`, `workspace.updated {workspaceId, changed: string[]}` (changed field names only), `workspace.deleted {workspaceId, name, counts}` (written by the cascade; payload keeps the NAME so history stays meaningful). Names are user text and bounded (80).
8. Errors (registered in `data.errors.ts` by DATA001; listed here for reference): `data.workspace_name_taken` (409), `data.workspace_not_empty` (not used in MVP, delete cascades), `data.not_found`, `data.version_conflict` (409), `perm.local_approval_required` (owned by PERM, referenced in route contracts).
9. Name uniqueness is case-insensitive and NFC-normalised; `slug` derived with transliteration of Polish letters (ą->a, ł->l ...).
10. All strings bounded, objects `.strict()`, JSON-schema-safe primitives only (ARCH008 rules).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`entityId`, `isoDateTime` (ARCH007), `defineEntity`, `defineEvent` (ARCH008/010), error constructors (ARCH003).

## 8. Architecture and code placement

Contracts layer: `packages/contracts/src/workspace/{workspace.schema.ts,workspace-inputs.schema.ts}` and one file per event under `packages/contracts/src/events/`. No logic beyond schemas and pure normalisers (`normaliseWorkspaceName`, `slugify`) which live in `packages/domain/src/workspace/naming.ts` (owned by DATA010) to keep contracts free of logic.

## 9. Security and safety

Strict objects reject unknown fields (an Agent or Telegram cannot smuggle `policyId` or `isolated`). Names are untrusted display text: bounded, control characters rejected, never used as paths (the slug is the only path-safe form, and Workspaces never map to directories by name). Events carry no budget secrets (none exist).

## 10. Errors and edge cases

- Name with only whitespace or zero-width characters: rejected.
- Two names that differ only in case/diacritic normalisation: conflict.
- `budget.maxCostUsd` negative or NaN: rejected by schema.
- Old client sends fewer fields: new fields are optional in requests (additive-only).

## 11. Acceptance criteria

- [ ] Schemas parse valid fixtures and reject: unknown keys, 81-char name, control characters, negative budget.
- [ ] `contracts:check` snapshot files exist for each entity/event.
- [ ] Events are registered with the right `persisted`, scope and audit flags.
- [ ] `slugify('Zażółć gęślą jaźń')` returns `zazolc-gesla-jazn`.

## 12. Test plan

Unit tests for schemas (table-driven valid/invalid), snapshot via `pnpm contracts:snapshot`, type tests. Commands: `pnpm vitest run packages/contracts/src/workspace`.

## 13. Parallelization notes

Unblocks DATA010, DATA011, WSPACE UI tasks, every area referencing `workspaceId` (they only need `EntityId<'ws'>`, already in ARCH007).

## 14. Open questions and assumptions

- ASSUMPTION: Budget shape (cost and tokens, window, ask_owner) because SPEC 14 only says `budget`. WFRT/PERM may extend additively.
- ASSUMPTION: per-Workspace `paused` is a flag set by the PAUSE area's use case through `WorkspaceRepository.setPaused`; global pause lives in PauseState.
