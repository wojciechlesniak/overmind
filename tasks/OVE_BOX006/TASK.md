---
id: OVE_BOX006
title: Provision the agent image on the Owner's Mac (local build, digest pin, offline mode)
area: BOX
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH005, OVE_ARCH007, OVE_ARCH010, OVE_ARCH013, OVE_BOX003, OVE_BOX005, OVE_ENGINE016]
soft_depends_on: [OVE_ARCH013]
provides: ["lib:image-provisioner"]
needs: ["port:AtomicFileWriter", "lib:data-dir", "port:Clock", "port:AuditSink", "port:EventBus"]
owns:
  - packages/adapters/sandbox-macos/src/image/**
reads: ["packages/adapters/sandbox-macos/image/pins.json"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16", "SPECIFICATION 18"]
adr_refs: [4, 20, 22]
---

# OVE_BOX006: Provision the agent image on the Owner's Mac (local build, digest pin, offline mode)

## 1. Summary

Make sure the exact, reviewed agent image exists locally before any Environment is created: build it from the shipped definition with the `container` CLI, record its digest, verify the digest before every use, rebuild when the definition changes, and define what happens without internet. Environments are only ever created from `<name>@sha256:<digest>` references.

## 2. Context

`EnvironmentSpec.image` must be pinned by digest (OVE_ARCH012; ESC-080 requires creation from a tag to fail). The image definition lives in the app (OVE_BOX005). The Owner never downloads a prebuilt image from an unreviewed registry; the app builds it locally from a digest-pinned base and lockfile-verified npm tree. The first build downloads a Node base image and npm packages (a few hundred MB) and takes minutes, so progress and offline behaviour matter for the wizard.

## 3. Scope (in)

- `ImageProvisioner` service: `status()`, `ensureImage()`, `verify()`, `prune()`.
- Persistent record `images.json` (atomic write) with input hash, digest, build time, versions.
- Build orchestration with progress events and cancellation.
- Digest verification before every `createEnvironment` (called by BOX008).

## 4. Out of scope

- Writing the Containerfile and pins: OVE_BOX005. Publishing a prebuilt image to a registry: later (open question). Variant images: post-MVP.

## 5. Detailed requirements

1. **Record:** `<dataDir>/sandbox/images.json` via `AtomicFileWriter`, schema `{ schema: 1, images: [{ name: 'overmind-agent', inputHash, digest: 'sha256:<64 hex>', builtAt, imageVersion, claudeVersion, codexVersion, containerVersion, baseDigest }] , current: '<digest>' }`. File mode 0600, directory 0700. Loading validates with zod; a corrupt file is moved aside (`images.json.corrupt-<ts>`) and treated as "no image" (rebuild), never trusted.
2. **Input hash:** computed by `image/build-hash.mjs` from the build context (Containerfile, lockfile, entrypoint, pins) as in BOX005. The shipped app embeds the expected hash at build time (like the herdr hash in SETUP015), so tampering with the shipped context is detected before building.
3. **status():** `'missing' | 'stale' | 'ready' | 'building' | 'error'`; `stale` when the recorded input hash differs from the embedded one; `ready` only if `container image inspect` returns the recorded digest AND the labels of requirement 7 in BOX005 match. Digest drift (inspect returns a different digest for the same name) is `box.image_digest_mismatch` and blocks.
4. **ensureImage({ signal, onProgress }):** serialised by a lock (one build at a time). Steps: preflight health must be `ready` or `degraded` only for `image missing`; check connectivity to the build hosts only if a build is needed (HEAD to the base registry host and registry.npmjs.org through the Owner's normal network; the build runs with the host network, outside any Agent Environment); `container build --tag overmind-agent:<inputHash12> --platform linux/arm64 <context>` with streamed log to `<dataDir>/sandbox/build-<ts>.log` (redacted), after success `image inspect` for the digest, run the smoke test (`image/smoke.sh`) in a throwaway container under production flags, and only then write the record and set `current`. A failed smoke test deletes the image and records `box.image_build_failed` with the failing step.
5. **Offline behaviour:** if the image is `ready`, no network is needed ever. If `missing`/`stale` and the network is unreachable: return `box.offline` (retryable), do not start any Agent that needs the new image; if a previous `ready` digest exists and the stale reason is only an app update that did not change security-relevant inputs (flag `compatible: true` in pins), keep using the previous digest and show a notice; otherwise block. Decision table is in the code and doc.
6. **Pruning:** keep the current and one previous image digest (rollback); `prune()` deletes older images and build logs older than 14 days; never deletes an image referenced by a running Environment.
7. **Progress events:** emit `sandbox.image.progress` (`phase: 'checking'|'pulling-base'|'installing'|'smoke-test'|'recording'`, `percent?`) via `EventBus` for the wizard; no log text in events.
8. **Verification before use:** `verify()` is called by BOX008 right before each `run`; it re-inspects the digest (cheap) and fails closed on any mismatch. The reference given to `run` is always `overmind-agent@sha256:<digest>` built from the record, never from a tag.
9. **Audit:** `sandbox.image_built` (digest, versions, duration), `sandbox.image_verify_failed`.
10. **Cancel and crash:** cancelling kills the build process tree and deletes partial tags; an engine crash mid-build leaves a lock file with pid and timestamp; the next start clears it if the pid is dead and removes partial images labelled `app.overmind.building=true`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ContainerCli.imageBuild/imageInspect/imageDelete` (BOX003), `AtomicFileWriter` (ARCH013), data-dir layout (ARCH005), `ProcessRunner` through ContainerCli, `EventBus` (ARCH010).

## 8. Architecture and code placement

`packages/adapters/sandbox-macos/src/image/{image-provisioner.ts,image-record.ts,build-orchestrator.ts,offline-policy.ts,input-hash.ts}`. `offline-policy.ts` and `image-record.ts` are pure logic. The application only sees a small `ImageGate` interface (`ensure/verify`) consumed by BOX008; no other adapter reads `images.json`.

## 9. Security and safety

The image is the root of trust for agent execution, so: only a digest reference is ever run; the digest is verified against the recorded one at every start; the record file is owner-only and validated; a build that fails the smoke test is never promoted; build logs are redacted; the build uses the host network but no Owner files (context copied to a temp dir, no mounts of home). Remote content (npm packages) is pinned by lockfile integrity; the base by digest. If verification cannot run (CLI error) the Environment is not created.

## 10. Errors and edge cases

- Disk full during build: `box.image_build_failed` with reason `disk`; nothing promoted; user message includes required free space (3 GiB planning figure).
- Two engine processes (developer mistake) building: lock file prevents it.
- Registry rate limit or temporary failure: two automatic retries with backoff, then `box.image_build_failed` retryable.
- App update changes pins: status becomes `stale`; running Environments keep the old image until recreated.
- `container` upgraded and old image digests change representation: re-inspect and re-record after Owner approval via health flow (document), never silently trust.
- Owner manually deletes the image: next `status()` is `missing`.

## 11. Acceptance criteria

- [ ] With no image and network available, `ensureImage` builds, smoke-tests and records a digest; the reference returned is `name@sha256:...`.
- [ ] With a ready image and no network, `ensureImage` succeeds without any network call (fake runner proves no build invoked).
- [ ] With no image and no network it returns `box.offline`.
- [ ] A changed digest for the recorded name makes `verify` fail with `box.image_digest_mismatch`.
- [ ] A smoke-test failure leaves `current` unchanged and deletes the new image.
- [ ] A corrupt `images.json` is moved aside and treated as missing.
- [ ] Concurrent `ensureImage` calls build once.

## 12. Test plan

Unit tests with `FakeProcessRunner` and fixtures (status table, offline policy, input hash, record parsing). Integration on the macOS 26 runner builds the real image once (nightly job, label `needs-container`). Property test: any record mutation leads to `missing` or `error`, never `ready`. Commands: `pnpm vitest run packages/adapters/sandbox-macos/src/image`.

## 13. Parallelization notes

Parallel with BOX004 and BOX007. Wizard progress UI (ONB) consumes the event. Hotspot: `images.json` schema (owned here).

## 14. Open questions and assumptions

- ASSUMPTION: running a local image by digest reference works in `container` 1.5.x (`name@sha256:...`); if not, BOX002/BOX003 findings define the alternative (a unique per-digest tag plus digest comparison before every run), recorded in the ADR.
- Open for the Owner: prebuilt public image on GHCR (faster first run, adds a registry trust decision) versus local build (slower, more reproducible by the Owner). Default: local build.
