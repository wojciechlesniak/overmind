# OVE_OSS004: make the relocated SEA test independent of warm cache

Status: narrow test-only integration correction approved by the integrator on
2026-10-17; actual single cold-cache RED and GREEN completed. Full canonical
verification and fresh independent reviews remain required for the resulting head.

## Failure and authorized scope

The canonical check on 2a705337 passed 404 unit tests and 56 integration tests, then
failed the relocated source-map integration test. The test called fetchRuntime
inside Vitest, where the existing setup denies network access. A warm archive
hid this dependency; an absent archive exposed it. The original network guard was
working correctly and remains unchanged.

The integrator authorized only preparation inside
`tools/package-engine/symbolicate.int.test.ts`, plus this proposal and task evidence.
No production code, dependency, license decision, hook, configuration or other
owner's documentation is changed.

## Correction

Before the existing fetchRuntime assertion, use the existing NodeRunner/execute
boundary to run the public package-engine CLI in a real subprocess. Invoke the
current pinned Node executable with `--import tsx`, the absolute trusted run.ts,
`--identity -` and an output under the test's unique runtime-preparation directory.
The child has the existing restricted environment, cwd, timeout of 110 seconds and
output cap of four MiB. The existing test timeout remains 120 seconds.

The public CLI applies its existing checksum, notice, quarantine and execution
controls before the test reads the verified archive. The ad-hoc technical build
does not approve runtime licenses or release signing. Vitest itself receives no
network permission. All existing extraction, signing, relocation, failure and
source-map recovery assertions remain, and the test's existing finally block owns
the temporary preparation output.

## Real cold-cache proof

Run exactly:

```bash
corepack pnpm exec vitest run --config vitest.int.config.ts --project '*-int' tools/package-engine/symbolicate.int.test.ts
```

The broader `pnpm test:int -- path` invocation does not select this single file;
it is not used as the minimized proof.

Before each probe, validate the existing archive against node.lock.json, rename it
to a unique backup and assert the active cache path is absent. Afterward, preserve
any newly created archive under another unique name, restore the original archive
and validate its hash, device, inode and size. Nothing is overwritten or deleted.
The integrator's previously preserved probe archive is untouched.

Actual RED before editing: one test failed in 192 ms with the unchanged fetch
network-denial diagnostic. The original archive was restored with identical hash
and inode. Actual GREEN after editing: exactly one test passed in 31.16 seconds
from an absent cache. The new archive and restored original both match the exact
node.lock.json SHA256. A separate receipt retains the concrete preservation paths
outside tracked documentation. No assertion, guard or timeout was weakened.
