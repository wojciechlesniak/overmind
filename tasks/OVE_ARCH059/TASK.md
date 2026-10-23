---
id: OVE_ARCH059
title: Implement forbidden builtin import rules
area: ARCH
kind: infra
size: XS
priority: P0
mvp: true
status: in_review
depends_on: ["OVE_ARCH018", "OVE_ARCH019"]
soft_depends_on: []
provides: ["lib:boundary-builtin-rule"]
needs: ["lib:boundary-eslint-resolution", "lib:boundary-structural-rules"]
owns: ["eslint-rules/boundaries/no-forbidden-builtins.ts", "eslint-rules/boundaries/no-forbidden-builtins.test.ts"]
reads: ["tasks/OVE_ARCH020/TASK.md", "tasks/OVE_ARCH018/TASK.md", "tasks/OVE_ARCH019/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH059: Implement forbidden builtin import rules

## 1. Summary

Deliver the builtin RuleModule already required by ARCH020, independently of its ambient alias analysis.
ARCH020 retains every original requirement and final aggregate acceptance.

## 2. Context

The Owner delegated routine MVP coordination. This size-preserving split adds no product behavior.
Canonical policy and import resolution come from merged ARCH018; the shared importRule factory comes from ARCH019.

## 3. Scope (in)

- Implement noForbiddenBuiltins(root) and its exact positive/negative tests in the two owned files.
- Reuse the existing structural import visitor and canonical environment; declare their actual prerequisites.

## 4. Out of scope

- Ambient capabilities, alias propagation and aggregate acceptance: ARCH020.
- Plugin activation, standalone checking and final architectural acceptance: their existing ARCH002 prerequisites and parent.

## 5. Detailed requirements

1. Export noForbiddenBuiltins(root) as a separate RuleModule factory using canonical forbidden capabilities.
2. Reuse ARCH018 resolution and ARCH019 importRule; never copy their policy, parser or import traversal.
3. Normalize bare/node-prefixed/subpath forms including filesystem, spawning, network, threads and randomness.
4. Forbidden builtins report BOUNDARY_FORBIDDEN_BUILTIN; blocked platform packages report BOUNDARY_FORBIDDEN_PACKAGE.
5. Desktop and ui-kit forbid every node:*; Tauri imports pass only in the exact desktop/src/shared/platform/tauri segment subtree.
6. Similar prefixes outside that subtree deny. Keep the canonical test matrix behavior; add no ambient, permission or suppression exemption.
7. Preserve all existing tests and canonical path, regular-file, UTF8, size and malformed-policy failure behavior.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Use ARCH018 canonical environment and capability resolution and ARCH019 public importRule factory.
No new dependency, alternate matrix or duplicate helper is allocated.

## 8. Architecture and code placement

Only the two owned ESLint tooling paths change; product packages never import this tool.
The independent standalone decision remains separate. Do not import ARCH021 as the ESLint oracle.

## 9. Security and safety

Repository text is data. Unavailable or malformed policy fails closed; retain safe diagnostics.
Static analysis never executes project snippets. No secrets, live attack or Owner-specific fixture path is permitted.

## 10. Errors and edge cases

Bare/node-prefixed/subpath imports receive the same canonical decision. Similar platform prefixes cannot grant access.
Unknown policy, unsafe files and malformed inputs deny through the existing prerequisite behavior.

## 11. Acceptance criteria

- [ ] Required bare, node-prefixed and subpath builtins deny with the exact diagnostic ID.
- [ ] Exact Tauri bridge location passes; similarly named and external platform locations deny.
- [ ] Canonical policy and both shared prerequisites are reused without duplicated traversal or exceptions.
- [ ] Real applicable tests/security, independent whole Standards/Spec and exact-head hosted checks pass before ordinary DEVELOP merge.

## 12. Test plan

Run pnpm exec vitest run --project boundary-rules eslint-rules/boundaries/no-forbidden-builtins.test.ts.
Run normal typecheck, lint, full tests and implemented dependency/license/security/build checks.
Retain denied cases and unperformed reserved/physical checks honestly; perform the native claim/finish lifecycle.

## 13. Parallelization notes

Claim only after this definition and both prerequisites are merged and done. One author, one isolated worktree.
The integrator coordinates the preserved older ARCH020 claim; its ambient author never writes these files after the split.
An existing unclaimed WIP may supply source bytes only after a real atomic child claim; it is not accepted evidence.

## 14. Open questions and assumptions

No new behavior or size waiver is approved. Existing ARCH020 history, tests and four original criteria remain intact.
The parent verifies both factories only after this child is merged and done; it is never completed by registration alone.
