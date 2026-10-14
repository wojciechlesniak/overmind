---
id: OVE_PERM001
title: Define permission contracts (Right, AllowedDirectory, Policy, Profile) and PERM errors
area: PERM
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_ARCH008, OVE_SEC002]
soft_depends_on: [OVE_SEC001]
provides: ["contract:Right", "contract:AllowedDirectory", "contract:PermissionPolicy", "contract:PermissionProfile", "contract:CapabilitySet", "contract:PermissionProfileId", "lib:perm-errors", "lib:perm-id-prefixes"]
needs: []
owns: ["packages/contracts/src/perm/right.ts", "packages/contracts/src/perm/allowed-directory.ts", "packages/contracts/src/perm/permission-policy.ts", "packages/contracts/src/perm/permission-profile.ts", "packages/contracts/src/perm/capability-set.ts", "packages/contracts/src/errors/perm.errors.ts", "packages/contracts/src/kernel/id-prefixes/perm.ts"]
reads: ["packages/contracts/src/kernel/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 14", "SPECIFICATION 16.1", "SPECIFICATION 16.10"]
adr_refs: [3, 4, 20, 21]
---

# OVE_PERM001: Define permission contracts and errors

## 1. Summary

Define, once and as zod schemas, the data shapes of the permission model: `Right`, `AllowedDirectory`, `CapabilitySet`, `PermissionPolicy` (one per layer: Owner, Workspace, Agent, Workflow, Tool) and `PermissionProfile` (named, reusable). Register the PERM error code catalogue and id prefixes. Every other PERM task builds on these shapes, so they are fixed here and changed only additively.

## 2. Context

ADR 0003: the Owner is the only source of permissions; the list of Allowed Directories is empty by default (= no access); Effective Permissions are the intersection of the Owner, Workspace, Agent, Workflow and Tool policies, never the union. SPEC 11: directories have `read`, `write` and optional `execute`; separate permissions exist for terminal, network, Git and MCP (Chrome and simulators come later). Glossary: Allowed Directory, Permission Policy, Permission Profile, Effective Permissions. The Workspace entity belongs to DATA (`policyId`); the policy itself belongs to PERM.

## 3. Scope (in)

- zod schemas, inferred types and `defineEntity` metadata (ARCH008) for the shapes in section 5.
- Error codes `perm.*` in `perm.errors.ts` (format of ARCH003) used by all PERM tasks.
- Id prefixes `pol`, `prf`, `adr` (Allowed Directory; not to be confused with the ADR documents), `rgr` (Run Grant), `aov` (approval override), registered in `kernel/id-prefixes/perm.ts` (ARCH007). `apr`, `acr`, `aud` are already in the ARCH007 registry.
- JSON Schema snapshot via `pnpm contracts:snapshot`.

## 4. Out of scope

- Normalising and validating lists of directories (`OVE_PERM002`), intersection algebra (`OVE_PERM003`, `OVE_PERM004`, `OVE_PERM005`), persistence (`OVE_PERM024`), gateway routes (`OVE_PERM026`).
- Approval and Access Request entities (`OVE_PERM013`, `OVE_PERM015`).
- The `Workspace` entity and its `allowedRoots` field (DATA). PERM owns the data; see open question 1.

## 5. Detailed requirements

1. `Right = z.enum(['read','write','execute'])`. `RightSet` is a sorted, de-duplicated array. Valid sets (refinement `perm.invalid_rights`): `[read]`, `[read,write]`, `[read,execute]`, `[read,write,execute]`. `write` and `execute` without `read` are invalid (a write-only mount does not exist in the sandbox). The empty set is invalid on an `AllowedDirectory` (remove the entry instead); it is valid as a `maxRights` ceiling meaning "nothing" (`[]`).
2. `AllowedDirectory` (strict object):
   ```ts
   { id: EntityId<'adr'>, path: CanonicalPath /* SEC002, already canonical; the schema only checks shape: absolute, <=4096 bytes, no NUL/control chars */,
     rights: RightSet, primary: boolean /* maps to /work in the sandbox; at most one per policy */,
     label?: string /* max 80, display only */, source: 'wizard'|'owner_settings'|'access_grant',
     addedAt: IsoDateTime, rootFingerprint?: { dev: number, ino: number } /* recorded by PathGuard at registration, re-checked at Run start */ }
   ```
3. `CapabilitySet` describes everything that is not a directory. Every field has the form `'inherit' | <concrete>`; `inherit` means "this layer does not narrow" (the identity of the intersection). Concrete forms:
   - `terminal: 'allow'|'deny'`
   - `network: { mode: 'deny' } | { mode: 'allowlist', hosts: HostPattern[] }`; `HostPattern` = lowercase DNS name or `*.example.com`, max 253 chars, max 200 hosts, no IP literals, no ports, no schemes (a refinement rejects them).
   - `git: { local: 'allow'|'deny', remote: 'allow'|'deny' }` (`remote` = fetch/push/clone over the network; push still needs an Approval, ADR 0021).
   - `mcp: { servers: string[] }` (server ids, max 50; `[]` = none).
   - `tools: { toolIds: string[] }` (Tool ids from the Tool Broker, max 200; `[]` = none).
   - Reserved, not used in MVP: `chrome`, `simulator` (ADR 0003); the schema is `.strict()` so unknown keys are rejected, and adding them later is additive.
4. `PermissionPolicy`:
   ```ts
   { id: EntityId<'pol'>, scope: 'owner'|'workspace'|'agent'|'workflow'|'tool',
     subjectId: string | null /* null only for owner; workspaceId, agentId, workflowId, toolId otherwise */,
     profileId: EntityId<'prf'> | null /* agent layer: policy is derived from this profile */,
     directories: { mode: 'unrestricted' } | { mode: 'list', entries: AllowedDirectory[] /* max 64 */ },
     maxRights: RightSet | 'inherit' /* ceiling applied to every directory right */,
     capabilities: CapabilitySet, version: number /* int >=1, bumped on each change */,
     updatedAt: IsoDateTime, updatedBy: { kind: 'owner', channel: 'desktop' } | { kind: 'system', component: string } }
   ```
   Refinements: `scope==='workspace'` requires `directories.mode==='list'` (a Workspace that grants nothing has an empty list; "unrestricted" does not exist at the grantor layer); `scope==='owner'` has `subjectId===null`; others require a non-null `subjectId`; at most one `primary` entry; no duplicate canonical paths (full normalisation lives in PERM002).
5. `PermissionProfileId = entityId('prf')` is exported separately (`contract:PermissionProfileId`) so AGENT can reference a profile without importing the whole profile schema.
6. `PermissionProfile`: `{ id: EntityId<'prf'>, name: string (1..60, unique case-insensitively), description: string (<=300), builtIn: boolean, maxRights: RightSet|'inherit', capabilities: CapabilitySet, version, updatedAt }`. A profile carries no paths (paths are Workspace specific). Built-in profiles are `Development` and `Read Only` (definitions in `OVE_PERM011`); `builtIn` profiles are immutable.
7. Error codes (all `telegramSafe: true` unless stated; `audit: true`): `perm.invalid_rights`, `perm.invalid_policy`, `perm.deny_by_default` (403), `perm.path_outside_allowed` (403, details `{ requestedRelative }`), `perm.right_not_granted` (403), `perm.capability_not_granted` (403), `perm.protected_location` (403), `perm.local_approval_required` (403, the Owner must act on the desktop), `perm.channel_not_permitted` (403), `perm.owner_required` (403, caller is not the Owner), `perm.local_only` (403, alias semantics of `perm.local_approval_required` for operations that are simply desktop-only, for example visibility changes; AGENT and VIS use it), `perm.widening_requires_local` (403), `perm.approval_required` (409), `perm.approval_expired` (410), `perm.approval_not_pending` (409), `perm.approval_mismatch` (409, action hash differs), `perm.access_request_not_pending` (409), `perm.access_request_limit` (429), `perm.override_not_allowed` (403), `perm.profile_builtin_immutable` (409), `perm.profile_in_use` (409), `perm.policy_conflict` (409, optimistic version), `perm.policy_unreadable` (503, fail closed), `perm.isolation_unavailable` (503), `perm.paused` (423), `perm.unknown_action` (403), `perm.audit_unavailable` (503), `perm.not_found` (404, same response for foreign and missing resources).
8. Strictness: all objects `.strict()`, every string has `.max()`, every array a `.max()` (CONTRACT_UNBOUNDED_STRING lint). Nothing here may contain a secret field.
9. Export JSON Schema and the snapshot files (`entities/AllowedDirectory.json` etc.) so the additive-only check (ARCH008) protects the shapes from now on.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`CanonicalPath` (SEC002), `EntityId`/prefix registry (ARCH007), `defineEntity`, `defineErrors` (ARCH003/ARCH008), `IsoDateTime` kernel type. Do not redefine path validation: only import the branded type.

## 8. Architecture and code placement

`packages/contracts/src/perm/*.ts` (one file per entity, barrels generated by ARCH009). Contracts depend on nothing else internal except `kernel`. Domain and application code import types only from here.

## 9. Security and safety

These types are the validation boundary for Owner input and for agent-visible data. Strict objects reject unexpected fields (no hidden `rights: ['admin']`, no `scope` smuggling). `unrestricted` is structurally impossible at the Workspace layer, so a missing list can never be read as "everything". A path that is not canonical is never accepted as an `AllowedDirectory`: the brand cannot be forged by JSON, so only PERM002 (calling `PathGuard`) may turn a string into one. No field is secret; error `details` carry workspace-relative paths only.

## 10. Errors and edge cases

- `rights: []` on a directory: `perm.invalid_rights`. `rights: ['write']`: invalid. Duplicate rights are collapsed; unsorted input is sorted.
- Two `primary` entries, 65 entries, 201 hosts, host `192.168.0.1`, `http://x.com`, `*.com` (wildcard on a public suffix is rejected by a small deny list, `*.com`, `*.org`, `*.io`, `*.net`, `*`): invalid with a specific issue path.
- `scope:'owner'` with `subjectId`: invalid. `scope:'workspace'` with `mode:'unrestricted'`: invalid.
- Unknown capability key `chrome`: rejected today, additive later.

## 11. Acceptance criteria

- [ ] All schemas exist, are strict and bounded; the contract check (ARCH008) and the snapshot pass.
- [ ] Given `{ rights: ['write'] }`, when parsed, then it fails with `perm.invalid_rights`.
- [ ] Given a `workspace` policy with `directories: { mode: 'unrestricted' }`, then parsing fails.
- [ ] Given hosts `*.com` or an IP literal, then parsing fails.
- [ ] Every error code listed in requirement 7 is registered with `http`, `severity`, `retryable`, `messageKey`, `detailsSchema`.
- [ ] The id prefixes are registered and the registry test (3 lowercase letters, unique) passes.

## 12. Test plan

`packages/contracts/src/perm/*.test.ts`: table tests for each refinement above, round-trip JSON Schema tests, a negative test per `.strict()` object (extra key rejected), registry tests for errors and prefixes. Run `pnpm vitest run packages/contracts/src/perm` and `pnpm contracts:check`.

## 13. Parallelization notes

First PERM task; unblocks all others (contracts-first). UI areas (APPRUI, WSPACE, ONB) may start against the snapshots. Hotspot: none (one file per entity, generated barrels). Other areas must not add `perm.*` codes; they request them through a proposal.

## 14. Open questions and assumptions

1. ASSUMPTION: the Workspace policy (the list of Allowed Directories of a Workspace) is stored in PERM tables and DATA's `Workspace.allowedRoots` is a read-only projection or absent; DATA must not keep a second writable copy. Needs DATA's agreement (flag to the linker).
2. ASSUMPTION: `write` implies `read` in every set (see requirement 1). If BOX can mount write-only, revisit.
3. ASSUMPTION: capabilities beyond directories are allowlist-based for `network`, `mcp` and `tools` (deny by default); `terminal` and `git` are booleans.
