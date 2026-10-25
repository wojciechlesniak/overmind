---
id: OVE_ARCH060
title: Provide pure contract authoring metadata for routes, entities and events
area: ARCH
kind: contract
size: S
priority: P0
mvp: true
status: in_progress
depends_on: [OVE_ARCH001, OVE_SETUP002, OVE_ARCH003]
soft_depends_on: []
provides: ["lib:contract-metadata"]
needs: []
owns: ["packages/contracts/src/kernel/meta.ts", "packages/contracts/src/api/define-route.ts"]
reads:
  [
    "tasks/OVE_ARCH008/TASK.md",
    "tasks/OVE_ARCH010/TASK.md",
    "tasks/OVE_ENGINE013/TASK.md",
    "docs/architecture/ARCHITECTURE.md",
  ]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [18, 26]
---

# OVE_ARCH060: Provide pure contract authoring metadata

## 1. Summary

Supply the pure metadata prerequisite from ARCH008 without implementing a partial
generator or event factory. Contract authors define a concept once and preserve
its Zod schema and inferred type for the later generator and ENGINE runtime.

## 2. Context

ARCH008 §5.1 and §13 start with declarative helpers to unblock contract authors.
ARCH010 owns the complete event factory/envelope; ENGINE013 §5.3–6 defines the
existing route audiences and security flags. These are metadata, not authority.

## 3. Scope (in)

- Typed `defineEntity`, `defineRoute` and `defineEventMetadata` descriptors.
- Defensive immutable metadata containers with preserved original Zod schemas.
- Own positive, malformed and denied-path tests; authoring examples in this task.

## 4. Out of scope

- Complete `defineEvent`, envelope, create/is behavior and event bus: ARCH010.
- Discovery/schema export, generator/client types, normalization, compatibility,
  snapshots, versioning, CLI, executable gates and final author guide: ARCH008.
- Permanent generated public barrels: ARCH009. Public seed integration is the
  finite integrator allocation recorded in the registration proposal.
- Gateway transport, policy execution and audit: ENGINE013 and PERM.

## 5. Detailed requirements

1. MUST export `defineEntity<const Name extends string, S extends z.ZodType>(name: Name,
schema: S)` returning `{ schema: S, contractMeta: { kind: 'entity', name: Name, schema: S } }`.
2. MUST export `defineEventMetadata<const Type extends string, S extends z.ZodType>(type: Type,
schema: S, options: { readonly persisted: boolean })` returning
   `{ kind: 'event', type: Type, schema: S, persisted: boolean }`. This helper is
   reused by ARCH010, not exported as a competing or truncated `defineEvent`.
3. MUST export `defineRoute<const T extends RouteDefinition>(input: T)` returning
   `{ contractMeta: T & { readonly kind: 'route' } }`, with copied readonly arrays.
   Preserve literal IDs and `z.infer` through the original schema types. Required
   fields: `id: string`, `method: RouteMethod`, versioned `path: string`,
   `response: z.ZodType`, `errors: readonly string[]`, `scope: readonly RouteAudience[]`,
   `idempotency: 'none'|'key-required'|'natural'`, `summary: string`, `tags: readonly string[]`,
   `stability: 'stable'|'experimental'`. Optional: `request`, `params`, `query`,
   `local: boolean`, `agentBinding: 'own-run'|'own-workspace'`,
   `expandsPermissions: boolean`. Optional schema fields are `z.ZodType`. Export `RouteDefinition`,
   `RouteMethod = 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'|'HEAD'|'OPTIONS'` and
   `RouteAudience = 'owner'|'agent'|'channel:telegram'|'system'`. All definition
   properties are readonly. Schema fields use the already pinned Zod4.
4. MUST accept the existing nonempty unique audience array containing only
   owner/agent/channel:telegram/system. Experimental routes MUST exclude agents.
   Agent binding MUST require agent scope. Permission expansion MUST require
   Owner-only scope and local:true. Recording metadata never grants permissions.
5. MUST validate plain declarative records, reject inherited metadata, accessors,
   symbol/unknown fields, wrong types and unsupported enum values before copying,
   and never invoke accessors on rejected inputs. Errors MUST be fixed sanitized
   registration invariants using ARCH003, never reflect supplied values.
6. MUST copy/freeze wrappers and owned metadata arrays; preserve Zod instance
   identity and behavior without mutating/freezing it. MUST create no import-time
   registry and perform no I/O, clock/random reads, dynamic execution or audit.
7. ASSUMPTION: IDs/names/types maximum120 characters; entity names PascalCase;
   route IDs lowercase dotted/hyphen-separated identifiers. Event types MUST
   preserve ARCH010 §5.2: at least two lowercase snake_case segments joined by
   dots, including `access_request.granted`; no hyphens in event segments. Paths MUST
   start with /v<positive-major>/ and contain no whitespace, controls, query or
   fragment, maximum500. Summary/tag/error entries maximum200; maximum20 tags and
   100 errors. Strings MUST be nonempty. Test each boundary and malformed case.
8. MUST leave strict/bounded wire schema checks, error-catalogue references,
   duplicate units and unsupported wire features to the ARCH008 generator, with
   those limitations explicit. No permissive schema conversion or stripped
   refinements is introduced. Add no dependency or registry global.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Reuse Zod4 and ARCH003 registration invariants. Example:
`const Pause = defineEntity('PauseState', z.object({ paused: z.boolean() }));`
`defineRoute({ ...routeFields, response: Pause.schema });`
ARCH010 uses `defineEventMetadata('run.node.started', schema, { persisted: true })`.
Do not duplicate validators or publish an incomplete event envelope.

## 8. Architecture and code placement

Pure browser-safe contracts only: `src/kernel/meta.ts`, `src/api/define-route.ts`
and own colocated tests. Small typed factory interfaces own one definition and
one defensive validation boundary; no Node, gateway or application dependencies.
The integrator applies additive public seed exports preserving existing exports.

## 9. Security and safety

Metadata is data, never authorization. Deny malformed/unknown metadata and unsafe
scope combinations with sanitized errors. No secrets, paths accessed, dynamic
code, I/O or security decision execution exists here; ENGINE owns enforcement
and audit. Strict wire schema checks remain open in ARCH008, not assumed passed.

## 10. Errors and edge cases

Null/array/prototype/getter/symbol metadata and unknown flags fail before copying.
Mutating caller arrays cannot change a descriptor. Local schema names such as
Date stay ordinary schema contents; these factories do not evaluate payload code.
Two equal descriptors may exist: the later generator detects duplicate exports.

## 11. Acceptance criteria

- [x] All three factories preserve schema identity, inference and literal names.
- [x] Owned metadata is immutable and independent; no Zod freezing or registry.
- [x] Valid scopes/flags pass; every denied combination and malformed shape fails.
- [x] All stated bounds and accessor/symbol non-evaluation have real tests.
- [x] Public seed exports work with existing exports preserved; no deep/barrel workaround.
- [x] Documentation distinguishes metadata from every open ARCH008/ARCH010 gate.

## 12. Test plan

Colocated `meta.test.ts` and `define-route.test.ts`: inference, positive examples,
immutability, strict records, bounds and denied scopes/accessors. Run actual
focused Vitest suites, typecheck, lint, full tests and applicable security checks;
then independent whole Standards/Spec and exact-head hosted/native checks.
Do not present absent generator/boundary tools as passed gates.

## 13. Parallelization notes

ARCH008's remaining generator work is disjoint after this prerequisite merges.
ARCH010 retains its existing ARCH008 hard dependency; this first registration
does not unblock its generator/registry-dependent final acceptance. Own tests only; propose shared changes under tasks/_proposals.

## 14. Open questions and assumptions

The limits in requirement7 are explicit metadata defaults, not payload changes.
All original ARCH008 requirements and acceptance remain in the parent; merging
this task cannot complete the parent, event factory or release acceptance.
