# Coordinate the finite engine-marker packaging repair

Registration base: DEVELOP `5737019cd1c5ae5493eeed906eb028df667ec9d7`.
This registration defines OVE_SETUP024; implementation starts only after its
registration and hard dependencies are merged. All acceptance criteria remain
unchecked. The registration adds no runtime behavior or packaging exception.

## Contract and finite ownership coordination

The Owner authorized fixing the test errors through independent tasks. The
integrator accepted this finite contract-preserving repair, and the ARCH036
owner confirmed the single dependency-line coordination below.

SETUP017 section 5 requirement 5 permits the unimplemented startup exit20.
ARCH034 section 5 requirements 1-3 define exact UNIMPLEMENTED markers as absent
hooks, not a live service. The accepted SETUP017 packaging contract still blocks
actual live code until ENGINE supplies isolated startup and bounded stop.
The actual full integration run failed two of 111 tests; a separate normal
packager reproduced the verifier's path-only rejection. Those failures remain
RED evidence and must be fixed and rerun, never relabelled as a passing gate.

OVE_SETUP024's exact implementation owns paths are:

- tools/package-engine/steps/verify.ts
- tools/package-engine/foundationHooks.parse-boundary.ts
- tools/package-engine/foundationHooks.test.ts
- tools/package-engine/foundationHooks.int.test.ts
- docs/engineering/engine-packaging.md
- tasks/OVE_SETUP024/TASK.md

SETUP017's existing packaging/guide ownership is coordinated only for those
exact repair paths. Its done status and every other task's ownership stay intact.
Product marker, CLI, bundler, lock, dependency, CI, capability and policy files
remain read-only. Preserve the existing package-engine Owner review protection
and config-change routing. This proposal grants no live-engine permission.

## Dependency registration

The four hard dependencies OVE_SETUP017, OVE_ARCH016, OVE_ARCH032 and OVE_ARCH034
are done at the registration base. OVE_SETUP024 supplies the unique capability
`lib:engine-foundation-verification`; its needs name those existing providers.
The candidate ID and capability were absent from the base task inventory, and
the read-only remote check found no task/OVE_SETUP024 claim. Normal atomic claim
must still check for a competing claim after registration lands.

In this same metadata registration, append only OVE_SETUP024 to canonical
OVE_ARCH036 depends_on. Keep its existing dependencies in order, status todo,
all five acceptance boxes unchecked and every other field/body byte unchanged.
Add no needs, scope, owns or acceptance claim. Do not edit the active ARCH036
worktree or reset, release or replay its preserved claim.

Regenerate INDEX.md and DEPENDENCIES.md using the implemented task generator;
never hand-edit generated output. Existing task bodies and status metadata are
not normalized as unrelated changes. Registration checks, independent reviews,
exact-head hosted gates and normal DEVELOP integration precede implementation.

## Repair and verification limits

Claim OVE_SETUP024 normally in its own isolated worktree only after registration
lands and the integrator releases implementation. Retain the two actual macOS
packaging/symbolication failures as RED evidence and rerun their unchanged tests.
Use a confined static exact-marker predicate bound to bundled snapshot and current
source bytes. Deny live, malformed, unknown, linked, swapped or mismatched inputs
before executing the packaged engine; prove the guard with real public-packager
sentinels. No reusable static predicate currently exists: do not import the app's
runtime predicate or execute source to classify it.

Preserve all signing, reproducibility, receipt, timing, size, checksum and security
assertions. An explicit packaging live-hook rejection test must be added rather
than inferred from unrelated lifecycle tests. Only a normally finished, reviewed
and gated repair unblocks ARCH036; its full integration suite must then run again.
A live-engine allowance remains a separate product/security decision.
