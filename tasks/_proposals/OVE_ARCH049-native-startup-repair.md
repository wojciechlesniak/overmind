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
