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
