# OVE_ARCH003 public exports and existing Zod dependency

## Required integration changes

ARCH003 owns the Result, AppError, error catalogue and gateway mapper modules.
Gateway must import the contracts package root; a relative escape or undeclared
subpath would violate ARCH001. The contracts root is an ARCH008 scaffold marker,
and contracts currently has no declared Zod dependency.

The integrator approved these exact shared edits for this task's branch on
2026-10-17 and delegated their application to this task's author:

1. Add `"dependencies": { "zod": "catalog:" }` to
   `packages/contracts/package.json`. Reuse the approved 4.6.6 catalog and existing
   MIT package; value: strict error metadata/details validation; maintenance: one
   existing schema library; alternative: handwritten duplicate validators. Run
   the package manager to regenerate the lockfile; do not hand-edit it.
2. Replace `packages/contracts/src/index.ts`'s placeholder with exports from
   `./kernel/result.ts`, `./kernel/app-error.ts`, `./errors/define-errors.ts`,
   `./errors/registry.ts`, `./errors/index.generated.ts` and
   `./errors/user-message.ts`. This is temporary public wiring; ARCH008/009 will
   replace it with their generated public barrel. No new public subpath is needed.
   The public error response schema and pure safety helpers are exported at this
   root too so the gateway uses no cross-package deep import.
3. Reuse existing `docs/dependencies.md` Zod register entry and add contracts/error
   validation to its usage; pins and license policy remain unchanged.

ARCH003 will provide pure registry assembly and a documented reproducible initial
generation command for `errors/index.generated.ts`. ARCH009 owns permanent
generator discovery and the build command. A registry test independently scans
every `*.errors.ts` and fails on duplicates, stale aggregation or missing entries.
Generated task indexes remain untouched.

The approved scaffold-test integration changes only the contracts branch of
`tools/skeleton.test.ts`: it now asserts the actual public Result/error API.
Every other package retains its existing placeholder guard. The contracts-owned
browser-bundle test compiles the real public entry through the existing Vite
toolchain with unresolved/builtin imports treated as failures.

## Expected-failure convention

CONVENTIONS requires domain, application and workflow-runtime to return typed
errors for expected failures; only programmer errors may throw. ARCH002's current
scope does not supply that rule. Independent review enforces this convention;
any future ESLint rule needs its own approved scope. No lint suppression or
weakened boundary is requested.

## Validation

Frozen install, package typecheck, no-deep-import verification, real browser
bundle, catalogue discovery tests, hostile error serialization tests and the
existing dependency/license/security checks must pass before integration.

## Minimal hook compatibility proposal

The first normal implementation commit exposed an existing hook conflict:
`packages/contracts/src/errors/index.generated.ts` is intentionally excluded by
the repository ESLint configuration, but `lefthook.yml` passes all staged `*.ts`
files explicitly to ESLint with `--max-warnings 0`. ESLint then emits an
ignored-file warning and rejects the commit before checking code.

The integrator approved this exact edit on 2026-10-17 and delegated its
application in this task worktree:

```diff
--- a/lefthook.yml
+++ b/lefthook.yml
@@
-            run: pnpm exec eslint --fix --max-warnings 0 -- {staged_files}
+            run: pnpm exec eslint --fix --no-warn-ignored --max-warnings 0 -- {staged_files}
```

This preserves every configured exclusion and all lint diagnostics for files
that ESLint actually checks. It silences only the ignored-file CLI diagnostic,
which the ordinary repository-wide `pnpm lint` already avoids by using `.`.
Validation must invoke the exact flags on the generated registry and a real
non-ignored source file, then pass normal commit hooks. No secret-policy or
lint-rule change is proposed. Synthetic hostile token values are assembled at
test runtime; the assertions still exercise the identical final token text.

## Review-fix catalogue discovery alignment

The generated seed now exports static catalogue-module descriptors consumed by
the registry assembly. The existing public-root wiring exports that metadata
alongside the runtime registry; this remains inside the approved error-catalogue
surface and adds no dependency.

The registry test reads each area source as data through the existing TypeScript
compiler's AST, compares its literal declarations with the static descriptors
and runtime registry, and retains duplicate-area/code checks. It executes no
variable import, anticipating ARCH002's dynamic-import enforcement without
requesting an exemption. The seed command in the owned error guide regenerates
the same descriptors. A compiler-host overlay appends a unique absent code to an
existing catalogue without replacing existing definitions, then semantically checks the actual
registry test and literal-code assignments. A separate scenario first includes a
legitimate PERM catalogue and its generated descriptor, proving that future area
files remain intact. The probe chooses an absent reason from the source AST and
an absent virtual assertion filename. It accepts additive codes while rejecting
a broad string type; no fixture code is executed.

## Compiler-probe performance proposal

The complete covered unit run at the reviewed checkpoint passed 412 tests and
failed the two semantic compiler probes at 17.2 s and 11.5 s against their unchanged
5 s limit. Scoped covered runs passed narrowly (4.2/3.4 s and 4.2/3.1 s with one
ordinary compiler-test co-worker), so they do not independently reproduce the
original timeout. The full covered run remains the original reproduction.

A tagged covered phase profile measured 305/306 source files, 2.09/1.91 s loading
and parsing source, 1.77/1.21 s diagnostics, and only 17/13 ms preparation.
A cache helps a warm second scenario but leaves the cold first check close to
the limit. Moving compilation to beforeAll would conceal the cold work in a
longer hook and is not proposed.

The integrator approved the following test-only seam and tools/errors placement:

- Add a Node helper and parse boundary under tools/errors/ which invoke the existing
  TypeScript compiler API. It runs through an ordinary bounded subprocess inside
  each current test, including startup and all diagnostics within the unchanged
  5 s test budget. No new hook, test timeout or dependency.
- The helper receives only a bounded, schema-validated virtual-file inventory and
  assertion path; root and real test paths come from the helper location. It
  checks the same actual registry.test.ts, appended
  literal code, existing PERM code and unknown-code denial. Fixture source is
  compiled as data and is never executed.
- Retain the independent real-source AST registry scan and duplicate/stale checks.
  The real test file remains in the semantic program. Product code and coverage
  configuration remain unchanged; no coverage flag or environment setting is
  disabled. The child isolates the third-party compiler from the parent's V8
  instrumentation, following the repository's existing compiler-tool subprocess
  seam. The helper executes no product functions and makes no product coverage
  claim.
- Keep subprocess elapsed time and output bounded, validate its diagnostics
  protocol, and treat worker/protocol failures as test failures. A genuine invalid
  literal/closed-union fixture must still produce TypeScript diagnostics.
- Verify scoped covered timing first, then require the original complete covered
  suite under the same policy. Failure to meet either original budget is not
  accepted as a pass. Do not move tests to integration or alter hosted CI.

The integrator authorized these exact shared tooling paths for ARCH003. The
helper is development tooling and is absent from the contracts production build.
ARCH002's future Node-test migration remains separate; this proposal changes no
architecture rule or production allowance.

## Narrow semantic graph proposal after complete-suite verification

The bounded worker and then native Node startup improved scoped covered timings
(to 2.25/1.78 s for positive probes), but neither candidate passed the original
complete suite: both finished 418/422 with the four semantic probes reaching the
4 s worker limit. The native complete run used exclusive local CPU coordination.
No deadline, coverage gate or acceptance claim was changed.

The remaining coupling is that compiling the actual registry test also compiles
the type graph of TypeScript/Vitest APIs used only by fixture mechanics. Proposed
minimal test-only interface, approved by the integrator on 2026-10-17:

1. Add tools/errors/catalogue-test-tools.mjs as a runtime facade. It statically
   re-exports actual Vitest it/expect and the Node tooling operations below.
   Add catalogue-test-tools.d.mts exposing only the small API actually consumed:
   - scanErrorCatalogues(): readonly { source: string; codes: readonly string[] }[]
   - checkCatalogueExtension(options?: { withExistingPerm?: boolean;
     codeType?: "closed" | "broad" }): readonly number[]
   - it(name, callback), it.each<T>(rows)(name, callback), and the real expect
     matchers toBe/toEqual/toThrow/toContain. Matcher inputs remain unknown.
2. Add tools/errors/catalogue-probes.ts. Move the existing independent source AST
   scanner, absent-reason/filename selection, PERM-present overlay and bounded
   worker caller here. Its public functions use the facade's plain data types;
   its implementation remains fully checked by the normal tools/tests TypeScript
   projects. No stubs replace catalogue implementations or compiler diagnostics.
3. The actual registry.test.ts imports this test-only facade. Preserve all
   runtime source/metadata/code comparisons and duplicate-code/area tests.
   Replace only Vitest's type-assertion syntax with native TypeScript constraints
   in the actual test: ErrorCode extends string, string does not extend ErrorCode,
   and all four core literals extend ErrorCode. The compiler still checks the
   actual test file against actual generated registry + area declarations.
4. The worker still calls every pre-emit diagnostic for that real test and its
   in-memory literal assertions. The shallow declaration boundary removes only
   fixture-tool implementation and framework declarations from this specific
   semantic graph, not the ErrorCode or factory contracts. Genuine closed/broad
   mutations, added-code and existing-PERM checks remain executable regressions.
5. Keep native Node, the 4 s worker/5 s test bounds, protocol/path denial tests,
   current coverage policy and current hosted unit command. No move to another
   job or integration-only check. Require scoped then original full coverage.

This is an explicit module-interface change for test tooling; it is not a
declaration-only replacement of product code. The facade re-exports actual runtime
functions, while native TypeScript constraints carry the semantic contract being
tested. ARCH002's future Node-test relocation can reuse this interface.

The approved implementation also has a tooling-side parity test: runtime exports
must be the identical Vitest/probe functions, the narrow framework signatures
must be supported by the real framework, and both probe declarations must equal
their fully checked implementation signatures. No product type is declared by
the facade. The first verification results follow below; no full gate passed.

### Facade verification and next compiler reuse proposal

The scoped covered run passed all 14 tests in 6.26 s: additive/PERM compilation
took 1.31/1.23 s and closed/broad negative mutations took 1.67/1.33 s. The original
complete covered run still failed: 421/423 tests passed in 35.63 s. Additive/broad
checks passed at 3.64/3.52 s, but PERM/closed reached the unchanged 4 s child limit.
This remains a failed gate. The facade is an improvement, not accepted completion.

The current worker parses configuration, creates a host, loads the source graph
and collects all diagnostics four times in four cold Node processes. The narrowed
graph's exact source count has not yet been profiled; the earlier 305/306 count
belongs to the pre-facade graph and is not evidence for this candidate.

The next proposed change is a bounded batch using the existing worker, rather
than another declaration interface:

- Prepare all four independent overlays (additive, existing PERM, closed union,
  broad string) from the same source snapshot. Send them in one schema-validated
  request under the existing total 262144-byte input and 16384-byte output bounds.
- Inside that one child, parse configuration once and share a compiler host with
  exact-content-versioned source ASTs. Use TypeScript's public semantic diagnostics
  builder with the previous builder, so changed overlays and their dependants
  invalidate correctly. All compiler options remain unchanged; no output or build
  information is written to disk.
- For each scenario collect every pre-emit category. TypeScript's implementation
  calls config, options, syntactic, global, semantic and (when enabled) declaration
  diagnostics. An adapter can pass the real Program to getPreEmitDiagnostics with
  only getSemanticDiagnostics delegated to the public builder's complete semantic
  diagnostics method. This preserves all diagnostics, including unchanged-file
  cached diagnostics; it does not request only affected-file results.
- Keep the real registry.test.ts as a root for every program, actual catalogue and
  factory types, all literal/core/unknown assertions, and independent negative
  mutation results. Revalidate paths and each overlay inventory; reject missing,
  duplicate or malformed scenario results and fail on any worker/protocol error.
- The first existing compiler test performs the entire bounded batch inside its
  unchanged 5 s test / 4 s child deadline. Later tests inspect only the independently
  compiled scenario results from that batch. No beforeAll warm-up, timeout change,
  hidden background work, persistent filesystem cache or separate CI job.
- A scoped phase profile must measure the actual narrowed graph, AST creation and
  per-scenario diagnostics cost. Then require the original complete covered run;
  an improvement that still exceeds either original deadline remains rejected.

The integrator approved this reuse scope on 2026-10-17. The implementation uses
the public createLanguageServiceSourceFile API with the exact source text as its
version, a shared host and successive semantic diagnostics builders. A small
typed adapter delegates only complete semantic diagnostics without mutating the
real Program. Scenarios run closed, broad, additive, then PERM, so valid results
must recover after invalid mutations.

A separate real-worker regression changes the same assertion path through an
invalid assignment, valid source, unknown identifier, and valid source again. It
requires diagnostics 2322, none, 2304, none, guarding both missing and stale
diagnostics. Result parsing rejects incomplete batches, extra keys, nonnumeric
codes and oversized diagnostic inventories. The approved facade and runtime
identity/type parity checks remain in place. Verification of this batch candidate
is pending; the earlier complete-suite failures remain unresolved evidence.

### Batch verification and integration-seam simplification proposal

The strict test-project compiler passed. A scoped covered phase profile measured
279/280 real source files. AST creations were 279, 280, 281 and 284 across the four
programs, with 345 ms total parsing. The first program took 580 ms preparation and
440 ms diagnostics; subsequent program creation took 14/8/31 ms and diagnostics
380/241/259 ms. All four programs finished in 1.97 s inside the worker.

The uninstrumented-source candidate then passed all 19 scoped covered tests in
4.09 s. Its entire batch took 2.63 s in the first test; the independent same-path
invalidation worker took 1.60 s. Temporary profile tags were removed before that
run. However, the original full covered suite again failed: 424/428 passed in
32.74 s. All four compiler assertions reached the 4 s worker limit; the separate
invalidation regression passed in 3.03 s. This candidate is rejected. No timeout,
coverage setting or acceptance criterion has been changed.

Further interfaces or caches solely to fit a cold external compiler into the
unit-test deadline would add complexity without a reliable full-suite result.
The following smaller integration design is proposed for integrator approval:

1. Keep literal/native type constraints, isKnownCode and duplicate area/code
   runtime tests in the actual contracts registry.test.ts. Import real Vitest
   functions and actual factory, catalogue and generated-registry types directly.
   This file remains the semantic root. Move Node filesystem/TypeScript scanner
   mechanics into Tools, following the coordinated ARCH002 test boundary.
2. Put the independent source AST scan and four semantic compiler scenarios into
   tools/errors/catalogue-types.int.test.ts. Compare exact real source inventory,
   descriptors, declared codes and runtime codes independently of generated
   metadata. Retain absent-reason/filename selection, legitimate existing PERM
   preservation, added/core/unknown assignments and independent genuine
   closed/broad negative mutations.
3. Keep only the original small bounded worker catalogue-compiler.ts and its
   schema/path parse boundary. Each integration scenario starts one normal native
   Node child, with the unchanged 4000 ms child / 5000 ms test bounds, original
   compiler options and every getPreEmitDiagnostics result for the actual
   registry.test.ts plus its virtual literal assertion. Fixture source is compiled
   as data, never executed. The six malformed-input/path/protocol checks remain
   unit tests against this real worker, including unique symlink fixtures.
4. Delete the Vitest facade, shallow declarations, parity test, probe API and all
   batch/builder/cache machinery. There is no persistent or shared compiler state
   and no framework substitute. Cache-specific invalidation tests disappear with
   the removed cache; meaningful open-union, PERM, closed/broad and path-denial
   regressions remain. No timeout, coverage or architecture allowance is changed.
5. Add this one step to the existing required test matrix after the covered unit
   command, with name "Check error catalogue integration" and if: matrix.shard == 1:

   pnpm exec vitest run --config vitest.int.config.ts tools/errors/catalogue-types.int.test.ts

   The existing job runs whenever full CI is required. The step has no
   passWithNoTests flag, continue-on-error, extra conditional or allowed-failure
   outcome. A missing test, compiler error or failed assertion fails the test
   matrix, which ci-success already requires. Current hosted CI runs only two
   explicit desktop integration files in build; local test:int alone would lose
   hosted enforcement. No new job or coverage-reset configuration is needed.
6. Add tools/errors/catalogue-ci-gate.test.ts to the ordinary required unit suite.
   A small private validator reads actual workflow YAML and checks this exact
   command/condition, shard 1 availability, absence of allowed-failure flags, full
   CI job condition and test's inclusion in ci-success.needs. It accepts the actual
   workflow, then must reject in-memory mutations removing the command, changing
   its condition to an unreachable shard, allowing failure, or removing the
   required dependency. This is a real negative gate regression, not a text file
   existence assertion. Use existing YAML/Zod dependencies; add no package.
7. Locally require the unchanged complete test:coverage, strict typecheck/lint,
   exact hosted integration command and complete test:int suite. First measure
   the plain-worker integrations against the actual Vitest/registry graph; source
   inspection cannot promise 4 s margin. If these existing bounds still fail,
   stop and report the measurement rather than add another speed-only layer.
   The exact published head must pass hosted CI, both independent reviews and
   security gates. Scoped passes or this proposal do not prove completion.

The integrator approved this exact integration classification, Tools paths,
existing-job CI step and structural negative tests on 2026-10-17. This decision
supersedes the earlier no-relocation, framework-facade and batch/builder
experiments. The relocation and exact CI step are now implemented, while
verification remains pending. The rejected facade, declarations, parity layer,
probe API, batch builder and compiler cache have been removed.

### Additive protection for compiler integration tooling

Existing CODEOWNERS entries cover tools/ci but not tools/errors. The existing
config-integrity protected-files expression likewise omits tools/errors. The
exact proposed additive protection is:

```diff
--- a/.github/CODEOWNERS
+++ b/.github/CODEOWNERS
@@
+# Error catalogue compiler and its required CI regression gate (OVE_ARCH003).
+/tools/errors/ @wojciechlesniak
```

In tools/ci/config-integrity.ts, add `|tools/errors/.*` as one alternative inside
the existing protected-files regular expression. Retain every existing branch
of that expression, all label checks and all protections supplied by SETUP014
or OSS004. This makes later edits to both the compiler and its negative CI gate
require config-change; CODEOWNERS requests the Owner review. These protections
do not grant approval or claim that live repository rulesets enforce it.

The integrator explicitly approved and delegated both additive edits on
2026-10-17; they are now applied. A real Git-diff/configuration-gate regression
checks both catalogue-compiler.ts and catalogue-ci-gate.test.ts: absent approval
must fail, config-change must pass. A similarly named tools/errors-unrelated
path must remain outside the exact protected prefix. Temporary Git fixtures use
the existing isolatedGitEnvironment helper and unique directories. Execution is
still pending the reserved test slot. The workflow edit itself is already
covered by existing CODEOWNERS and config-integrity rules.

The current task base is still 90aad1c. SETUP014's package-engine and OSS004's
later Markdown configuration guards must be retained during the required rebase;
they are not present or claimed as verified in this older-base checkpoint.

### Accepted-seam verification checkpoint

The approved simplified design passed the exact new hosted integration command
(5/5), scoped runtime/path/CI/configuration gates (18/18), the unchanged complete
covered suite (427/427, 71 files, 33.25 s) and complete integration suite (59/59,
13 files, 48.35 s). Full integration's four separate compilers took
1466/1474/1468/1336 ms under actual two-worker Git/build contention, keeping their
4000 ms child / 5000 ms test bounds. Full typecheck and lint passed. After direct
lint-only syntax/nonce/read-loop fixes, strict test typing and the affected
protocol/structural gates passed again (11/11).

This is local evidence for the simplified seam on the current 90aad1c base, not
approval to merge. Required rebase, later guard preservation, security checks,
both fresh independent reviews and exact-head hosted execution remain pending.
