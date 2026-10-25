# ARCH060 additive public seed integration

## Request and ownership

ARCH060 implements the pure metadata prerequisite registered by PR1052, tracked
in issue1053. Its factories and tests are confined to its owned modules. The
public package entry point belongs to ARCH009; the registration proposal permits
a finite integrator allocation to add the exports below while preserving every
existing export. This proposal does not authorize ARCH060 to edit that entry point.

## Exact additive entry point

Append to `packages/contracts/src/index.ts`:

```ts
export { defineEntity, defineEventMetadata } from "./kernel/meta.ts";
export { defineRoute } from "./api/define-route.ts";
export type { RouteDefinition, RouteMethod, RouteAudience } from "./api/define-route.ts";
```

Keep the record/array validation helpers internal to their modules; do not export
them from the public seed. Preserve the existing Result, errors and ID exports.
Add the public-package import acceptance test through the finite integration
allocation, using `@overmind/contracts`, without a deep-import or test barrel.
It must exercise all three factories, literal names/IDs, original schema identity
and inferred types alongside the existing exports. ARCH060 acceptance criterion5
remains open until this wiring and its actual tests are complete.

## Factory contract and remaining gates

`defineEntity` owns a frozen entity descriptor and preserves its original schema.
`defineEventMetadata` owns frozen metadata only; ARCH010 still supplies the full
`defineEvent` factory, event envelope, create/is behavior and event bus.
`defineRoute` owns frozen metadata containers and fresh readonly arrays, preserving
schema instances and literal types. Scope and locality flags describe data; ENGINE
and PERM still enforce authorization, transport and audit.

The factories reject malformed names, enum values, record/array shapes and unsafe
scope combinations using fixed registration-invariant messages. They never invoke
rejected metadata getters or input array iterators. They preserve Zod refinements
and do not convert or freeze schemas, register exports, or perform I/O.

ARCH008 still owns strict/bounded wire schemas, error-catalogue membership,
duplicate-export detection, unsupported wire features, discovery, schema export,
normalization, generator/client types, compatibility, snapshots, versioning, CLI,
executable gates and its final author guide. ARCH009 still owns permanent generated
barrels. This metadata implementation completes none of those remaining gates,
physical isolation evidence, penetration testing of a running application or
release acceptance. All ARCH060 acceptance boxes remain open for exact-head
integration, security checks and independent reviews.
