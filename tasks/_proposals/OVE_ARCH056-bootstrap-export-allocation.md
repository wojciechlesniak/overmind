# ARCH056 bootstrap export assertion allocation

## Decision and exact scope

The integrator assigns `tools/skeleton.test.ts` to ARCH056 only for the public
application export assertion required by TASK requirement 6. Application must
export exactly `.` to `./src/index.ts` and `./ports` to `./src/ports/index.ts`.
Every other package keeps the exact root-only assertion. No optional export,
file-existence bypass, additional path, package edge or placeholder change is allowed.

This is one shared bootstrap test correction accompanying the already approved
ports implementation. SETUP001 originally established root-only skeleton exports;
ARCH056 explicitly adds the public ports entry while preserving its root placeholder.
Historical completed ARCH030/034/035 allocations remain unchanged.

## Actual failure and verification

The ordinary ARCH056 staging push at source head `9f6da17` failed in pre-push:
typecheck and lint passed; unit tests returned 1521 passed and one failed. The
failure was the old root-only comparison at `tools/skeleton.test.ts:83`.
Boundaries were skipped after that failure; this was not a successful push or gate.

The integrator applies this finite three-path correction privately. It is imported
into the claimed task branch without changing the original claim identity or the
eight approved source/test blobs. The correction is never published separately
without its required ports implementation. Focused bootstrap tests, unchanged
normal hooks, applicable gates, fresh whole Standards/Spec reviews and exact-head
hosted checks must pass before ordinary DEVELOP merge. No acceptance is waived.
