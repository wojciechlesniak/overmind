---
id: OVE_WFRT014
title: Add permission-widening, override and visibility reference validation rules
area: WFRT
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_VIS001, OVE_VIS002, OVE_WFRT010]
soft_depends_on: [OVE_WFRT011]
provides: ["lib:validation-rules-permissions", "lib:validation-rules-references"]
needs: ["contract:Visibility", "lib:visibility-rules"]
owns: ["packages/domain/src/wfrt/validation/rules/perm.*.rule.ts", "packages/domain/src/wfrt/validation/rules/vis.*.rule.ts", "packages/domain/src/wfrt/validation/rules/ref.*.rule.ts", "packages/domain/src/wfrt/validation/forbidden-config-keys.ts"]
reads: ["packages/domain/src/wfrt/validation/context.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 11", "SPECIFICATION 16.10"]
adr_refs: [3, 7, 12, 28]
---

# OVE_WFRT014: Add permission-widening, override and visibility reference validation rules

## 1. Summary

Validation rules that make it impossible for a Workflow to widen permissions or skip approvals, restrict per-node overrides to model, prompt and Skills (ADR 0007), and enforce Visibility reference rules (ADR 0028) using the pre-fetched `ReferenceSnapshot`.

## 2. Context

ADR 0003: Effective Permissions are the intersection of policies, never the union; delegation can only narrow. ADR 0007: a Node may override model, prompt and Skills but not permissions. ADR 0012: Skills from the internet come only from the Owner. A Workflow is authored by the Owner or proposed by Chief, so a hostile or confused definition must never grant anything. Permissions are computed only by PERM at execution time (WFRT036), so config must not even contain such fields.

## 3. Scope (in)

Rules below and the deny-list module.

## 4. Out of scope

Runtime permission resolution (WFRT036). The visibility policy itself (VIS area), model catalogue (PROV). Strict zod parsing (WFRT003).

## 5. Detailed requirements

1. `forbidden-config-keys.ts`: exported list of normalised key names (lowercase, `_`/`-` removed) matched at any depth of a node `config` and of `groups`/`lanes`: `permissions, permissionprofile, permissionprofileid, allowedpaths, alloweddirectories, allowedroots, mounts, mount, readwrite, write, readonly, network, egress, domains, allowdomain, tools, toolgrants, grants, consent, consentoverrides, skipapproval, requireapproval, autoapprove, approvalpolicy, sandbox, isolation, sudo, env, secrets, secretref, token, apikey`. The scan runs on the RAW JSON (before zod) so the issue is explicit instead of a generic strict-schema failure.
2. `perm.config_contains_permission_field` (error): any forbidden key at any depth. Params `nodeKey`, `keyPath` (pointer only, not the value).
3. `perm.approval_bypass` (error): config keys or string flags implying approval skipping (`requireApproval:false`, `autoApprove`, `consentOverrides`). Covered by the list but reported under its own id for audit counts.
4. `perm.override_not_allowed` (error): `overrides` object in a node config with any key other than `model`, `prompt`, `skills` (allow-list, not deny-list). `overrides.prompt` max 8 000 chars; `overrides.skills` = `{add: SkillRef[], remove: SkillId[]}` max 10 each; `overrides.model = {providerId, modelId, fallback?: {providerId, modelId}}`.
5. `perm.prompt_override_suspicious` (warning): prompt override containing patterns that look like attempts to change rules (`ignore previous`, `disable`, `permission`, `approval`, `sandbox`, `override owner rule`) — heuristic only; the real defence is that prompts cannot change permissions (SEC004).
6. `vis.public_references_private` (error): a public Workflow referencing an Agent or Skill that is private (it would not resolve in other Workspaces). Params `refKind`, `refId`.
7. `vis.private_reference_other_workspace` (error): a private Agent/Skill whose `ownerWorkspaceId` differs from the Workflow's Workspace.
8. `vis.isolated_workspace_not_private` (error): Workflow in an isolated Workspace (`workspace.isolated` flag in the snapshot) with `visibility: public` (all content there is private, ADR 0028).
9. `ref.agent_unknown`, `ref.skill_unknown` (error): reference not found in the snapshot (deleted or invalid id); `ref.agent_version_pinned_missing` (error) when `pinVersion` is set and missing; `ref.model_unavailable` (warning in edit, error in run_start mode only if no fallback is available).
10. `ref.lane_unknown` (error): TOR node bound to a lane key absent from `lanes` (the binding itself is WFRT029).
11. Rules that need I/O results read only `ctx.references`; they never call ports.
12. Every denial produced by these rules in `publish` or `run_start` mode is also reported to the audit trail by the use case (`workflow.validation_denied`, count and rule ids, no content) via the PERM audit port (WFRT047 wires it).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ReferenceSnapshot` (WFRT010), `Visibility` and `visibility rules` (VIS), `SkillRef` (SKILL contract). Keyword scanning uses a tiny shared function in `forbidden-config-keys.ts`.

## 8. Architecture and code placement

Pure rules under `packages/domain/src/wfrt/validation/rules/{perm,vis,ref}.<name>.rule.ts`. The deny-list is data, not code, to make additions reviewable.

## 9. Security and safety

Core control for criterion 10 (no Agent or Telegram widens permissions) on the workflow side. The deny-list is intentionally broad; false positives are acceptable (a Node named `network-check` is fine because only KEYS are checked, not values or labels). Keys are normalised to defeat `Allowed_Directories`, `allowed-directories`, zero-width characters and Unicode confusables (NFKC normalisation then strip non `[a-z0-9]`). The scan is bounded to depth 20 and 10 000 keys. Fail closed: if the scan itself errors, the definition is invalid.

## 10. Errors and edge cases

Key hidden in an array of objects: found. Value (not key) mentioning "permissions": not an error. `overrides` nested under another key: forbidden by strict schema plus scan. Reference to an archived Agent: `ref.agent_unknown` with param `archived: true`.

## 11. Acceptance criteria

- [ ] Each forbidden key (list of 30+) in a hostile fixture yields `perm.config_contains_permission_field`.
- [ ] Confusable and case variants are caught (`Allowed_Directories`, fullwidth letters).
- [ ] `overrides` with `permissions` is rejected; with only model/prompt/skills passes.
- [ ] Visibility cases (public->private, private other workspace, isolated) tested with snapshots.
- [ ] Rules never read anything but `ctx`.

## 12. Test plan

Unit per rule with hostile corpus `packages/domain/src/wfrt/validation/__fixtures__/hostile-configs.json`; security test file `permission-widening.security.test.ts` (tag `[SPEC16.10]`). Command `pnpm vitest run packages/domain/src/wfrt/validation/rules/perm packages/domain/src/wfrt/validation/rules/vis packages/domain/src/wfrt/validation/rules/ref`.

## 13. Parallelization notes

Parallel with WFRT011/012/013. Needs the `ReferenceSnapshot` type from WFRT010 (merged first).

## 14. Open questions and assumptions

- ASSUMPTION: the VIS area exposes a pure `canReference(workflowVisibility, refVisibility, workspaces)` helper; until then the rule implements the three conditions above inline and VIS may replace the body.
