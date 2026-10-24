# Defer selected task lifecycle handlers at the existing service boundary

## Trigger and allocation

The actual post-DEVELOP run at `7f9bc5ae8e4d2f9287385aaa98aa2e064131948f`
passed 122 of 123 native cases; one ADR public-CLI case exceeded its unchanged
15000 ms budget. That failure remains recorded. Root allocates this bounded
maintenance correction for the completed OVE_SETUP013 task library.

Only `tools/tasks/lib/service.ts`, its new public-seam `index.test.ts` and this
proposal change. There is no task-status, ownership or product-scope change.

## Existing public API and execution context

ADR repository code imports `parseTask` through the public task library barrel.
Its unchanged direct `runCommand` re-export currently loads all mutation handlers.
Keep that exact original function and signature. Remove only its eager imports
of claim, views, release, cleanup and finish. Inside the existing `withTaskLock`
callback, import only the selected handler from a fixed literal sibling path.

Argument parsing and evaluation of `options.root ?? process.cwd()` and
`options.runner ?? createRunner()` stay before the existing first await. This
preserves the mutation context captured at invocation, unlike an additional
async wrapper in the public barrel. Lock acquisition still precedes handler
loading and execution; the original lock finally path still releases the lock.

## Verification and limits

The new test imports the real public barrel and parses the existing OVE_FIX001
fixture while a throwing claim-module factory must remain uncalled. Invalid
mutation arguments must reject as the original TaskToolError before runner or
handler use. Against the original eager graph this is an actual regression RED;
against the selected imports it must pass. A focused orchestration test verifies
synchronous default-context capture, handler loading inside the lock, original
repository/input delegation, result identity and unchanged handler rejection.
Vitest can wrap mock-factory exceptions, so no top-level factory-error identity
is asserted.

This change targets a concrete eager graph; it is not evidence by itself that
the graph caused the observed timeout. Preserve the failed native receipt and
measure actual public CLI behavior before claiming a performance improvement.
The unchanged failing ADR case, types, lint, full unit suite, applicable security
checks, normal hooks, independent whole reviews and hosted/post checks remain
required. All 30 native files, 123 names, fixtures, assertions, deadlines, retry,
worker, CI, dependency and source/control inventory settings remain unchanged.

There is no new dispatcher, runner, daemon, cache, dependency, deep-import bypass,
untrusted module path, permission change or security/release acceptance.
