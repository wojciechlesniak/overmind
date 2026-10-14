---
id: OVE_WFRT010
title: Build the static validation framework (rules, runner, report, use case)
area: WFRT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH004, OVE_ARCH009, OVE_WFRT003, OVE_WFRT005]
soft_depends_on: [OVE_WFRT001]
provides: ["lib:workflow-validator", "contract:ValidationReport", "contract:ValidationIssue", "usecase:ValidateWorkflow", "port:ReferenceCatalog"]
needs: ["lib:result", "contract:AppError", "lib:extension-generators", "port:Logger"]
owns: ["packages/contracts/src/workflow/validation/**", "packages/domain/src/wfrt/validation/runner.ts", "packages/domain/src/wfrt/validation/rule.ts", "packages/domain/src/wfrt/validation/context.ts", "packages/domain/src/wfrt/validation/rules/index.ts", "packages/application/src/ports/ReferenceCatalog.ts", "packages/application/src/wfrt/validate-workflow.usecase.ts"]
reads: ["packages/domain/src/wfrt/nodes/registry.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 16.5"]
adr_refs: [2, 7, 28]
---

# OVE_WFRT010: Build the static validation framework (rule interface, runner, report, application use case)

## 1. Summary

A pure, deterministic validator for workflow definitions built from small rules (one file each). This task delivers the `ValidationRule` interface, the runner, the `ValidationReport` contract, the reference snapshot context and the `ValidateWorkflow` use case used by the editor (live validation footer "Walidacja: 0 błędów"), by publish and by Run start. Concrete rules come in WFRT011 to WFRT014 and per-node tasks.

## 2. Context

The mock footer shows "Walidacja: 0 błędów"; invalid states are not shown and must be designed from the report. ADR 0002: raw back-edges are errors; SPEC 7: typed ports, unreachable nodes, missing start/end, Join/Loop requirements. Validation runs at three points: editing (advisory), publish (blocking), Run start (re-check, defence in depth).

## 3. Scope (in)

Rule/runner/context/report types, rule discovery, deterministic ordering, size limits, the `ReferenceCatalog` port and `ReferenceSnapshot`, the use case.

## 4. Out of scope

Concrete rules (WFRT011 to WFRT014, node tasks, WFRT017 for expressions). Gateway routes (WFRT047). Editor rendering of issues (WFED).

## 5. Detailed requirements

1. `ValidationIssue`: `{ ruleId: string ('graph.unreachable_node'), severity: 'error'|'warning', messageKey: 'workflow:validation.<ruleId>', params: Record<string, string|number> (bounded, no secrets), target: { nodeKey?, edgeId?, portName?, groupId?, path?: string (JSON pointer into the definition) }, fixHintKey? }`. `ValidationReport`: `{ valid: boolean (no error), errors: ValidationIssue[], warnings: ValidationIssue[], definitionHash, validatorVersion: string, truncated: boolean }`; max 100 issues in total (errors first), `truncated` set when more existed.
2. `ValidationRule`: `{ id: string, severity: 'error'|'warning', appliesTo?: 'always'|'publish_only', check(ctx: ValidationContext): ValidationIssue[] }` — pure, no I/O, must not throw (runner wraps in try/catch and reports `validator.rule_crashed` as an error issue naming the rule, fail closed: crash means invalid).
3. `ValidationContext`: `{ definition, graph: DefinitionGraph (adjacency by node and port, built once by `buildGraph`, shared by rules), registry: NodeRegistry (read-only), workflow: { id?, workspaceId, visibility, ownerWorkspaceId? }, references: ReferenceSnapshot, mode: 'edit'|'publish'|'run_start' }`. `ReferenceSnapshot`: `{ agents: Record<AgentId, {exists, visibility, ownerWorkspaceId?, configVersion}>, skills: Record<SkillId, {...}>, models: Record<'provider/model', {available}>, lanes: ... }` built by the use case from the definition's references.
4. Runner: parse via `upgradeDefinition` + `parseNodeConfig` first (structural parse errors become issues `config.invalid` with the zod issue path, not exceptions); then run every rule; sort issues by severity, then `ruleId`, then `target` for stable output; compute `valid`. Idempotent and side-effect free. Budget: 200 nodes / 600 edges in under 200 ms on CI hardware (benchmark test with a generous 5x slack).
5. Rule discovery: files `packages/domain/src/wfrt/validation/rules/<ruleId>.rule.ts` exporting `default rule`; generated barrel `rules.generated.ts`; node-specific rules are returned by `NodeTypeDefinition.staticRules` and included automatically. Rule ids unique (registry test); messageKeys must exist in `locales/en/workflow.json` (key lint, ARCH011).
6. `port:ReferenceCatalog` (consumer-side): `lookup(refs: { agents: AgentId[]; skills: SkillId[]; models: ModelRef[]; workspaceId }): Promise<Result<ReferenceSnapshot, AppError>>`. Implemented by AGENT, SKILL and PROV adapters (composed in a small aggregator in the composition root).
7. `ValidateWorkflow` use case: `execute({ workflowId?, definition, mode, actor }) -> Result<ValidationReport>`. Steps: size check -> collect references -> `ReferenceCatalog.lookup` (if it fails: report `references.unavailable` as an error in publish/run_start mode, as a warning in edit mode) -> run -> return. Never persists anything (WFRT046/WFRT047 persist reports at publish).
8. Publish gate helper `assertPublishable(report)`: Result error `wfrt.publish_invalid` when `!valid`. A publish with warnings is allowed.
9. Message params are bounded strings (node labels truncated to 60 chars, escaped on display by the UI).
10. The validator version string changes whenever a rule is added or changed (hash of rule ids and a manual `RULESET_VERSION` constant); stored in versions so old versions can be re-validated and compared.

## 6. Design notes

N/A, functionality only. (WFED renders `messageKey` + `params`.)

## 7. Reuse

`NodeRegistry` (WFRT005), definition helpers (WFRT003), `Result`/`AppError` (ARCH003), i18n key lint (ARCH011). Rules reuse `buildGraph` (this task) instead of rebuilding adjacency.

## 8. Architecture and code placement

Domain: `packages/domain/src/wfrt/validation/{rule,context,runner,build-graph}.ts`. Contracts: `packages/contracts/src/workflow/validation/{issue,report}.ts`. Application: port and use case. No I/O in domain. Rules are plain objects (OCP): new rule = new file.

## 9. Security and safety

The validator is the gate that rejects permission-widening configs and unsafe expressions (WFRT014, WFRT017) before a version exists, and is re-run at Run start so a tampered database row cannot slip through (fail closed). A crashing rule invalidates the definition. Hostile definitions (huge, deeply nested) are bounded by the earlier parse limits (WFRT003) and an explicit time budget: if the runner exceeds 2 s it aborts with error `validator.timeout` (uses `Clock` monotonic time injected into context).

## 10. Errors and edge cases

Zero rules registered: runner refuses with `validator.no_rules` (never "valid by default"). A rule returning an issue with unknown severity is converted to `error`. Duplicate issues (same rule + target) are de-duplicated.

## 11. Acceptance criteria

- [ ] Report for a trivially valid definition (Start -> End) is `valid: true`.
- [ ] Crashing rule yields `valid: false` and names the rule.
- [ ] Output ordering is stable across runs and independent of node order in the file.
- [ ] 100-issue truncation works and sets `truncated`.
- [ ] Use case handles `ReferenceCatalog` failure per mode.
- [ ] Performance benchmark test passes.

## 12. Test plan

Unit: `runner.test.ts`, `build-graph.test.ts`, `validate-workflow.usecase.test.ts` (fake `ReferenceCatalog`), registry test for rule ids and message keys, benchmark. Command `pnpm vitest run packages/domain/src/wfrt/validation packages/application/src/wfrt/validate-workflow`.

## 13. Parallelization notes

After this merges, WFRT011 to WFRT014 and all node tasks add rule files in parallel. Hotspot: `rules/index.ts` is generated, never hand-edited.

## 14. Open questions and assumptions

- ASSUMPTION: warnings never block publish; the editor shows them.
- ASSUMPTION: the editor calls validation on a debounce (WFED) through the route of WFRT047; the same use case.

