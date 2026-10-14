---
id: OVE_BOX005
title: Define the agent base image (Containerfile, pinned CLIs, non-root user, entrypoint)
area: BOX
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOX002, OVE_SETUP015]
soft_depends_on: [OVE_SETUP008, OVE_BOX001]
provides: ["lib:agent-base-image"]
needs: ["lib:herdr-bundle"]
owns:
  - packages/adapters/sandbox-macos/image/**
  - docs/sandbox/base-image.md
reads: ["docs/research/prototyp-wnioski.md", "vendor/herdr/checksums.json"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 11"]
adr_refs: [20, 22, 26, 27]
---

# OVE_BOX005: Define the agent base image (Containerfile, pinned CLIs, non-root user, entrypoint)

## 1. Summary

Specify and implement the contents of the single image all agent Environments run: a Debian-based Node image with `git`, `ripgrep`, `curl`, `socat`, the official `claude` and `codex` CLIs at pinned versions, a non-root user, a read-only-friendly layout and a minimal entrypoint that starts the in-container relays and herdr. The image is described as code (Containerfile plus lockfile) so it can be rebuilt reproducibly and pinned by digest.

## 2. Context

Prototype (research 4B): `docker.io/library/node:22`, CLIs installed with `npm i -g @anthropic-ai/claude-code @openai/codex` at run time, which will not work with a read-only root filesystem and gives unpinned versions. Decisions here: CLIs are baked into the image at pinned versions (prototype: Claude Code 2.1.296, Codex CLI 0.162.1), updated only by a deliberate image bump with tests. The image must work with `/work` as the only writable project location, a tmpfs home, credential volumes mounted under `/creds`, and no network except relays (OVE_BOX012). herdr is not part of the image: the verified bundled binary is mounted read-only (OVE_SETUP015, OVE_BOX020).

## 3. Scope (in)

- `image/Containerfile`, `image/package.json` and `image/package-lock.json` (CLIs and their transitive tree with integrity hashes), `image/entrypoint.sh`, `image/relay.sh`, `image/VERSION`, `image/pins.json`.
- Documentation `docs/sandbox/base-image.md` (contents, update procedure, SBOM expectations).
- A smoke script `image/smoke.sh` checking tools and users inside a built image.

## 4. Out of scope

- Building, storing and verifying the image on the Owner's Mac: OVE_BOX006. Mounting layout at run time: OVE_BOX007/BOX008. Egress allowlist content: OVE_BOX011. Skill content: SKILL area.

## 5. Detailed requirements

1. **Base:** `FROM docker.io/library/node:22-bookworm-slim@sha256:<digest>`; the digest is recorded in `pins.json` (`baseImage`, `digest`, `verifiedOn`). Bump procedure documented. Platform `linux/arm64` only.
2. **Packages (apt, pinned by snapshot date through `apt-get install` of explicit versions or the Debian snapshot mirror documented in the file):** `git`, `ripgrep`, `curl`, `ca-certificates`, `socat`, `jq`, `procps`, `less`, `openssh-client` is NOT installed (no ssh in agent environments unless a later decision adds it), no `sudo`, no compilers by default (build tools are a post-MVP variant image). apt lists removed, `DEBIAN_FRONTEND=noninteractive`.
3. **CLIs:** installed with `npm ci --omit=dev --ignore-scripts=false` only for the two packages from `image/package-lock.json` into `/opt/cli` (outside HOME), binaries linked to `/usr/local/bin/claude` and `/usr/local/bin/codex`. Lockfile integrity hashes verified by npm. The install uses the build-time network; the resulting image needs none at run time. Auto-update is disabled by environment (`DISABLE_AUTOUPDATER=1` for Claude Code; Codex update check disabled via its documented setting recorded in `pins.json` notes) because the root filesystem is read-only.
4. **Users and directories:** user `agent` uid/gid 1000, shell `/bin/bash`, HOME `/home/agent` (mount point for tmpfs at run time), `/work` empty directory owned by 1000 (mount target), `/creds` (mount parent, root-owned 0755), `/run/overmind` (relay sockets, tmpfs at run time), `/opt/overmind` (read-only mounts: herdr, skills, probe). No setuid binaries: the build runs `find / -perm /6000 -type f -exec chmod a-s {} +` and the smoke test asserts none remain. `USER agent` set as default.
5. **Environment baked into the image:** `CLAUDE_CONFIG_DIR=/creds/claude`, `CODEX_HOME=/creds/codex`, `HOME=/home/agent`, `LANG=C.UTF-8`, `TERM=xterm-256color`, `GIT_TERMINAL_PROMPT=0`, `NO_UPDATE_NOTIFIER=1`, `HERDR_AGENT` unset (set per start by PROV). No proxy variables baked in (they are runtime values). ASSUMPTION: both CLIs honour these two directory variables; BOX009 verifies and the smoke test checks that no config is written under `$HOME` after a CLI start.
6. **Entrypoint** (`entrypoint.sh`, POSIX sh, no network access, no root): creates `/run/overmind` sockets' parent, starts the two TCP-to-socket relays with `socat` bound to `127.0.0.1` only (egress proxy port 3128 to `/run/overmind/egress.sock`, agent API port 7077 to `/run/overmind/agent-api.sock`; ports are constants shared with BOX012/BOX020 through `image/pins.json`), starts the herdr server from `/opt/overmind/herdr/herdr` in the background if `OVERMIND_START_HERDR=1`, then `exec sleep infinity` (or waits on herdr) so the container stays up for `exec`. It ignores SIGHUP, forwards SIGTERM to children, and exits non-zero if a relay cannot bind.
7. **Labels:** `app.overmind.image.version`, `app.overmind.image.node`, `app.overmind.image.claude`, `app.overmind.image.codex`, `app.overmind.image.built-from` (git commit) so provisioning can detect staleness.
8. **Reproducibility:** `image/VERSION` is semver of the image definition; `pins.json` lists base digest, apt snapshot date, npm packages and versions. A build script prints the content hash of the build context (`image-input-hash`) used by OVE_BOX006 as the cache key.
9. **Smoke test (`smoke.sh`)** runs inside the built image under the production flags (read-only root, tmpfs home, non-root): `id -u` is 1000, `claude --version` and `codex --version` match `pins.json`, `git --version`, `rg --version`, no setuid files, `touch /x` fails, `touch /work/x` works when `/work` is mounted, `/creds` writable only when a volume is mounted, relay ports bind on loopback only.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Pinned-version policy and dependency register (OVE_SETUP008), SBOM tooling (OVE_SETUP007) for the image's package list, bundled herdr rules (OVE_SETUP015), `docs/dependencies.md` entries for Node base, CLIs and apt packages.

## 8. Architecture and code placement

All files under `packages/adapters/sandbox-macos/image/` plus `docs/sandbox/base-image.md`. Pure packaging; no TypeScript here except a tiny `pins.json` schema consumed by BOX006 (`image/pins.schema.json`).

## 9. Security and safety

The image is part of the trusted computing base for isolation: minimal packages, no sudo, no setuid, no ssh client, non-root default, no baked secrets, no network needed at run time, digest-pinned base and lockfile-verified npm tree (supply chain SR-22). The entrypoint must not read mounted workspaces. `socat` relays listen on loopback in the container's own network namespace only. An Agent can read the CLI binaries, which is acceptable (public software). The image contains no herdr binary to avoid an unverified copy.

## 10. Errors and edge cases

- Upstream npm package renamed or yanked: build fails; maintainers bump deliberately (documented).
- apt snapshot unavailable at build time: the build fails; never falls back to an unpinned mirror.
- A CLI writes to `$HOME` despite the variables: smoke test fails and the profile in PROV010/011 documents the extra tmpfs path.
- Image built on Intel Mac: not supported (preflight blocks earlier).
- Relay port already in use inside the container (a malicious process started early): entrypoint exits non-zero; lifecycle marks the Environment failed.

## 11. Acceptance criteria

- [ ] `container build` of the context succeeds on macOS 26 and produces the labels of requirement 7.
- [ ] `smoke.sh` passes under read-only root, tmpfs home and non-root user.
- [ ] `pins.json` validates against its schema and lists base digest, CLI versions and apt snapshot.
- [ ] `find / -perm /6000` inside the image returns nothing.
- [ ] Documentation lists every installed package with its reason and the bump procedure.
- [ ] The build context contains no secrets and `docs/dependencies.md` is updated.

## 12. Test plan

`smoke.sh` runs in CI on the macOS 26 runner (OVE_SETUP021) and locally; a Linux CI job lints the Containerfile (hadolint, pinned) and validates `pins.json`. Shell scripts checked with shellcheck. Commands: `pnpm sandbox:image:lint`, `pnpm sandbox:image:smoke` (scripts registered in the package).

## 13. Parallelization notes

Independent of BOX003 code; BOX006 consumes `pins.json` and the build script. Hotspots: `pins.json` and the lockfile (single owner; bumps come as dedicated PRs).

## 14. Open questions and assumptions

- ASSUMPTION: Claude Code is installed through its npm package; if the vendor ships only a native installer in the future the Containerfile changes but the contract (binary at `/usr/local/bin/claude`) stays.
- Open: variant image with compilers and language toolchains for build/test tasks (post-MVP: "agent-dev" variant referenced per Workspace); the MVP image supports Node projects and generic file work only. Owner decision needed on which toolchains matter first.
