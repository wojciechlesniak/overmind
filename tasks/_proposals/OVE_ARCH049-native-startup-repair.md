# ARCH049: defer unused compiler loading during native verification

The integrator applies this finite correction to the completed ARCH049 registry
in its separate approved integration worktree, under the Owner's 2026-10-23
instruction to decide routine MVP repairs and fix actual failing checks.
CONVENTIONS section 5 requires differently owned changes to be proposed; this
proposal fixes the exact integration boundary without editing any author's task
worktree, claim, lifecycle status or acceptance criteria.

Actual DEVELOP 8dce606 retained 117 passed and three failed native cases. All
failures were original 5000 ms documentation integration deadlines. The earlier
PR head passed all 120 cases; that does not supersede this failed DEVELOP run.
The original two documentation files reproduced a local failure: seven passed,
one inherited-selection case took 6863 ms and exceeded its unchanged deadline.
A direct production-module probe measured 693 ms and confirmed that merely
importing the registry loaded TypeScript even when no candidate needs parsing.
This is measured unnecessary work, not proof of the sole timeout cause.
The diagnostic wrapper remains failed: its later run-module import invoked the
actual docs CLI and returned a table instead of the expected import-only JSON.
The earlier registry sample is retained as partial evidence, not a passed probe.

The exact repair is limited to these paths:

- `tools/docs-check/plugin-registry.ts`: replace the eager compiler import with
  one literal import before nonempty candidate admission. An empty inventory does
  not need compilation. Every candidate retains the exact transpilation options,
  syntax diagnostics and fail-closed behavior, with invocation-local reuse.
- `tools/docs-check/plugin-registry-startup.int.test.ts`: append fresh-process
  regressions for empty, valid and malformed tracked inventories. Inspect actual
  compiler loading and actual syntax admission, without executing plugin source.
- This proposal records the bounded allocation and retained evidence.

The existing registry and public CLI tests, fixtures, worker count, 5000/10000 ms
budgets, retry0, all path/UTF8/size/race checks and original 120-case inventory
remain unchanged. No dependency, license, policy, CI configuration or product API
changes are included. Shared paths have no concurrent writer. No additional
runtime capability, physical isolation proof or task acceptance is granted.

Run the new regression RED before changing production code. Then run it GREEN,
all original registry/docs cases, required types/lint/unit/security/dependency/
license/audit/SBOM/build checks and independent whole Standards/Spec review.
The new exact PR head and actual merged DEVELOP must each pass the complete
native integration job and existing hosted gates. Retain every failed run;
remaining failures require further diagnosis rather than a relaxed test.

## Measured verification checkpoint

At source checkpoint `fc9b80b`, the new fresh-process tests first failed all
three cases on the unchanged eager import. After the correction, the original
33 registry cases and all 11 documentation integration cases passed. In the
updated focused run, both inherited-parent cases completed below two seconds;
the unchanged 5000 ms parent and 10000 ms child limits remained in force.

Reproduce the affected existing cases with:

```bash
pnpm exec vitest run --config vitest.int.config.ts tools/docs-check/git-environment.int.test.ts tools/docs-check/registry.int.test.ts
```

The ordinary publication hooks passed full typecheck, lint and 1467 unit tests
in 122 files. Eleven applicable local checks passed: task-index generation,
dependency and license policies, production-high/all-critical audits, implemented
architecture, history/tree secrets, SBOM, build and documentation. Production
audit reported no known vulnerabilities; the full audit retained one allowed
low finding and both secret scans retained their existing Keychain warning.

Whole Standards and Spec reviews each reported zero findings at that source
checkpoint. This evidence update changes no production or test bytes. Initial
PR creation/label events produced superseded cancelled workflows; those remain
cancelled and are not reported as test passes. The final head still requires
fresh whole reviews and every real hosted gate, including all 123 native cases
in 30 files. No full-suite resolution, sole cause or task completion is claimed.
