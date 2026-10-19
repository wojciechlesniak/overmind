# OVE_ARCH017 unaliased dependency materialization

## Problem and actual evidence

The installed TypeScript positive case fails on Linux at commit
`3bfabf4864e9f8e07b7c3a52abbe3ed56b4007cb` in
[CI 39236528246](https://github.com/wojciechlesniak/overmind/actions/runs/39236528246),
test shard 2. Its actual `package.json` and `lib/typescript.d.ts` both have two
hard links, while both are regular files on the expected device and the virtual
store is canonical. The strict reader correctly rejects aliased file identities.
Private evidence receipt SHA-256:
`9d6f1109db5b3ce0f10b72f3cab9a8bfb2508026da8866fb9002dad3709e8be1`.

## Exact integrator change

Apply only the reviewed finite patch SHA-256
`33326a621e5442a544220ba4998e89c2cb4652134e4ac3c9d75765a1ae65f1b2`:

- `pnpm-workspace.yaml`: require `packageImportMethod: clone-or-copy`.
- `tools/deps-policy/input.parse-boundary.ts`: validate that exact required literal.
- `tools/deps-policy/run.int.test.ts`: exercise the real public policy CLI, allowing
  the approved literal and denying missing, automatic and hardlink settings.
- `docs/dependencies.md`: explain the unaliased installation requirement.

The patch adds 33 lines across these four shared paths. The integrator applies
these changes; this proposal does not expand task ownership. No dependency pin,
lockfile, release age, license, audit, install-script or reader permission changes.
[The pnpm setting](https://pnpm.io/settings/node-modules#packageimportmethod) uses
cloning when available and copying otherwise, without falling back to hard links.

## Validation and remaining limits

First retain the actual public policy regression failure, then apply the remaining
configuration/schema/documentation changes and run frozen installation and the
same public policy checks. Keep the actual installed dependency positive and both
new real hardlink-denial cases. Preserve all original deadlines and assertions.
Fresh Linux evidence, applicable integration/security checks and independent whole
Standards and Spec reviews remain mandatory. The integrator becomes a coauthor and
cannot provide those final independent reviews. All four task acceptance criteria
remain unchecked; no completion or merge is authorized by this proposal itself.
