# SETUP011 retained experiment

This branch is evidence, not product code. Never merge or delete it. The original
ten-run benchmark is commit `6b6a9b6a8208a4e6b75669f418a5d04c285d158d`.
`evidence/baseline-measurements.ndjson` preserves its 21 raw records: ten A, one
failed B and ten C. `baseline-summary.json` derives medians and worst values;
throughput's worst value is its minimum. All times use one Apple silicon Mac,
macOS 26.5.1 (25F80), Xcode 26.6 (17F113). RSS uses MiB; executable sizes are bytes.

## Reproduce

Use Node 22.23.3 and pnpm 12.11.2 from the project toolchain, then:

```sh
pnpm install --frozen-lockfile
pnpm --dir spike install --ignore-workspace --frozen-lockfile --ignore-scripts
pnpm exec tsx spike/probe.ts
pnpm exec vitest run spike/adapter.test.ts
pnpm exec tsx spike/build.mjs --candidate A
pnpm exec tsx spike/symbolicate.mjs 0
python3 spike/platform-probe.py
```

The nested package locks better-sqlite3 13.0.3, postject 1.0.0-alpha.6 and esbuild
0.28.2. No installation scripts are enabled. Runtime archives use the project's
checksum-verifying resource downloader and exact archive members. Running the
platform probe creates and removes only its own Documents marker and temporary
LaunchAgents; it never resets privacy permissions or reads existing user files.
The full benchmark defaults to ten runs per candidate; `OVE011_CANDIDATES=A` and
`OVE011_RUNS=1` narrow a reproduction. It writes new results into ignored `dist/`
and does not overwrite retained evidence.

## Recipe phases and limits

- Baseline: esbuild CommonJS for all candidates, absolute SEA main paths, Bun
  compiling the CJS bundle. A maps TypeScript stacks but embeds build paths;
  C maps only to generated CJS. All pre-sign baseline hashes differ.
- Revised Node: relative SEA main/output, canonical virtual map source paths,
  snapshots/code cache disabled, fixed sourceURL. Two builds at the same output
  path have equal hashes; independent-directory equality remains unmeasured.
  Automatic TypeScript mapping fails. The public SourceMap API successfully
  symbolizes a real thrown stack offline using the retained external map.
- Revised Bun: compile TypeScript directly, with inline maps and embedded version.
  A thrown stack maps correctly. No ten-run timing repeat of either revised
  recipe was completed. Platform evidence uses the intermediate relative-main
  recipe, not the final canonical-map binary; see `relative-main-builds.txt`.
- A first version launch once timed out after replacing a previously executed
  file. Fresh-inode replacement and the next build/version check passed. Stale
  kernel signature state is a hypothesis, not a demonstrated root cause.
- B fails loading its ad-hoc addon under library validation (different Team IDs).
  Real same-Team-ID Developer ID loading remains unmeasured. No protection was
  disabled. SQLite extension attempts on A/C failed and are not accepted gates.
- All binaries were ad-hoc signed with hardened runtime and allow-jit only.
  Developer ID, secure timestamp, notarization, quarantined bundle launch and
  actual Tauri bundling were not measured. Those release requirements remain.
- Fresh-process startup follows a version preflight and warm file/trust caches;
  it is not an OS-cold or first Gatekeeper launch measurement.
- Node's LaunchAgent read its own newly created Documents marker. That establishes
  neither access to existing private files nor TCC prompt/attribution behavior.
  B/C's Documents attempts timed out without a result. Probe cleanup completed.

The exploratory time budget was exceeded and then stopped. The documentation
records this deviation and applies TASK.md's conditional default, rather than
presenting incomplete measurements as passing. No new experiment is authorized
by this retained branch. The accepted ADR belongs to the separate docs PR.
