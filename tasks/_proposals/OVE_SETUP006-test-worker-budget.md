# Foundation test worker budget

Status: implemented as a routine test-runner scheduling fix under the Owner's
request to finish SETUP006, verify all checks and continue after its approved
foundation acceptance. No acceptance criterion or assertion is relaxed.

The unchanged full suite failed locally with multiple independent CLI/worker
timeouts and an installer still writing during fixture teardown. Read-only process
inspection found no surviving Overmind test processes after the failed run; the
8-core host reported elevated load. Re-running the same 83 tests with only
`--maxWorkers=2` changed passed in 21.33 seconds. The previous automatic worker
budget allowed competing compiler, package-manager and Git subprocesses to
overload the machine; changing all individual timeouts would mask that cause.

Set root `vitest.config.ts` to `maxWorkers: 2`. The CI shard config already extends
that root config. This is a coordinated change to the SETUP004-owned aggregator
for SETUP006's real tooling regressions. Fork isolation, every test, assertions,
coverage thresholds and `retry: 0` remain intact. No hook is bypassed. Validate
using the normal `pnpm test` command and normal push hooks, then full hosted CI.

The cleanup-shell regression also bounds each external child to 10 seconds and
the parent to 25 seconds for its two runs; failures/timeouts still fail assertions.
CLI `--maxWorkers` remains available for deliberate local profiling. Root test
scheduling can be revisited with measured evidence if the suite grows.
