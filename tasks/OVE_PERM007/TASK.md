---
id: OVE_PERM007
title: Implement the access decision function with allow, deny and needs-approval reason codes
area: PERM
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_PERM001, OVE_PERM005, OVE_PERM006, OVE_SEC002]
soft_depends_on: []
provides: ["lib:evaluate-access", "contract:AccessAction", "contract:AccessDecision", "contract:DenyReason"]
needs: []
owns: ["packages/contracts/src/perm/access-action.ts", "packages/contracts/src/perm/access-decision.ts", "packages/domain/src/perm/evaluate/**"]
reads: ["packages/domain/src/perm/effective/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1", "SPECIFICATION 16.8", "SPECIFICATION 16.10"]
adr_refs: [3, 4, 21]
---

# OVE_PERM007: Implement the access decision function

## 1. Summary

A pure function `evaluateAccess(effective, action, context)` that answers `allow`, `deny` or `needs_approval` for one structured action with a stable reason code. It is the single place where "may this Agent do this?" is decided; the application service (`OVE_PERM010`) only gathers inputs and records the outcome.

## 2. Context

SPEC 19.3: before every risky operation check Effective Permissions and the Approval list. The sandbox mount list is the real wall for file access (ADR 0004/0020); this function is the policy brain used by the Tool Broker (for host-side operations such as network, Git, MCP, publish), by the mount plan and by the overmind Skill's "can I?" query. Unknown or unclassifiable actions are denied.

## 3. Scope (in)

- `AccessAction` discriminated union and `AccessDecision`, `DenyReason` enumerations (contracts).
- `evaluateAccess` and its ordered rule pipeline.
- A reason-to-error mapping table (`DenyReason` to `perm.*` code) used by callers.

## 4. Out of scope

Canonicalising paths (the caller passes a `PathVerdict` from SEC002; the function never touches the filesystem), loading policies (PERM010), recording violations and audit (PERM018/PERM019), creating approvals (PERM014).

## 5. Detailed requirements

1. **Action union** (strict, every string bounded):
   ```ts
   AccessAction =
    | { kind:'fs', op:'read'|'write'|'execute'|'delete'|'list', path: PathVerdictRef /* canonical result from PathGuard, includes flags */ }
    | { kind:'terminal', op:'run' }
    | { kind:'network', host: string, op:'connect' }
    | { kind:'git', op:'local'|'fetch'|'clone'|'push', remoteHost?: string }
    | { kind:'mcp', server: string, tool?: string }
    | { kind:'tool', toolId: string }
    | { kind:'external_message', channel: string }
    | { kind:'payment' } | { kind:'publish', target: string } | { kind:'budget', budgetKind: 'cost'|'time'|'iterations' }
   ```
   `PathVerdictRef` is `{ ok: true, canonical, rootId?, flags[] }` or `{ ok: false, code }`. The function never receives raw strings for paths.
2. **Decision**
   ```ts
   AccessDecision =
    | { verdict:'allow', via: 'directory'|'capability'|'lifted_approval' }
    | { verdict:'deny', reason: DenyReason, requestable: boolean /* may the agent file an Access Request? */, layer?: Layer }
    | { verdict:'needs_approval', actionClass: ActionClass, reason: 'default_list' }
   ```
3. **`DenyReason`:** `no_allowed_directories`, `path_invalid`, `path_outside_allowed`, `right_not_granted`, `limited_by_layer`, `protected_location`, `crosses_mount`, `capability_not_granted`, `host_not_allowed`, `tool_not_granted`, `unknown_action`, `run_not_active`, `paused`, `isolation_unavailable`, `policy_unreadable`. Each maps to one `perm.*` code via the table.
4. **Pipeline** (first failing rule wins, order is normative and tested):
   1. context guards: `run_not_active`, `paused` (context carries `runActive`, `paused` booleans), `isolation_unavailable` for any action with side effects when `sandbox.healthy === false` (fail closed, SR-05).
   2. `unknown_action` for any `kind` not handled (compile-time exhaustive `assertNever` plus a runtime default branch).
   3. For `fs`: path verdict not ok means deny `path_invalid` (or `protected_location` / `crosses_mount` when the code says so); empty directories means `no_allowed_directories`; find the grant containing the canonical path (component-wise, deepest entry); none means `path_outside_allowed` with `requestable: true`; entry exists but lacks the right means `right_not_granted` (`requestable: true` for write/execute upgrades); op `delete` needs `write`; op `list` needs `read`; `execute` needs `execute` (and `read`).
   4. For `terminal`, `git`, `mcp`, `tool`, `network`: check the resolved capability; deny `capability_not_granted` / `host_not_allowed` / `tool_not_granted`. For `network` the host must match the resolved allowlist **or** be provider-preallowed (`context.preallowedHosts`); otherwise it is a `new_domain` action (step 5) if the layers allow `network.mode==='allowlist'` at all, and `deny host_not_allowed` if `network.mode==='deny'`.
   5. Approval step: classify (PERM006). If a class applies and `requiresApproval(...)` is true return `needs_approval`; otherwise `allow` (`via: 'lifted_approval'` when an override applied).
   6. Default `allow` only reaches here through steps 3 to 5; there is no implicit allow before them.
5. **Executable bits and hardlinks:** `flags` containing `hardlinked` on a **write** op is denied with `right_not_granted` and detail `hardlink_write` (conservative default, see 14); `viaSymlink` is fine (PathGuard already contained it).
6. **Pure and total:** returns a decision for every input, never throws; unexpected input shape returns deny `unknown_action`.
7. `requestable` is true only for `path_outside_allowed`, `right_not_granted` on fs, and never for `protected_location`, `crosses_mount`, `capability_not_granted` (capabilities are changed by the Owner in settings, an Agent cannot ask via Access Request in MVP).
8. **Explain mode:** `evaluateAccess(..., { explain: true })` additionally returns the layer from `explainEffective` that removed a right (`layer`).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`EffectivePermissions` (PERM005), `requiresApproval`/`classifyAction` (PERM006), SEC002 `PathVerdict` and flags. Error mapping reuses `perm.errors` (PERM001).

## 8. Architecture and code placement

`packages/domain/src/perm/evaluate/{evaluate.ts,pipeline/*.ts,reason-map.ts}`: one small rule module per kind (SRP, OCP: a new action kind adds a rule module and a union member; the exhaustive switch forces the compile error). No imports from application.

## 9. Security and safety

The ordering guarantees that a paused or sandbox-less environment cannot be bypassed by a permissive policy, and that unknown actions are not allowed by default. The function is deterministic, so decisions can be replayed from the audit record (inputs recorded: effective hash, action, context flags). It never returns detail about paths outside the allowed set beyond `requestedRelative` (workspace-relative or `~`-relative), so a probing Agent learns nothing about the host layout (SR-04, error `perm.path_outside_allowed`). The `requestable` flag exists to keep Access Requests from being filed for things the Owner cannot sensibly grant.

## 10. Errors and edge cases

- Empty list: every fs action is `deny no_allowed_directories` (SPEC 16.1); the Run should not even start (WFRT/ONB), this is the defence in depth.
- Path equals the root itself: `list`/`read` allowed when `read` is granted.
- Path in an allowed directory but the Agent `maxRights=[read]`: `deny right_not_granted` with `layer: 'agent'` in explain mode.
- `network` with `mode:'deny'` for a provider host: provider hosts are pre-allowed by the sandbox policy, `context.preallowedHosts` decides, not the layers (ADR 0020).
- `git push` with `git.remote=allow` and no override: `needs_approval git_push`; with override: `allow lifted_approval`; with `git.remote=deny`: `deny capability_not_granted` (capability first).
- `fs delete` in a read-only directory: `deny right_not_granted`; in a writable directory: `needs_approval delete_files`.

## 11. Acceptance criteria

- [ ] The pipeline order is covered by tests: for each pair of simultaneously true conditions (paused plus outside path, unknown kind plus empty policy) the earlier rule's reason is returned.
- [ ] Every `DenyReason` is produced by at least one test and mapped to a registered error code.
- [ ] Given an empty Workspace list, any fs action is denied with `no_allowed_directories`.
- [ ] Given `delete` inside a `rw` directory with default approvals, the verdict is `needs_approval` (`delete_files`); with a lifted override it is `allow`.
- [ ] Given an unknown action kind cast through `any`, the verdict is deny `unknown_action`.
- [ ] Property: for any effective set E and any action A, `allow` implies the path is covered by E with the needed right (soundness), and decisions are identical for permuted inputs.

## 12. Test plan

Table-driven tests (80+ rows) grouped by pipeline step; fast-check soundness property using `arbPolicyLayers` (PERM005); exhaustiveness type test. `pnpm vitest run packages/domain/src/perm/evaluate`.

## 13. Parallelization notes

Needs PERM005 and PERM006 merged. PERM010, PERM017 (mount plan consistency test) and PERM030 depend on it. Hotspot: `reason-map.ts`; only this task edits it.

## 14. Open questions and assumptions

- ASSUMPTION: writes through hard-linked files are denied (the other link's location is unknown, SEC002 open question 9). The Owner can still use such files in read mode.
- ASSUMPTION: capability changes cannot be requested by Agents in MVP (only directories); revisit when network/MCP requests are needed (new domains already use Approvals).
