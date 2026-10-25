# ARCH008: deliver the pure metadata prerequisite first

## Problem and delivery decision

ARCH008 contains a metadata API, inventory/schema export, artifact rendering,
normalization, compatibility analysis, a safe snapshot writer, commands and final
acceptance. Implementing all of these in one PR conflicts with CONVENTIONS §4.
The Owner requests independent parallel work and delegates routine MVP decisions.
This proposal preserves all ten parent requirements and all eight acceptance
criteria. A helper PR cannot complete ARCH008 or claim an executable pipeline.

Register only the first prerequisite, `OVE_ARCH060`, now. The remaining candidate
slices ARCH061–067 in the reviewed preparation remain proposals, not reserved IDs
or claims. Register later slices before implementation; never hand-edit task indexes.

## Finite allocation

- ARCH060 receives `packages/contracts/src/api/define-route.ts` from ARCH008,
  its own tests, and the previously unallocated `src/kernel/meta.ts` and its tests.
- The integrator alone receives the finite additive public-seed update to
  `packages/contracts/src/index.ts`, preserving every existing export. ARCH009
  still owns permanent generated aggregators; no wildcard/deep export is added.
- ARCH008 retains its existing claim, remaining owns, all original detailed
  requirements and all eight original criteria; add ARCH060 as a prerequisite.
- ARCH010 keeps its existing ARCH008 hard dependency and all other metadata/body
  unchanged in this first registration. Its wire validation and generated registry
  requirements still need the later pipeline. ARCH060 supplies only event metadata,
  never another partial public `defineEvent`; any future dependency adjustment must
  preserve all final contract and registry gates explicitly.
- All new task criteria remain unchecked and status `todo` at registration.
  No implementation, review, CI or acceptance evidence is transferred by metadata.

The native index generator must regenerate INDEX and DEPENDENCIES from TASKs;
verify byte idempotence and the actual graph with the shared task model. Scope
and registry edits require independent whole Standards/Spec review and real
checks before ordinary merge. Do not start ARCH060 until its registration and
hard dependencies are merged. Preserve ARCH008's current work as a pinned WIP
handoff; transfer it only after native ARCH060 claim and the allocation merge.

## Metadata API contract

`defineRoute` retains the original required fields and schema inference and exposes
`contractMeta.kind: 'route'`. `defineEntity(name, schema)` exposes `schema` and
`contractMeta.kind: 'entity'`. A separately named `defineEventMetadata(type, schema,
{ persisted })` supplies an event descriptor for ARCH010's complete event factory.
Factories are pure, browser-safe and independent. They copy and freeze containers
that they own, never mutate or freeze Zod instances, and create no import-time
registry. Generator duplicate detection remains a later ARCH008 requirement.

Reuse ENGINE013 §5.3–6 for owner/agent/channel:telegram/system, `local`,
`agentBinding` and `expandsPermissions`. Unknown/empty/duplicate audiences fail;
experimental routes never include agents; permission expansion is Owner-local.
Metadata records this policy, while ENGINE enforces authorization and audit.

ASSUMPTION for bounded authoring metadata: route IDs/entity names/event types
are at most120 characters; versioned route paths at most500; summaries/tags/error
names at most200, with at most20 tags and100 errors. Route IDs use lowercase dotted or hyphen-separated identifiers; entity names
use PascalCase.
Event types instead follow ARCH010 §5.2: at least two dotted lowercase snake_case
segments, including `access_request.granted`; do not reuse the route-ID grammar.
These bounds limit declarative build input, not application payloads. Document
and test them at the factory boundary. Reject accessors, symbols, unexpected
fields and inherited metadata without evaluating accessors. Fail with a fixed
registration invariant message without reflecting supplied values.

Strict request objects, bounded wire strings, unknown error-code references and
unsupported Zod wire features remain mandatory generator gates; metadata helpers
do not claim to implement schema export or those gates. Preserve Zod validation,
including existing safety refinements; do not erase unsupported checks to export.
Use the already pinned Zod4 native converter later; no new dependency is needed.

## Parent acceptance retained

ARCH008 still requires deterministic JSON Schema2020-12/OpenAPI3.1/client outputs,
all exact compatibility rule fixtures, safe major/archive/changelog behavior,
additive-stale rejection, schema/error/duplicate validation, strict and bounded
requests, normalized per-unit snapshots and the complete author guide. Reserved
commands and CI fragments are not executable proof. Final acceptance follows all
prerequisite merges, exact-head tests/security, independent review and hosted CI.

The separate prepared plan records the remaining version/frozen/security-evidence
clarifications. Implement them only with their owning future slice; this first
registration does not silently change snapshot or compatibility behavior.

## Current implementation evidence

The parent worktree contains an uncommitted first `defineRoute` implementation
and its own tests. The initial real run passed35 tests and typecheck, then failed
lint on seven issues. The second run passed36/typecheck but retained one real lint
failure; the corrected third run passed36, typecheck and lint. A separate real
RED probe reproduced four sparse/non-enumerable metadata failures before the
next factory correction; the current run passes40 focused tests, typecheck and
lint. All
failed observations remain preserved. Concurrent WIP changes observed by the
preregistration draft reviewer were outside the pinned draft/proposal inputs;
that expanded WIP guard is honestly false, not implementation acceptance.
No current full/security/independent review, public export or parent completion
is claimed. Do not publish the WIP as a completed ARCH008 implementation.
