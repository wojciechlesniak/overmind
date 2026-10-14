---
id: OVE_WFRT056
title: "Implement the Quality Gate node (evidence-based pass or fail)"
area: WFRT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH014, OVE_DATA018, OVE_DATA019, OVE_WFRT004, OVE_WFRT005, OVE_WFRT006, OVE_WFRT009, OVE_WFRT010, OVE_WFRT016]
soft_depends_on: []
provides: ["node:quality_gate", "lib:evidence-catalog-registry"]
needs: ["lib:node-registry", "contract:NodeHandler", "lib:port-schema-validator", "port:ArtifactRepository", "port:ProcessRunner"]
owns: ["packages/workflow-runtime/src/nodes/quality-gate/**", "packages/contracts/src/nodes/quality-gate/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16"]
adr_refs: [2, 15, 26]
---

# OVE_WFRT056: Implement the Quality Gate node (evidence-based pass or fail)

## 1. Summary

Implements the `quality_gate` node: it passes a token to `pass` or `fail` only when real evidence (test results, build, lint, diff, artifact) satisfies the configured checks. Agent claims of success are never evidence.

## 2. Context

The Owner requires real evidence for quality (SPEC 19.5, ADR 0026, CONVENTIONS section 7). The gate is a diamond in the editor (`ui:QualityGate`, OVE_DS091, OVE_WFED076). Evidence kinds are registered in an evidence catalog served by OVE_WFRT048.

## 3. Scope (in)

- Node type `quality_gate` with ports `in`, `pass`, `fail`.
- Config: `checks: [{ kind, params, required }]` where `kind` comes from the evidence catalog.
- Evidence catalog registry (`lib:evidence-catalog-registry`) with MVP kinds `tests`, `build`, `lint`, `diff_nonempty`, `artifact_exists`.
- Gate decision recorded with the evidence ids; evaluation is deterministic.

## 4. Out of scope

- Review by an Agent: OVE_WFRT055.
- Running the commands inside the sandbox: the Agent or a dedicated node produces the evidence artifacts; the gate reads them.
- Editor UI: OVE_WFED076.

## 5. Detailed requirements

1. A check passes only if a matching evidence Artifact exists, was produced during this Run by the platform (provenance recorded by OVE_DATA018) and satisfies its parameters (for example `exitCode == 0`, `failed == 0`).
2. Evidence supplied by an Agent as plain text is rejected; only Artifacts with provenance `platform` or `sandbox-exec` count.
3. Conditions on evidence fields use the safe expression evaluator (OVE_WFRT016), never `eval`.
4. `required: false` checks are reported but do not decide `pass`.
5. Missing evidence = `fail` with reason `evidence_missing`, not a silent pass; stale evidence (older than the last change in the same Run) = `fail` with `evidence_stale`.
6. The decision event `run.gate.evaluated` (OVE_WFRT009) lists each check, verdict and artifact ids; the gate has no side effects.
7. Evidence kind registry is an extension point: new kinds are added by registering, not by editing this node.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `NodeTypeDefinition`, `NodeHandler` (OVE_WFRT005), `PortSchema` validator (OVE_WFRT004), safe expression evaluator (OVE_WFRT016), static validation rule extension point (OVE_WFRT010), editor shape in OVE_DS091/OVE_WFED076.

## 8. Architecture and code placement

Layer: workflow-runtime node handler (depends on `application` ports and `contracts`). One module per node type exporting a `NodeTypeDefinition` and a `NodeHandler`; the registry discovers it (OCP). No I/O except through ports.

## 9. Security and safety

- Forged evidence is the main abuse case: provenance is checked, and the Artifact content hash must match the stored blob (OVE_DATA019).
- Evidence content is data; it never changes policies or the gate config.
- Fail closed: any error while reading evidence results in `fail`.

## 10. Errors and edge cases

- Artifact blob missing or corrupt -> `fail` with `evidence_unreadable`.
- Unknown evidence kind in config -> static validation error.
- Gate reached with no checks configured -> validation error (a gate must have at least one required check).

## 11. Acceptance criteria

- [ ] Given an Agent message saying tests pass but no test artifact, then `fail`.
- [ ] Given a platform-produced test artifact with 0 failures, then `pass`.
- [ ] Given an artifact older than the last diff, then `fail` stale.
- [ ] Given a new registered kind, then it is accepted by validation without code changes in the node.

## 12. Test plan

- Unit tests with fake artifact repository; forged-evidence negative tests; table-driven condition tests. `pnpm --filter @overmind/workflow-runtime test`.

## 13. Parallelization notes

Parallel with other node type tasks; each node type is a self-contained module registered through the node registry extension point (OVE_WFRT005); no shared switch statement is edited.

## 14. Open questions and assumptions

- Evidence rules follow the Owner's principle that agent state is a hint, not proof (ADR 0026).
