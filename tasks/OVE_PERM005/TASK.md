---
id: OVE_PERM005
title: Compose Effective Permissions from the five layers with an exhaustive property-based suite
area: PERM
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_PERM001, OVE_PERM003, OVE_PERM004]
soft_depends_on: []
provides: ["lib:effective-permissions", "contract:EffectivePermissions", "lib:perm-arbitraries", "lib:perm-property-suite"]
needs: []
owns: ["packages/domain/src/perm/effective/**", "packages/contracts/src/perm/effective-permissions.ts", "packages/testing/src/perm/arbitraries.ts", "packages/testing/src/perm/property-suite.ts"]
reads: ["packages/domain/src/perm/intersection/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.10", "SPECIFICATION 16.14"]
adr_refs: [3, 21]
---

# OVE_PERM005: Compose Effective Permissions from the five layers

## 1. Summary

`computeEffectivePermissions(layers)` takes the five policy layers (Owner, Workspace, Agent, Workflow, Tool) plus Run grants and returns the single `EffectivePermissions` value that every access check, every mount plan and every UI explanation uses. The task also delivers the exhaustive property-based suite that proves the headline guarantee: delegation can only narrow, never widen.

## 2. Context

SPEC 11 and ADR 0003: Effective Permissions are the intersection of the Owner, Workspace, Agent, Workflow and Tool policies; delegating a task (Chief to Team Lead to Agent, a Node overriding the model) can only narrow rights. Acceptance criterion 10 of SPEC 16: no Agent and no Telegram message widens permissions. Visibility must have no influence (ADR 0028).

## 3. Scope (in)

- `EffectivePermissions` contract (resolved, canonical, no `inherit`, no layer-private details beyond refs).
- `computeEffectivePermissions({ owner, workspace, agent, workflow, tool, runGrants })`, pure.
- `explainEffective(effective)` returning, per directory and capability, which layers constrained it (data for the UI "why can't I?").
- `isNarrowerOrEqual(a,b)` for whole values; `permissionsHash(effective)` (stable SHA-256 over a canonical JSON, injected `hash` function).
- Property-based suite and shared arbitraries (fast-check) exported for reuse by PERM007, PERM017 and the abuse suite.

## 4. Out of scope

Evaluating a concrete action (`OVE_PERM007`), loading policies from storage (`OVE_PERM010`), Run grants lifecycle (`OVE_PERM016`), mounts (`OVE_PERM017`).

## 5. Detailed requirements

1. **Shape**
   ```ts
   EffectivePermissions = { directories: DirectoryGrant[], capabilities: ResolvedCapabilities,
     layers: { scope: Layer, policyId: EntityId<'pol'>|null, version: number|null }[],  // which policies produced it
     runGrants: { id: EntityId<'rgr'>, path: CanonicalPath, rights: RightSet }[],       // only already-applied grants
     hash: string /* sha256 hex of directories+capabilities+layers */, computedAt: IsoDateTime }
   ```
2. **Inputs.** Each layer may be `absent` (no policy row). Rules: the **Workspace** layer absent means deny-all (empty directories); the **Owner** layer absent means "unrestricted, no ceilings" (identity) because the Owner policy is a ceiling, not a grantor; Agent/Workflow/Tool layers absent mean identity. An *unreadable* layer (error from the repository) is NOT absent: the composer receives `Result` per layer and any `Err` makes the whole result `Err(perm.policy_unreadable)` (fail closed).
3. **Algorithm.** `directories = intersectDirectories([owner, workspace, agent, workflow, tool])` then `capabilities = intersectCapabilities([...])` (PERM003/004). Run grants are added **after** the intersection. A Run grant is the Owner's own run-scoped decision on a path outside the Workspace list, so it is unioned in as `{ path, rights }` but is then **re-intersected with the Owner, Agent, Workflow and Tool layers** (a grant can never exceed an Agent's `maxRights` or the Tool's allowed set). Grants never alter capabilities.
4. **Deny by default:** no Workspace list entries and no grants gives `directories: []`. All capabilities still `inherit` after folding become denied (PERM004).
5. **Order independence and idempotence** as properties (below). Recomputing with the same inputs yields the same `hash`.
6. **Explainability:** `explainEffective` returns for each denied right of a requested path the first layer that removed it (deterministic order Owner, Workspace, Agent, Workflow, Tool) with a reason code consumed by PERM007 (`limited_by_layer`).
7. **Never reads time or ids**; `computedAt` comes from an injected `Clock` value passed as an argument.
8. **Property suite (`property-suite.ts`)**, each property runs 1000 cases in CI, 20000 in the nightly job, with seeds printed on failure and a regression corpus file `packages/domain/src/perm/effective/regressions.json` of shrunk counterexamples that must never fail again:
   - P1 Soundness: every output directory entry and capability is allowed by every present layer.
   - P2 Narrowing: for any layers L and any additional or replaced Agent/Workflow/Tool layer X, `effective(L+X) ⊆ effective(L)` (directories by path-rights coverage, capabilities by `isNarrowerOrEqual`).
   - P3 Delegation chain: for a chain Chief policy ⊇ Team Lead ⊇ Agent (each generated as a narrowing of the previous), the effective set is monotonically non-increasing.
   - P4 Commutativity of the five layers (any permutation of Agent/Workflow/Tool gives the same result; Owner/Workspace swapped gives the same result as well since the algebra is symmetric).
   - P5 Idempotence: adding a layer equal to an existing one changes nothing.
   - P6 Bottom: any empty Workspace list and no grants gives no directories whatever the other layers are.
   - P7 No widening by grants: with an Agent `maxRights=[read]`, a Run grant with `[read,write]` yields at most `[read]`.
   - P8 Visibility independence: the composer's signature has no visibility input (compile-time test using a type-level assertion) and a fuzz test over entities with random visibility proves equal hashes.
   - P9 Determinism: shuffling array inputs does not change the hash.
   - P10 Fail closed: any layer `Err` yields `Err`, never a partial result.
9. Shared arbitraries: `arbPath`, `arbRights`, `arbDirectoryLayer`, `arbCapabilityLayer`, `arbPolicyLayers`, `arbNarrowing(layer)` (produces a layer that is a deliberate narrowing of the input), `arbWidening(layer)` (negative control, used to prove the property detectors can fail: the suite includes a **mutation sanity test** that swaps the intersection for a union and asserts P1/P2 then fail).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

PERM003 and PERM004 algebras, `PermissionPolicy` types (PERM001), `fast-check` (already a test dependency, ARCH/TEST docs; if not yet in `docs/dependencies.md`, justify there), `FakeClock` for `computedAt`.

## 8. Architecture and code placement

Domain only: `packages/domain/src/perm/effective/{compute.ts,explain.ts,hash.ts,narrower.ts}`; contract in `packages/contracts/src/perm/effective-permissions.ts`; test support in `packages/testing/src/perm/`. No ports are used here (loading is PERM010).

## 9. Security and safety

This is SR-02 and acceptance criterion 10 encoded as code. Controls: (1) fail closed on layer errors; (2) grants cannot bypass layer ceilings; (3) the mutation sanity test proves the suite can fail; (4) counterexample corpus protects regressions; (5) the composer has no parameter that could carry an Agent-supplied policy (types accept only repository-sourced layers, and PERM010 is the only caller in production, enforced by a boundary test that greps the import graph).

## 10. Errors and edge cases

- Owner layer with `maxRights: [read]`, Workspace grants rw: effective read only.
- Tool layer lists a tool not in the Agent's `tools`: intersection empty for that tool (deny).
- Workflow layer absent for ad-hoc direct chats (ADR 0023): identity; documented in the PERM010 task (direct chat uses Owner, Workspace, Agent, Tool layers).
- Grant path equal to a Workspace entry with fewer rights: union takes the larger rights on the path, still capped by the other layers.

## 11. Acceptance criteria

- [ ] P1..P10 exist, pass with 1000 runs in CI, and a documented nightly run uses 20000.
- [ ] Replacing intersection by union in a temporary patch makes P1, P2, P3 fail (mutation sanity test automated in the suite).
- [ ] Given Workspace `{/p rw}`, Agent `maxRights [read]`, Tool absent, then effective is `{/p r}` and `explainEffective` names the Agent layer for the removed `write`.
- [ ] A layer `Err` returns `Err(perm.policy_unreadable)`.
- [ ] `permissionsHash` is identical for permuted inputs and differs when any right changes.
- [ ] The 10 shrunk regression examples from development are committed in `regressions.json` and replayed.

## 12. Test plan

`packages/domain/src/perm/effective/*.test.ts` (examples) and `property.test.ts` (P1..P10, imports `property-suite.ts`). CI command `pnpm vitest run packages/domain/src/perm/effective`; nightly `PERM_PROPERTY_RUNS=20000 pnpm vitest run ... --reporter=junit`. Type-level test with `expectTypeOf` for P8.

## 13. Parallelization notes

Depends on PERM003 and PERM004 being merged (or stubbed). Others (PERM007, PERM017, PERM030) import the arbitraries, so merge the arbitraries early. Hotspot: `packages/testing/src/perm/` is owned here only.

## 14. Open questions and assumptions

- ASSUMPTION: Owner layer absent = identity, since the Owner is the source of permissions; the Owner policy exists to hold global ceilings (for example "never allow `execute` anywhere").
- ASSUMPTION: Run grants are unioned after path intersection but capped by the Agent, Workflow and Tool layers and the Owner layer; they are not capped by the Workspace layer (that is the point of an Access Request).
- Open: whether the Tool layer should be a per-tool intersection computed per call (default) or once per Run (cheaper). Default: per call, cached by (policy versions, toolId) in PERM010.
