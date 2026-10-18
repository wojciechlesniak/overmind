# OVE_ARCH002: register the Owner-approved implementation split

This integrator maintenance change registers 32 smaller prerequisite tasks and narrows
OVE_ARCH002 to final independent acceptance. It implements the Owner decision to split
[issue 36](https://github.com/wojciechlesniak/overmind/issues/36) into smaller tasks and PRs.
It accepts no implementation and grants no size, security, testing or review exception.

## Exact metadata scope

- Copy the 33 independently reviewed TASK definitions byte for byte; their hashes and
  finite ownership/dependency allocation are in [the registration manifest](OVE_ARCH002-task-registration.json).
- Keep all 32 new tasks `todo` with unchecked criteria. Keep OVE_ARCH002 `todo`; do not
  transfer the preserved implementation branch's claim or status history.
- Preserve the parent's detailed requirements and all nine acceptance criteria byte for
  byte. Its only implementation-independent output is `tools/boundaries/ACCEPTANCE.md`.
- Generate `tasks/INDEX.md` and `tasks/DEPENDENCIES.md` with the real merged
  `pnpm gen:task-index` implementation; never hand-edit those views.
- Change no product source, policy, dependency, runtime, hook, lint or CI configuration.

## Delivery and conflict order

The TASK files contain complete API/data shapes, bounds, positive and denied behavior,
acceptance criteria and actual test commands. They do not require a private snapshot to
serve as their specification. The manifest lists every finite `owns` path and all 160
historical primary allocations; a primary allocation is not exclusive ownership.

| Current caller/path                           | Ordered finite writers                  |
| --------------------------------------------- | --------------------------------------- |
| `apps/desktop/scripts/build.int.test.ts`      | OVE_ARCH028 → OVE_ARCH030 → OVE_ARCH031 |
| `apps/desktop/scripts/dev-server.int.test.ts` | OVE_ARCH030 → OVE_ARCH031               |
| `apps/engine/test/process.int.test.ts`        | OVE_ARCH032 → OVE_ARCH033               |
| `apps/desktop/package.json`                   | OVE_ARCH028 → OVE_ARCH029 → OVE_ARCH030 |

Those live callers change before deletion of old paths; later tasks move the already
corrected suites. Every shared-file implementation still requires the exact affected
owner or integrator review. No broad directory ownership or compatibility stub is added.

OVE_ARCH024 preserves the complete proving oracle, all required good cases and all bad
fixtures, with independent removal and weakening checks for all seven rules. Four
four-product Vitest batches preserve old/new dual admission and all environments,
source roots, coverage thresholds and typing. There are 17 existing workspaces (16
products plus Tools); the additional boundary-rule tooling project makes 18 test
projects. OVE_ARCH046/048 require complete scoped native ESLint and public checker
proofs before global activation. OVE_ARCH049/050 provide the static documentation
plugin registry and public CLI; no variable import or omitted plugin is accepted.

OVE_ARCH051 covers the existing five ESLint modules. OVE_ARCH053 atomically activates
the sixth module, both boundary commands, required architecture/aggregate integration,
the fourth sequential hook command and its actual expectation. Removing an activated
checker must fail; the unfinished parent status cannot turn it into a skip.

## Preservation and remaining evidence

Source integrity preflight verified all 40 reviewed artifacts, all 33 TASK hashes, the
unchanged parent requirements/nine criteria, all 160 old implementation states/bytes/
modes, and the primary checkout, index, Owner file and common Git configuration guards.
The old implementation is preserved, not reset, released, replayed or claimed again.
The manifest pins the source receipt hashes and distinguishes these checks from tests.

Before this metadata PR merges, run the actual generator and read-only check, verify
idempotence and the dependency graph with the public task model, then run applicable
formatting, typecheck, lint, tests, architecture and security checks. Require fresh
independent Standards and Spec reviews plus hosted CI for the exact metadata head.
New implementation tasks may be claimed only after registration merges and their hard
dependencies are merged and done. OVE_ARCH016 is the first policy/reader slice.

Historical hook tests still have a real 2/3 failure because the selected offline store
lacked yargs 18.2.0. Moved engine process integration is unrun. No retry, prewarm,
network fallback, skip, threshold reduction or test-budget change is approved here.
OVE_ARCH002 still requires its actual unmerged violating scratch PR, hosted architecture
and ci-success rejection, complete final fixtures and real-repository runtime below
20 seconds. No scaffold PASS or helper completion substitutes for that evidence.

## Candidate inventory

| Task                                  | Hard prerequisites                                                                                                                            | Provided capability               |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| [OVE_ARCH016](../OVE_ARCH016/TASK.md) | OVE_ARCH001, OVE_SETUP003                                                                                                                     | lib:boundary-policy-inputs        |
| [OVE_ARCH017](../OVE_ARCH017/TASK.md) | OVE_ARCH016                                                                                                                                   | lib:boundary-workspace-resolution |
| [OVE_ARCH018](../OVE_ARCH018/TASK.md) | OVE_ARCH017                                                                                                                                   | lib:boundary-eslint-resolution    |
| [OVE_ARCH019](../OVE_ARCH019/TASK.md) | OVE_ARCH018                                                                                                                                   | lib:boundary-structural-rules     |
| [OVE_ARCH020](../OVE_ARCH020/TASK.md) | OVE_ARCH018                                                                                                                                   | lib:boundary-capability-rules     |
| [OVE_ARCH021](../OVE_ARCH021/TASK.md) | OVE_ARCH017                                                                                                                                   | lib:boundary-ts-analysis          |
| [OVE_ARCH022](../OVE_ARCH022/TASK.md) | OVE_ARCH017, OVE_ARCH021                                                                                                                      | lib:boundary-workspace-scanner    |
| [OVE_ARCH023](../OVE_ARCH023/TASK.md) | OVE_ARCH019, OVE_ARCH020, OVE_ARCH022                                                                                                         | lib:boundary-public-tools         |
| [OVE_ARCH024](../OVE_ARCH024/TASK.md) | OVE_ARCH023                                                                                                                                   | lib:boundary-proving-oracle       |
| [OVE_ARCH026](../OVE_ARCH026/TASK.md) | OVE_ARCH016                                                                                                                                   | lib:engine-static-protocol        |
| [OVE_ARCH027](../OVE_ARCH027/TASK.md) | OVE_SETUP017, OVE_OSS004                                                                                                                      | lib:relocated-build-prerequisites |
| [OVE_ARCH028](../OVE_ARCH028/TASK.md) | OVE_ARCH027                                                                                                                                   | lib:desktop-dist-guard-tooling    |
| [OVE_ARCH029](../OVE_ARCH029/TASK.md) | OVE_ARCH027, OVE_ARCH028                                                                                                                      | lib:desktop-tauri-guard-tooling   |
| [OVE_ARCH030](../OVE_ARCH030/TASK.md) | OVE_ARCH027, OVE_ARCH028, OVE_ARCH029                                                                                                         | lib:desktop-vite-tooling          |
| [OVE_ARCH031](../OVE_ARCH031/TASK.md) | OVE_ARCH028, OVE_ARCH029, OVE_ARCH030                                                                                                         | lib:desktop-acceptance-tooling    |
| [OVE_ARCH032](../OVE_ARCH032/TASK.md) | OVE_ARCH026, OVE_ARCH027, OVE_ARCH030                                                                                                         | lib:engine-bundler-tooling        |
| [OVE_ARCH033](../OVE_ARCH033/TASK.md) | OVE_ARCH032                                                                                                                                   | lib:engine-lifecycle-tooling      |
| [OVE_ARCH034](../OVE_ARCH034/TASK.md) | OVE_ARCH032, OVE_ARCH033                                                                                                                      | lib:engine-foundation-markers     |
| [OVE_ARCH035](../OVE_ARCH035/TASK.md) | OVE_ARCH001, OVE_ARCH034                                                                                                                      | lib:telegram-boundary-alignment   |
| [OVE_ARCH036](../OVE_ARCH036/TASK.md) | OVE_SETUP004, OVE_SETUP017, OVE_ARCH018, OVE_ARCH033                                                                                          | lib:vitest-dual-discovery         |
| [OVE_ARCH037](../OVE_ARCH037/TASK.md) | OVE_ARCH036                                                                                                                                   | lib:vitest-relocation-batch-one   |
| [OVE_ARCH039](../OVE_ARCH039/TASK.md) | OVE_ARCH037                                                                                                                                   | lib:vitest-relocation-batch-two   |
| [OVE_ARCH041](../OVE_ARCH041/TASK.md) | OVE_ARCH039                                                                                                                                   | lib:vitest-relocation-batch-three |
| [OVE_ARCH043](../OVE_ARCH043/TASK.md) | OVE_ARCH041                                                                                                                                   | lib:vitest-relocation-batch-four  |
| [OVE_ARCH045](../OVE_ARCH045/TASK.md) | OVE_ARCH043                                                                                                                                   | lib:vitest-static-discovery       |
| [OVE_ARCH046](../OVE_ARCH046/TASK.md) | OVE_ARCH041, OVE_ARCH023                                                                                                                      | lib:pure-timezone-fixtures        |
| [OVE_ARCH048](../OVE_ARCH048/TASK.md) | OVE_ARCH037, OVE_ARCH023                                                                                                                      | lib:dom-boundary-fixture          |
| [OVE_ARCH049](../OVE_ARCH049/TASK.md) | OVE_OSS004                                                                                                                                    | lib:docs-plugin-static-registry   |
| [OVE_ARCH050](../OVE_ARCH050/TASK.md) | OVE_ARCH049                                                                                                                                   | lib:docs-plugin-registry-cli      |
| [OVE_ARCH051](../OVE_ARCH051/TASK.md) | OVE_ARCH023                                                                                                                                   | lib:eslint-static-inventory       |
| [OVE_ARCH052](../OVE_ARCH052/TASK.md) | OVE_ARCH023, OVE_ARCH051                                                                                                                      | lib:boundary-hook-fixture         |
| [OVE_ARCH053](../OVE_ARCH053/TASK.md) | OVE_ARCH024, OVE_ARCH031, OVE_ARCH033, OVE_ARCH034, OVE_ARCH035, OVE_ARCH045, OVE_ARCH046, OVE_ARCH048, OVE_ARCH050, OVE_ARCH051, OVE_ARCH052 | ci:boundary-tools-activated       |
