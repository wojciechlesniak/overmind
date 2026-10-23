# OVE_ARCH020 prerequisite and source partition

Status: approved routine integration plan; registration and child acceptance pending.

The integrator registers OVE_ARCH059 for only `no-forbidden-builtins.ts` and its
matching test, with hard prerequisites OVE_ARCH018 and OVE_ARCH019, the actual
structural-rule capability, and `lib:boundary-builtin-rule` as its provided API.
This records the existing `importRule` prerequisite identified by whole review.

OVE_ARCH020 retains all six requirements and all four acceptance criteria as the
aggregate parent. Its runtime owns become only the globals source/test pair;
it depends on OVE_ARCH018 and OVE_ARCH059 and needs the child capability.
The integrator alone edits task metadata and regenerates native task views.

The current WIP preserves both source pairs and the original claim/history.
It is not source publication, child acceptance or aggregate acceptance.
Publish the parent only after the child is actually merged with its post checks
passing, then rebase so the identical builtin files leave the parent diff.

Keep all original tests, reviews, security gates and measured failures. No
product scope, dependency version, license, policy or size exception is granted.
