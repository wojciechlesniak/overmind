# WFRT059: preserve the aggregate coverage canary

## Aggregate canary

The full native run passed 983/984 tests; the existing coverage-denial canary failed.
Its exact diagnostic included the unimported fixture at zero coverage, but 14/15
covered Domain functions (93.33%) passed the unchanged aggregate threshold.

The integrator may change only `tools/vitest-setup/setup.test.ts`: retain the exact
uncovered source, assertions and 25s/30s budgets; add a temporary passing test and
select that test file in the child. All Domain source remains in the same real
coverage include/glob and 90/85 policy. No threshold or per-file override is added.

Final sidecar: `/private/tmp/ove-wfrt059-proposed-aggregate-coverage-canary-v3-20261019.ts`,
SHA256 `8cf3a115df8e6e853011d1e4ddc1606366ad1171432988a548b18546e90379e3`.
The initial sidecar passed six setup cases, then lint required braces around its
new void callback. Both real failures and the first integrated sidecar are retained.
Before SHA256: `b228835ec25f96fbb9933a49fbd15513449801449e0159cc1f7564a65c37bd3e`.
Retain the failed native/minimal runs and exact diagnostic; run the actual canary
and full normal checks after integration. Parser/parent acceptance stays pending.

## Separate ESLint completion diagnostics

The next full run passed 983/984 tests; an existing suppression-CLI completion
assertion failed without exposing its child error. The original isolated case
and one exact synthetic replay passed; the original error remains unclassified.

The integrator may additionally change only `tools/eslint/config.test.ts` to add
bounded name/code/signal/status context to its two existing completion failure
messages. Keep every assertion predicate/value, fixture, case and budget.
Exact sidecar: `/private/tmp/ove-wfrt059-proposed-eslint-completion-diagnostic-20261019.ts`,
SHA256 `7a2b9e057098e13d97ed824814e0d5eb28972d36e5fdcc3a82c8b28b163da76a`.
Before SHA256: `9ca3bdf171cbdf5cc56919fdf547571e6ed0e54ec808754fbb216c0e3a1f210f`.
This diagnostic change is no claimed timing fix. Retain the failed run and perform
one normal full run after integration; do not infer a timeout or environment cause.
