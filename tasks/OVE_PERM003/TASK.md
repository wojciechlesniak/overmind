---
id: OVE_PERM003
title: Implement the directory-set intersection algebra (rights, nesting, ceilings)
area: PERM
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_PERM001, OVE_PERM002]
soft_depends_on: []
provides: ["lib:dir-intersection"]
needs: []
owns: ["packages/domain/src/perm/intersection/directories.ts", "packages/domain/src/perm/intersection/directories.test.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.10"]
adr_refs: [3]
---

# OVE_PERM003: Implement the directory-set intersection algebra

## 1. Summary

A pure function that intersects the directory constraints of several policy layers into one set of `{ path, rights }` entries, with the exact semantics needed for "Effective Permissions = intersection, delegation only narrows". It is the mathematical core of the most security-critical feature, so it is a small task with its own algebraic tests.

## 2. Context

Each layer has a `DirectoryConstraint` (`unrestricted` or `list`) and a `maxRights` ceiling (`PERM001`). Layers: Owner, Workspace, Agent, Workflow, Tool. The Workspace layer is the grantor (it always has a `list`). Agent, Workflow and Tool layers may restrict to a subset of paths or lower the rights; the Owner layer is a global ceiling (mostly `unrestricted` for paths but may carry a global deny of rights). The result must never contain a path or a right that some layer excludes.

## 3. Scope (in)

- `intersectDirectories(layers: DirectoryLayer[]): DirectoryGrant[]`, with `DirectoryLayer = { constraint: DirectoryConstraint, maxRights: RightSet|'inherit', layerRef: LayerRef }` and `DirectoryGrant = { path: CanonicalPath, rights: RightSet, primary: boolean, contributors: LayerRef[] }`.
- Helpers `isAncestorOrEqual(a,b)` (component-wise, uses the `PathGuard` pure compare passed in as a function so the module stays I/O-free), `rightsIntersect`, `applyCeiling`.

## 4. Out of scope

- Capabilities (`OVE_PERM004`), composing all layers and the invariant suite (`OVE_PERM005`), access decisions (`OVE_PERM007`), mounts (`OVE_PERM017`).

## 5. Detailed requirements

1. **Top and Bottom.** `unrestricted` is the identity (Top): it neither adds nor removes paths. `list: []` is Bottom: the result is empty. `maxRights: 'inherit'` is the identity for rights; `maxRights: []` removes all rights (and therefore the entry).
2. **Pairwise rule** for two `list` layers A and B: for every pair (a in A, b in B) whose paths are in an ancestor relation, emit one entry at the **deeper** path with `rights = a.rights ∩ b.rights`. If the path sets are unrelated (neither is an ancestor of the other), nothing is emitted. If `rights` becomes empty, nothing is emitted. Example: A = `{/p rw}`, B = `{/p/src r}` gives `{/p/src r}`; A = `{/p r}`, B = `{/p/src rw}` gives `{/p/src r}` (never wider than either).
3. **N layers** are folded left to right; the fold result must not depend on order (tested as a property). `unrestricted` layers are skipped; if **every** layer is `unrestricted`, the result is empty (deny by default, no grantor).
4. **Ceilings:** after path intersection, every `rights` is intersected with every layer's `maxRights` that is not `'inherit'`. Then `write` or `execute` without `read` after intersection removes the dangling right (re-normalise to a valid `RightSet`; if `read` is gone, drop the entry).
5. **Nested entries inside one layer** (explicit restriction/sub-grant as allowed by PERM002) are resolved by "deepest matching entry wins" for the path being evaluated, **not** by union: a path under `/p/secrets` with entry `{/p/secrets r}` inside `{/p rw}` is read-only for the intersection input. The algorithm therefore first expands each list layer into a function `rightsAt(path)` represented as a sorted set of entries; the pairwise rule then compares **effective rights per path segment** (implementation hint: sweep over the union of entry paths and evaluate `rightsAt` of each layer at each candidate path, keeping entries only where the result differs from the nearest kept ancestor's result).
6. **Primary:** the result's `primary` is true for the entry whose path equals the Workspace layer's primary entry **if** that entry survives; otherwise false for all (the mount plan then chooses; see PERM017).
7. **Output** sorted deterministically, no duplicates, minimal (no redundant child with the same rights as its nearest kept ancestor).
8. **Complexity:** at most 64 entries per layer and 5 layers; worst case must run in under 5 ms; the function is called on every `checkAccess` (cache by layer versions in PERM010, not here).
9. `contributors` lists the layers that constrained the entry (for explanations in the UI: "limited by Agent profile").

## 6. Design notes

N/A, functionality only.

## 7. Reuse

PathGuard's pure comparison (`isWithin`/component compare, SEC002) passed in via a `PathOps` parameter; `RightSet` helpers from PERM001; fast-check generators from `OVE_PERM005`'s arbitraries file (this task may ship a minimal local generator and PERM005 replaces it by import).

## 8. Architecture and code placement

`packages/domain/src/perm/intersection/directories.ts`. Pure TypeScript, no imports from application or adapters. One exported function per concept; no classes needed (KISS).

## 9. Security and safety

A defect that returns a path or right not allowed by some layer is a privilege escalation. Therefore: (1) the property tests of requirement 11 are mandatory and run on every CI build; (2) the function never constructs a `CanonicalPath`, it only reuses values from its inputs, so a path outside all layers cannot appear; (3) on malformed input (non-canonical flag missing, unsorted rights) the function returns an empty result instead of guessing.

## 10. Errors and edge cases

- Layer list empty: empty result.
- Child with wider rights than parent in another layer: wider right dropped by the other layer's ceiling.
- Same path in two layers with `[read]` and `[read,write]`: `[read]`.
- Sibling directories `/a/proj` and `/a/proj2`: unrelated (component-wise compare, not string prefix).
- Case-variant of the same directory on a case-insensitive volume: treated equal by the injected compare.

## 11. Acceptance criteria

- [ ] All examples in requirement 2 produce exactly the stated outputs.
- [ ] Property: for any layers, every output entry is covered by every non-`unrestricted` layer with rights that are a superset of the output rights (soundness).
- [ ] Property: `intersect(L1..Ln)` equals `intersect(permute(L1..Ln))` (commutativity), and adding a layer never grows the result (monotone narrowing).
- [ ] Property: if all layers are `unrestricted` or any layer is an empty list, the result is empty.
- [ ] Sibling-prefix case (`/a/proj` vs `/a/proj2`) yields no overlap.

## 12. Test plan

`directories.test.ts`: the example table (at least 25 rows including nesting, ceilings, siblings, equal paths, Bottom/Top), plus fast-check properties (1000 runs each in CI, 10000 in the nightly job) using generators for trees of up to 6 levels and up to 4 layers. Commands: `pnpm vitest run packages/domain/src/perm/intersection`.

## 13. Parallelization notes

Parallel with PERM004. PERM005 imports this and adds the cross-layer property suite. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: "deepest entry wins" inside a single layer (explicit restriction is honoured) rather than union. This is the more conservative reading.
- Open: should a child grant wider than its parent be allowed in the Workspace layer? Default: yes (explicit sub-grant), flagged with a warning in PERM002.
