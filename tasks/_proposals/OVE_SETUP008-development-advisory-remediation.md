# Exact development advisory remediation

## Finite integrator allocation

Owner delegated routine free, license-compliant MVP maintenance. Root assigns this
isolated maintenance change exactly pnpm-workspace.yaml, native-generated
pnpm-lock.yaml, docs/dependencies.md and this proposal. SETUP008 is already done;
no task claim, status, product behavior, gate, hook or license exception changes.
Base is DEVELOP a2132c7558c11767f7131a5c99eb2b6a9beb5b6d after ordinary ARCH057 merge.
Source preparation may proceed while its actual post checks finish; later merges
and acceptance still require the strict successful base post checkpoint.

## Exact repair

- happy-dom 21.0.1 to 21.0.4 through the existing direct catalog entry fixes
  [GHSA-834v-8h66-3h79](https://github.com/advisories/GHSA-834v-8h66-3h79).
- Exact selector fast-uri@3.1.8 to 3.1.9 fixes
  [scheme decoding](https://github.com/advisories/GHSA-w74x-v6f9-j3xg),
  [relative normalization](https://github.com/advisories/GHSA-xhq7-xmqj-769h),
  [host canonicalization](https://github.com/advisories/GHSA-wjr9-j795-jxcr) and
  [suffix references](https://github.com/advisories/GHSA-333x-w4r6-6crp).
- Exact selector katex@0.16.47 to 0.18.2 fixes
  [GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7).

All three packages are already development dependencies, retain MIT/BSD-3-Clause,
exceed 72 hours and have unchanged runtime dependency declarations. Registry
metadata shows fast-uri removes four maintainers and adds none; official release
notes record trusted publishing. KaTeX declares prepare:husky, which is not a
permission to execute it. No preinstall/install/postinstall is declared by these
three versions; full graph scripts and licenses must still be checked.

## Compatibility and unchanged controls

KaTeX 0.18.0 prefixes internal CSS classes. There is no repository KaTeX CSS,
class allowlist or bundled renderer. Validate the actual approved markdownlint
and micromark math consumer, heading/link semantics, public rendering, malformed
math and trust denial. Validate real DOM tests with JavaScript evaluation and
external file/network loading disabled, and actual commitlint acceptance/denial.
Do not infer compatibility or safety from package metadata alone.

Keep Node 22.23.3, pnpm 12.11.2, TypeScript 6.0.3 and the Owner-deferred typescript-eslint 8.71.1.
Preserve all workspace importers, pins/integrities unrelated to these three
versions, default-deny dependency builds, 4320-minute age, registry, checksums,
production/development license and audit controls. Generate the lockfile only
with pinned pnpm, then prove a frozen install. No dependency/script/policy exception.

## Required final evidence

Run broad typecheck/lint before the one complete changed-head suite. Keep actual
production and whole-graph audit reports, installed-tree licenses, deps/docs,
build, SBOM and secret checks. Preserve failures rather than retry unchanged
heads until green. Fresh independent whole Standards/Spec, strict exact-head
hosted/native verification and actual post-DEVELOP checks precede acceptance.
A v8 native inventory candidate may change only the lock hash from v7; its other
36 source pins, 30 files and 123 fullNames remain exact. Metadata admission is not
native execution, physical penetration, parent or release acceptance.
