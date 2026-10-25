---
id: OVE_DS110
title: Provide private UI-kit utilities with safe URL handling
area: DS
kind: infra
size: S
priority: P0
mvp: true
status: in_progress
depends_on: [OVE_SETUP001, OVE_SETUP002, OVE_SETUP003, OVE_SETUP004, OVE_SETUP008]
soft_depends_on: [OVE_ARCH002]
provides: ["lib:ui-kit-utilities"]
needs: []
owns:
  [
    "packages/ui-kit/src/internal/cx.ts",
    "packages/ui-kit/src/internal/mergeRefs.ts",
    "packages/ui-kit/src/internal/useControllableState.ts",
    "packages/ui-kit/src/internal/useReducedMotion.ts",
    "packages/ui-kit/src/internal/useId.ts",
    "packages/ui-kit/src/internal/safeHref.ts",
    "packages/ui-kit/src/internal/polymorphic.ts",
  ]
reads: ["tasks/OVE_DS001/TASK.md", "tasks/OVE_DS022/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19.7"]
adr_refs: [17, 18]
---

# OVE_DS110: Provide private UI-kit utilities

## 1. Summary

Deliver the reusable utility prerequisite from DS001 without claiming that the
package build, Storybook, accessibility audits or purity guards are complete.

## 2. Context

DS001 sections 5.4 and 5.6 define these helpers before components consume them.
DS022 reuses the same URL filter; it must not implement a second validator.
DS001 retains all original aggregate acceptance criteria.

## 3. Scope (in)

The seven enumerated internal modules and their own colocated behavior and type
tests. These helpers remain private to UI-kit; no public barrel exports them.

## 4. Out of scope

Components, tokens, styles, package or root configuration, dependency adoption,
Storybook/Matrix, accessibility engines, purity scanners and DS001 acceptance.
No new runtime dependency, product capability or personal agent configuration.

## 5. Detailed requirements

1. Provide `cx(...parts: (string | false | null | undefined)[]): string`, preserving
   string order and joining present nonempty class strings with one separator.
2. Provide React ref composition with the cleanup behavior supported by the
   approved React catalog. Preserve callback and object refs, cleanup and detach;
   never retain detached elements. Use React types rather than a second ref model.
3. Provide `useControllableState<T>({ value, defaultValue, onChange })` with a
   stable controlled/uncontrolled contract. `undefined` selects uncontrolled;
   `null` is an ordinary controlled value when included in T. Use current values
   and handlers, and report changes through the specified callback.
4. Development mode changes use only the optional internal sink
   `onModeChange?: (diagnostic: Readonly<{ code: 'CONTROL_MODE_CHANGED';
from: 'controlled' | 'uncontrolled'; to: 'controlled' | 'uncontrolled' }>) => void`.
   Notify once per committed transition in development. Send no values, props,
   errors or secrets. Production and an absent sink produce no diagnostic output.
5. Provide SSR-safe `useReducedMotion()`, defaulting false without a DOM,
   observing `(prefers-reduced-motion: reduce)` and releasing subscriptions on
   unmount. Re-export React `useId`; keep the polymorphic props helper typed to
   the selected element and component props without adding router dependencies.
6. Provide exactly `safeHref(href: string | undefined): string | undefined`.
   Accept http/https/mailto/tel schemes case-insensitively and explicit relative
   prefixes `/`, `./`, `../`, `#`, `?`. Reject unsupported or obfuscated schemes,
   protocol-relative forms, backslash host escapes, empty and malformed inputs.
   Return the validated reference or undefined. Never navigate, fetch or execute
   it. Downstream components own their target/rel and invalid-link presentation.
7. Preserve UI-kit purity: no internal workspace imports, network, filesystem,
   storage, HTML injection, console output or dynamic execution in these modules.
   Follow current React and strict TypeScript settings and the approved catalog.

## 6. Design notes

Small reusable functions and hooks; no registry, service layer or speculative API.
Treat URL input as data and keep link validation in one private module.

## 7. Reuse

React, TypeScript, Vitest and the already approved Happy DOM test environment.
No blocked jsdom/axe graph or license-policy exception is part of this task.

## 8. Architecture and code placement

Only the enumerated `packages/ui-kit/src/internal/` modules and their own tests.
Do not export them from `src/index.ts` or edit any packaging or tooling owner.

## 9. Security and safety

Test hostile URL forms as non-executable strings, including browser parsing
ambiguities. No test may navigate to a supplied URL or invoke untrusted code.
Diagnostics contain only the fixed code and mode transition.

## 10. Errors and edge cases

Cover empty inputs, refs with cleanup, repeated mounts, no-DOM rendering,
subscription removal, stale handlers, controlled null values and actual mode
transitions. Fail safely without hidden side effects or console workarounds.

## 11. Acceptance criteria

- [x] All seven modules preserve the specified types and remain private.
- [x] Ref cleanup, controlled state and motion subscriptions pass real behavior tests.
- [x] Development diagnostics obey the exact value-free sink contract; production is silent.
- [x] The URL abuse table and valid references pass, including backslash/host controls.
- [x] Current broad, full, security and independent whole reviews pass before integration.

## 12. Test plan

Use real React rendering, SSR and cleanup assertions, type inference checks and
the canonical URL abuse table. Run focused tests, broad typecheck/lint before
the full suite, and applicable dependency/license/audit/secret checks. Require
independent whole Standards/Spec review and exact-head hosted/native evidence.
Unavailable future tooling is never reported as passed.

## 13. Parallelization notes

No dependency on DS001: that would create a cycle. DS001 instead depends on this
prerequisite. Existing parent WIP and claim are preserved; after registration,
claim normally and copy only the allocated modules/tests through a clean handoff.
Shared documentation and configuration remain integrator proposals.

## 14. Open questions and assumptions

The optional diagnostic sink is the integrator's concrete interpretation of the
existing development warning under the no-console rule. The DS001 URL signature
is canonical; DS022 consumes it without an alternative protocol-relative option.
This task does not complete any Storybook, scanner, accessibility, parent or
release criterion. Initial claims and draft source are not acceptance evidence.
