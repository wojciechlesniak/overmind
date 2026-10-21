# Keep Vitest helper linting in the test program

Task036 requires excluding `tools/vitest-projects/**` from Tools production TS.
The existing root test program includes both new helpers, but ESLint routes only
configurations and test filenames to that program. The actual full lint run in
`ove036-native1-20261019.json` denied discovery.ts and coverage.ts because neither
belongs to the production project after the required exclusion.

Request the integrator add only these two exact files to the existing typed
`eslint.config.d/zz-vitest.mjs` test-program override: `tools/vitest-projects/discovery.ts`
and `tools/vitest-projects/coverage.ts`. Retain every rule, parser option and existing
pattern; no default project, ignored file or untyped fallback is proposed. Full
lint and types must pass again before suites. Task acceptance remains unchecked.

## Resolution

The integrator applied the two-file typed override in commit
`3d8f17e7fd257aa76fb9864c94e419ff7297709c`. No rules, parser restrictions or
existing patterns were removed. The historical log named above is unavailable
after the interruption and is not current verification. Fresh full format,
typecheck and lint runs passed on 2026-10-21; final acceptance still requires
the independent reviews and exact-head hosted gates in TASK.md.
