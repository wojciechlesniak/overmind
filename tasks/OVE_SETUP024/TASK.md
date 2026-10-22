---
id: OVE_SETUP024
title: "Verify inert engine foundation markers without starting live hooks"
area: SETUP
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: ["OVE_SETUP017", "OVE_ARCH016", "OVE_ARCH032", "OVE_ARCH034", "OVE_OSS016"]
soft_depends_on: []
provides: ["lib:engine-foundation-verification"]
needs: ["lib:engine-executable", "lib:boundary-policy-inputs", "lib:engine-bundler-tooling", "lib:engine-foundation-markers"]
owns:
  - tools/package-engine/steps/verify.ts
  - tools/package-engine/foundationHooks.parse-boundary.ts
  - tools/package-engine/foundationHooks.test.ts
  - tools/package-engine/foundationHooks.int.test.ts
  - docs/engineering/engine-packaging.md
  - tasks/OVE_SETUP024/TASK.md
reads: ["tasks/OVE_SETUP017/TASK.md", "tasks/OVE_ARCH016/TASK.md", "tasks/OVE_ARCH032/TASK.md", "tasks/OVE_ARCH034/TASK.md", "tasks/OVE_ARCH036/TASK.md", "tasks/_proposals/OVE_SETUP017-packaging-contract.md", "tools/package-engine/input.parse-boundary.ts", "tools/package-engine/files.ts", "tools/package-engine/context.ts", "tools/package-engine/packaging.int.test.ts", "tools/package-engine/symbolicate.int.test.ts", "tools/build/engine/bundle.mjs", "tools/build/engine/protocol.parse-boundary.ts", "apps/engine/src/cli.ts", "apps/engine/src/compose/index.ts", "apps/engine/src/service/index.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [5, 9, 18, 30]
---

# OVE_SETUP024: Verify inert engine foundation markers without starting live hooks

## 1. Summary

Repair the packaging verifier's rejection of ARCH034's inert foundation markers.
Recognize only the exact marker as bounded source data; every live or unverifiable
hook remains blocked before the packaged engine executes.

## 2. Context

SETUP017 section 5 requirement 5 accepts the unimplemented exit-20 startup receipt.
Its accepted packaging contract defers actual live lifecycle verification until
ENGINE supplies isolated startup and bounded stop. ARCH034 section 5 requirements
1-3 added exact UNIMPLEMENTED=true markers without implementing those hooks.
The existing metafile path-only guard mistakes those markers for live code.

The actual 2026-10-21 full integration run failed two of 111 tests; a separate
normal packager reproduced the stop-contract rejection. Those receipts are RED
evidence, not an exception or a packaging PASS. OVE_ARCH036 remains blocked.

## 3. Scope (in)

- Add the confined static marker check and call it from the existing verify step.
- Bind accepted marker text to the actual bundled source snapshot and current bytes.
- Add focused negative/public-packager tests and clarify the packaging guide.
- Use only the six exact owns paths and normal task lifecycle metadata.

## 4. Out of scope

- Live compose/service implementations or lifecycle permissions: ENGINE tasks.
- New isolated-start/stop contracts, sandbox access or approval exceptions: ENGINE
  and security owners; no such capability is granted by this repair.
- Dependency, runtime, license, signing, size-cap or CI-policy changes: not planned.
- Vitest discovery or ARCH036 implementation/acceptance: OVE_ARCH036.
- Parent boundary-tool acceptance: OVE_ARCH002.

## 5. Detailed requirements

1. Provide assertFoundationHooks(root, inputPaths, sourceMap): void in the owned
   parse-boundary module. Inputs are the existing validated metafile input paths
   and parsed source-map sources/sourcesContent. Throw a fixed safe diagnostic on
   failure; never import or execute engine source/configuration to classify it.
2. Reuse readSource from ARCH016 and the existing TypeScript parser. The pure
   marker predicate MUST accept only one top-level exported const declaration,
   one identifier named UNIMPLEMENTED and literal true. Comments/whitespace may
   surround it. Imports, reexports, extra statements/declarations/exports,
   computed initializers, false values and parse errors MUST NOT be inert markers.
3. Only exact canonical apps/engine/src/compose/index.ts and
   apps/engine/src/service/index.ts may qualify. Every included hook-directory
   input must qualify; unknown, aliased, escaping or additional hook paths deny.
   Preserve the established genuinely absent-hook behavior without treating
   unavailable or malformed analysis as absence.
4. Match each included hook to exactly one canonical source-map identity and
   non-null sourcesContent entry; require its snapshot bytes to equal the safely
   read current source. Missing/duplicate identities, count mismatches and any
   source/snapshot change deny. Classify the bundled snapshot itself as the exact
   inert marker: a post-build source replacement cannot authorize a live bundle.
5. Perform the check before any packaged-engine command, including version.
   Retain canonical regular-file, symlink/hardlink/mount, descriptor identity,
   size and fatal-UTF8 protections. Preserve the existing source-map 16MB limit;
   source reads retain ARCH016's bounded contract. No raw source leaks in errors.
6. Keep signature, fuse/blob, runtime/version/protocol/build identity, checksum,
   system-library, companion, reproducibility and cleanup checks unchanged. Keep
   the 150MB cap and 100MB warning, fresh owner-only data directory, original
   command deadlines, single startup receipt, exit-20 shape and live-PID refusal.
7. Prove denial before execution for actual live/side-effecting hooks, malformed
   markers and unsafe/mismatched snapshots. Rerun the two unchanged real macOS
   packaging/symbolication tests plus the complete required gates. Update the
   guide to distinguish exact inert markers from live hooks without waivers.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Use readSource, existing parsed metafile/source-map contracts, TypeScript and the
normal packaging step/Runner. isUnimplementedHook in engine cli.ts is a semantic
reference only: tooling MUST NOT import apps. No new dependency, second matrix,
permissive parser, dynamic source loader or runtime-hook execution is introduced.

## 8. Architecture and code placement

All implementation is development tooling under tools/package-engine. Product
source and app export shapes remain unchanged. Keep the syntax predicate pure;
confined source reading is the small assertion boundary used by verify.ts.

## 9. Security and safety

Repository text and generated metadata are data, never permission. Deny all
non-exact markers and unavailable checks before executing the packaged engine.
Use unique owned fixtures and harmless execution sentinels; never touch personal
engine data. Preserve redacted diagnostics, output cleanup and every existing
security gate. This change creates no permission to start a live engine.

## 10. Errors and edge cases

Test false/extra/computed/reexported markers, string/comment lookalikes, parse
errors, unknown hook files, missing/duplicate/null/mismatched map entries,
post-build source swaps, symlinks, hardlinks, escapes, non-regular files, invalid
UTF8 and oversize. All deny safely. Genuine baseline failures remain recorded
and stop dependent work; no retries, assertion weakening or budget increases.

## 11. Acceptance criteria

- [ ] Exact inert markers in the actual bundle/current source pass the preflight;
      all live/malformed/unknown or mismatched inputs deny before engine execution.
- [ ] Confined reader and source-snapshot negatives, including swaps and links,
      pass with safe diagnostics and no source execution or private-data access.
- [ ] Both unchanged macOS packaging/symbolication tests pass; the new public
      live-hook sentinel stays absent and original lifecycle/security guards pass.
- [ ] Packaging outputs, signing, reproducibility, receipt/size/checksum rules and
      dependency policies remain unchanged; the guide states the limited behavior.
- [ ] Required full types/lint/unit/integration/security checks and independent
      Standards/Spec reviews pass for exact final heads before normal DEVELOP merge.

## 12. Test plan

- Add foundationHooks.test.ts for the actual assertion boundary and pure syntax
  cases; add foundationHooks.int.test.ts for disposable real public packagers.
- Run pnpm exec vitest run --project tools tools/package-engine/foundationHooks.test.ts.
- Run the actual foundationHooks, packaging and symbolicate integration files
  through vitest.int.config.ts on macOS arm64, retaining original deadlines.
- Run pnpm typecheck and pnpm lint before full pnpm test and pnpm test:int; run
  applicable dependency/license/audit/secret/SBOM and hosted checks unchanged.

These are future executions, not performed evidence. Preserve original failures.

## 13. Parallelization notes

Claim only after registration and all hard dependencies are merged/done on latest
DEVELOP. One task/worktree/branch; existing SETUP017 ownership requires the exact
finite integrator/affected-owner coordination proposal. Do not edit ARCH036's
worktree or the primary checkout. ARCH036 resumes only after this repair is done.

## 14. Open questions and assumptions

The direct Owner-authorized test repair preserves existing contracts; no live
lifecycle expansion is assumed. Registration alone supplies no implementation or
PASS. The actual bundled/current snapshot binding and all denied cases require
real proof; any need for additional paths or policy decisions stops that portion
and goes through a finite proposal.
