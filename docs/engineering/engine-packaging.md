# Engine sidecar packaging

`pnpm package:engine` builds the Node SEA sidecar selected by
[ADR 0030](../adr/0030-engine-packaging-and-sqlite-driver.md). It uses the official
Node 22.23.3 darwin-arm64 runtime, esbuild 0.28.2 and locally installed postject
1.0.0-alpha.6. It does not fetch tools through npx, enable install scripts or
introduce a native SQLite addon.

## Commands and outputs

Run on macOS arm64 with the repository's pinned Node, pnpm and Rust toolchains:

```sh
pnpm install --frozen-lockfile
pnpm package:engine --identity - --check-reproducible
```

Options are `--identity <name|->`, `--entitlements <plist>`, `--out <directory>`,
`--skip-sign`, `--check-reproducible` and `--release`. Identity defaults to
`OVERMIND_SIGN_IDENTITY` or `-`. Output directories are confined to canonical,
owned directories on the repository volume; symlinks and tracked outputs are
refused. `--skip-sign` requires an explicit diagnostic output directory, rejects
release/normal Tauri publication and produces `overmind-engine.diagnostic.json`
instead of a signed manifest. Such an unsigned artifact is not executed or
presented as accepted packaging.

The normal output directory is `apps/desktop/src-tauri/binaries/`:

| Generated file | Deployment |
| --- | --- |
| `overmind-engine-aarch64-apple-darwin` | Tauri externalBin, `Contents/MacOS/overmind-engine` |
| `overmind-engine.manifest.json` | Release/SBOM verification input |
| `overmind-engine.resources/engine.cjs.map` | Exact resource mapping to `Contents/Resources/engine/engine.cjs.map` |
| `overmind-engine.resources/LICENSE` | Exact resource mapping to `Contents/Resources/engine/LICENSE` |

All generated outputs are ignored by Git. Companion manifest paths are relative
to deployed `Contents/Resources`, not to the source output directory. Only the two
named resources are bundled; a glob/directory does not admit additional files.
No `.node` companion is approved. A future addon requires a reviewed manifest
schema/resource/signing change and same-identity signing, not a library-validation
exception.

## Pipeline and failure behavior

The CLI composes small `Step.run(ctx)` implementations; `planSteps` and
`buildManifest` are pure and processes cross the bounded `Runner` interface.

1. Check macOS arm64, Node version, Rust host triple, tool versions, owned paths
   and at least 1 GiB free space. Validate minimal entitlements and the runtime
   license ledger before production work.
2. Run SETUP016's engine bundler and its metafile import guard into a private
   build directory.
3. Download/cache the official archive with the shared checksum verifier; extract
   only the exact `bin/node` and `LICENSE` members to fresh regular files. Refuse
   quarantined downloaded inputs. Verify the notice hash against the ledger.
4. Create a SEA blob using stable relative paths, snapshots/code cache disabled,
   experimental warnings disabled and `execArgvExtension: "none"`. Child build
   processes have a small environment without inherited Node/DYLD injection.
5. Copy the runtime to a fresh inode, remove its signature, confirm that the
   signature load command is absent, and inject with the reviewed SEA fuse and
   `NODE_SEA` Mach-O segment name.
6. Optionally repeat those unsigned steps in an independent directory and compare
   SHA-256. A mismatch fails and reports section sizes; no exception is silently
   accepted. The build has no timestamp inputs and sets SOURCE_DATE_EPOCH.
7. Sign with the hardened runtime. Ad-hoc signing uses `--timestamp=none`; a real
   identity requests a secure timestamp. The entitlement set grants only JIT.
   Disabled library validation, DYLD injection, debugger/get-task-allow and extra
   memory entitlements are rejected in every mode.
8. Verify the strict signature, fuse/blob, size (150 MB maximum, warning over
   100 MB), system-only linked libraries, no undeclared native addon and exact
   version/protocol/build identity. Verify a single bounded startup JSON receipt
   using a fresh owned 0700 `OVERMIND_DATA_DIR` (ARCH005 contract).
9. Publish the executable, resources and sorted timestamp-free manifest. Each
   published file replaces its own output through a fresh temporary file, with
   the manifest published last. An exclusive output lock rejects concurrent
   packagers. Any
   failed step removes the named outputs; build directories are cleaned up.

Before ENGINE lands, the actual `ensure-running` stub returns 20 and creates no
service. The verifier accepts an included foundation hook only at the exact
canonical `apps/engine/src/compose/index.ts` or
`apps/engine/src/service/index.ts` path, containing
only `export const UNIMPLEMENTED = true;` with optional comments and whitespace.
It parses that text as data and never imports it. Every included hook must have
one canonical bundled source-map identity and a non-null snapshot equal to the
confined current source bytes. Missing, duplicate, aliased, changed or unsafe
inputs deny, including a live bundle followed by a source replacement. Genuine
absence remains supported; malformed analysis does not establish absence.
The captured import graph must retain each hook request and its exact canonical
resolved input. Canonical paths are checked through the existing confined path
helpers: a symlink target cannot become an absent hook, even if the symlink is
removed after bundling. Missing or empty import provenance fails closed.

This check runs before any packaged-engine command, including `version`, in
signed and diagnostic modes. A live service/compose input remains refused:
ENGINE must supply safe isolated startup and bounded stop verification before
that future lifecycle is accepted. Packaging does not implement a fake service
or grant permission to start a live one.

The manifest records signed/unsigned/bundle hashes, runtime and build tool
versions, exact deployed resource hashes and input hashes for the archive, Node
lock, pnpm lock, entitlements and runtime license ledger. `runtimeLicenseStatus`
records the binary-only policy decision. SBOM generation adds the actual manifest
as a checksum-identified file component only when it exists, belongs to the
current source commit and matches the binary/resources. Missing artifacts do not
produce placeholder components; malformed/stale/tampered ones fail.

## Runtime provenance and license approval

Node's runtime lock uses official
[SHASUMS256.txt and its detached signature](https://nodejs.org/dist/v22.23.3/).
The recorded darwin-arm64 archive hash is
`23b25245dcfb9af7262f8ff142e9e2e0af025368117329e7a7458a51e5922f53`.
The detached signature was verified with the published Node release fingerprint
`5BE8A3F6C8A5C01D106C0AD820B1A390B168D356` from the
[official release-key repository](https://github.com/nodejs/release-keys), using
an isolated task-local GPG keyring. GPG's unknown owner-trust warning is retained:
the trust anchor here is the independently checked official fingerprint, not a
claim about a personal web of trust.

To update Node, review runtime compatibility and its upstream support first;
update `.nvmrc`, the exact source lock and version-specific validators/tests together. Fetch the versioned official
checksum/signature and releaser key, check its full fingerprint, and run GPG with
an explicit isolated `--homedir`. Verify the archive checksum again through the
shared downloader. Re-review the exact notice bytes, runtime license ledger,
postject compatibility, integration suite and independent-directory hashes.
Changing only a version or replacing a checksum without that review is refused.

The entire unmodified official LICENSE is preserved (145485 bytes, SHA-256
`c738ae413cf561f174e34f6961f8ca458aae2369a73640dda6234c629b98bcc4`).
Node's umbrella MIT license is not a substitute for embedded third-party notices.
The [exact inventory and approved scope](../../tasks/_proposals/OVE_SETUP017-runtime-notices.md)
remain separate from npm/Rust policy. On 2026-10-17 the Owner explicitly approved
only this archive, notice, the two extracted members and seven listed additional
terms. The binary-only ledger records `status: approved` and the dated decision.
A proposed entry or missing approval still blocks production; any changed
version/archive/notice/extraction recipe requires a fresh decision. A manifest file component's
Apache-2.0 label describes first-party metadata, not approval of Node's licenses.

## Source maps and verification evidence

The canonical map uses virtual file URLs rooted at `overmind/source/`; those
identities contain no host paths.
It is shipped beside the app's runtime notices and can symbolicate an available
stack offline:

```sh
pnpm exec tsx tools/package-engine/symbolicate.ts --map <engine.cjs.map> --stack <stack.txt>
```

The offline CLI opens only regular files without following the final symbolic
link or blocking on a named pipe. It reads at most 16 MiB + 1 byte for a map and
1 MiB + 1 byte for a stack, and rejects growth or identity/metadata changes
between opening and finishing the read. It never opens source paths in a map.

Automatic TypeScript stack mapping is not claimed. A real thrown stack from a
signed, relocated SEA fixture recovered the original TypeScript line with this
mechanism. The actual app debug bundle was also built and its sidecar executed
from `Contents/MacOS`; both deployed resource hashes matched the manifest.
Ordinary engine diagnostics remain bounded/redacted; this tooling does not add
unredacted stack logging to product code.

Unit tests cover policy/lock/manifest schemas, malformed inputs, checksum
tampering before downloaded execution, explicit child-environment denial,
timeouts, path denial, step failures, cleanup, conditional SBOM and config guards.
The macOS integration suite builds/signs/runs the real sidecar and verifies two
independent unsigned hashes. It is visibly skipped on other hosts; Linux still
runs the portable unit seams. See the task PR for exact-head results.

Developer ID signing, notarization, Gatekeeper assessment, DMG packaging and
arbitrary-user-file TCC attribution remain SETUP014 gates. Ad-hoc success does
not satisfy them; no `spctl` result is fabricated here.

## Troubleshooting

- Signature removal/injection failure: use a fresh verified runtime copy; never
  inject into an already running/reused inode or disable library validation.
- Quarantined archive/input: refuse it and investigate its provenance. Only
  task-created outputs may have quarantine removed; do not strip user input
  attributes to force execution.
- Unknown/unsupported entitlement: retain JIT only and fix the supplied plist.
- Host triple, checksum, notice or version mismatch: stop and review the pin;
  never fall back to another download, architecture or runtime.
- `No matching IconType`: the reviewed config includes a mechanically derived
  ICNS from the existing PNG; do not replace the application's artwork.
- Missing externalBin after failure: packaging failed closed. Fix that failure
  and rerun before Tauri bundling; do not create an empty executable placeholder.

A stale `.overmind-engine.lock` blocks further publication after an interrupted
process. Confirm its recorded PID no longer owns a build before manually removing
that task output lock; do not delete another running build's lock.
