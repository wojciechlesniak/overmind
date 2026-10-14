---
id: OVE_PERM006
title: Define action classes, the default Approval list and override semantics
area: PERM
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_PERM001, OVE_PERM004]
soft_depends_on: []
provides: ["contract:ActionClass", "contract:ApprovalOverride", "lib:approval-rules"]
needs: []
owns: ["packages/contracts/src/perm/action-class.ts", "packages/contracts/src/perm/approval-override.ts", "packages/domain/src/perm/approval-rules/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.10"]
adr_refs: [21, 3, 6]
---

# OVE_PERM006: Define action classes, the default Approval list and override semantics

## 1. Summary

The default list of actions that need an Owner Approval (ADR 0021) as data and pure rules: which concrete action belongs to which `ActionClass`, whether an Approval is currently required for a given Workspace, and what an Owner override ("lift the requirement") means and where it may be created.

## 2. Context

ADR 0021: by default Approval is required for deleting files, `git push` and any publication, sending messages or emails outside, payments, entering a new internet domain, and exceeding the Budget. Everything else Agents do alone. The Owner may lift the requirement for selected actions in the Owner Rules (for example allow `git push`) but only locally, never from Telegram, because lifting widens permissions (ADR 0003, SR-16, SR-25). The Owner Rule entity belongs to DATA; the semantic of "which approval classes are lifted" belongs to PERM.

## 3. Scope (in)

- `ActionClass` enum and metadata table (label key, description key, default `requiresApproval`, `liftable`, `previewKind`).
- `ApprovalOverride` contract.
- `requiresApproval(actionClass, overrides, workspaceId): { required: boolean, reason }` pure.
- `classifyAction(action): Result<ActionClass | null>` for the action kinds of `AccessAction` (the type is defined in PERM007; this task defines the classifier registry and registers the built-in rules).

## 4. Out of scope

Creating and storing overrides (`OVE_PERM012`), approval lifecycle (`OVE_PERM013`, `OVE_PERM014`), evaluating capabilities (`OVE_PERM007`), Budget accounting itself (WFRT/PROV; this task only knows the class `budget_overrun`).

## 5. Detailed requirements

1. `ActionClass = 'delete_files' | 'git_push' | 'publish' | 'external_message' | 'payment' | 'new_domain' | 'budget_overrun'`. Metadata table `ACTION_CLASSES` (single source of truth, also used by the UI via a generated JSON):
   | class | default | liftable | preview |
   |---|---|---|---|
   | delete_files | required | yes | list of paths (first 20, count) |
   | git_push | required | yes | remote, branch, commit list (first 10) |
   | publish | required | yes | target (registry, URL, release name) |
   | external_message | required | yes | channel, recipient (redacted form), subject, body excerpt (500 chars) |
   | payment | required | **no** (ASSUMPTION, see 14) | amount, currency, payee |
   | new_domain | required | yes | host |
   | budget_overrun | required | **no** (ASSUMPTION) | budget kind, limit, projected |
2. **Classifier registry (OCP).** `ActionClassifier = { id, matches(action): boolean, classify(action): ActionClass }`; `registerClassifier` is used by tool owners through the Tool Broker composition module; built-in classifiers: `delete_files` for the structured actions `fs.delete` and `fs.delete_tree`; `git_push` for `git.push` (branches and tags); `publish` for the structured actions `publish.npm`, `publish.docker`, `publish.github_release` (declared by the tool, not parsed from commands: `npm publish`, `docker push`, `gh release create` are examples) and any `publish` action a Tool declares; `external_message` for kinds `message.send`, `email.send`; `payment` for `payment.*`; `new_domain` for `network` host not matched by the resolved allowlist **and** not provider-preallowed; `budget_overrun` for `budget.exceeded`. Unknown action kinds are **not** classified here (PERM007 denies unknown kinds).
3. **Classification is by structured action, never by command-line text.** Shell command strings are not parsed for intent; the sandbox mount list and tool broker produce structured actions. A tool that can both write and delete declares the delete as a separate structured action.
4. `ApprovalOverride = { id: EntityId<'aov'>, actionClass, workspaceId: EntityId<'ws'> | null /* null = all Workspaces */, createdAt, createdBy: { channel: 'desktop', local: true }, localConfirmationId: string, ownerRuleId?: EntityId<'rul'> }`. Only `liftable` classes can have overrides (`perm.override_not_allowed` otherwise). Overrides never expire automatically (an Owner Rule persists) but are removable.
5. `requiresApproval(actionClass, overrides, workspaceId)`: required unless an override exists for `(class, workspaceId)` or `(class, null)`. Result carries `{ required, reason: 'default_list' | 'lifted_by_owner' | 'not_in_list' }`.
6. **Independence from capabilities:** lifting `git_push` removes only the Approval step. If Effective Permissions deny `git.remote` the push is still denied (order of evaluation fixed in PERM007: capability first, then approval).
7. **Telegram and Agents cannot create overrides**; this is enforced in PERM008/PERM012, but the contract here has no field that could carry a Telegram channel (`createdBy.channel` is the literal `'desktop'`).

## 6. Design notes

N/A, functionality only. Labels are i18n keys `perm:actionClass.<class>.label|description` (strings authored in APPRUI).

## 7. Reuse

`ActionClass` is the vocabulary also used by `ApprovalRequest.action.class` (PERM013) and by Owner Rule UI. Do not create a parallel enum elsewhere.

## 8. Architecture and code placement

Contracts in `packages/contracts/src/perm/`, rules in `packages/domain/src/perm/approval-rules/{classes.ts,classifier.ts,requires-approval.ts}`. The registry is an array injected into `PermissionService` (PERM010); no global mutable registry.

## 9. Security and safety

The default list is the safety net for the actions with irreversible external effects. Controls: classification uses structured actions (immune to shell quoting tricks and prompt-injected command text); the default is "required"; the only way to relax is a locally confirmed override; non-liftable classes cannot be relaxed by any means in MVP; an unknown class value in stored data fails closed (treated as required). Overrides are audited on creation and removal.

## 10. Errors and edge cases

- `fs.delete` of a file inside `/work` that the Agent created in the same Run: still requires Approval (the default list is not exception-based); documented so nobody adds a silent exception.
- Override for another Workspace: not applied.
- Override stored, then Owner removes it: requirement is back immediately; pending operations are re-evaluated at execution time (PERM014 consumes approvals, checks again).
- New classifier registered twice with the same id: composition error.

## 11. Acceptance criteria

- [ ] Each of the seven classes is in `ACTION_CLASSES` with metadata; a snapshot test locks the list (additive changes only).
- [ ] `requiresApproval` returns `required` by default and `lifted_by_owner` only with a matching override.
- [ ] Creating an override for `payment` or `budget_overrun` is rejected with `perm.override_not_allowed`.
- [ ] The classifier maps `fs.delete`, `git.push`, `network` unknown host, `email.send` correctly and returns `null` for `fs.write`.
- [ ] A raw string such as `rm -rf /work` is not classifiable (type error and runtime null).

## 12. Test plan

Table tests for classifier and `requiresApproval`; property: lifting an override never turns `required: false` into `true`; snapshot test of metadata. `pnpm vitest run packages/domain/src/perm/approval-rules`.

## 13. Parallelization notes

Parallel with PERM003/004. `AccessAction` type (PERM007) may be stubbed until merged. Tool owners register classifiers through their own composition modules, no edit here.

## 14. Open questions and assumptions

- ASSUMPTION: `payment` and `budget_overrun` are not liftable: payments are irreversible and Budgets are enforced by the engine (SPEC 16.14). The Owner can still raise a Budget locally. Needs the Owner's confirmation.
- Open: is "any publication" a closed list (npm, docker, gh release) or open? Default: closed list above plus tool-declared `publish` actions.
