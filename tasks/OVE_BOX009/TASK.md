---
id: OVE_BOX009
title: Manage persistent CLI credential volumes that Overmind never reads
area: BOX
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH012, OVE_BOX003, OVE_DATA009, OVE_ENGINE016, OVE_PERM014]
soft_depends_on: [OVE_BOX001, OVE_SEC009]
provides: ["lib:credential-volumes"]
needs: ["port:Sandbox", "port:AuditSink", "port:ApprovalVerifier", "contract:Workspace", "port:Clock"]
owns:
  - packages/adapters/sandbox-macos/src/volumes/**
reads: ["docs/security/login-flow.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 11"]
adr_refs: [20, 22]
---

# OVE_BOX009: Manage persistent CLI credential volumes that Overmind never reads

## 1. Summary

Provide the separate persistent volumes where `claude` and `codex` keep their login and session data, so a login survives container recreation while remaining invisible to other CLIs and, for isolated Workspaces, to other Workspaces. Overmind creates, mounts and deletes these volumes but never reads their content.

## 2. Context

Prototype: Codex login survived `container stop`/`start` but disappears when the container is removed; hence a persistent volume. ADR 0020: the volume is per Agent or per CLI and not visible to other Workspaces. ADR 0022 and SEC009 rule L6: credentials live only in the per-CLI volume, never copied to the host data directory, never in backups. Claude Code and Codex locate their data through `CLAUDE_CONFIG_DIR` and `CODEX_HOME` (set in the image to `/creds/claude` and `/creds/codex`; BOX005). These directories also hold session transcripts (Claude `projects/`), which contain code from the Workspaces where the CLI ran, so a volume shared across Workspaces lets an Agent in Workspace B read transcripts of Workspace A.

## 3. Scope (in)

- `CredentialVolumeManager`: ensure/inspect/delete volumes, resolve `VolumeRef`s for a given Environment.
- Scope policy `credentialScope`: `'cli'` (default, one volume per CLI per install) or `'cli-workspace'` (one per CLI per Workspace), forced to `cli-workspace` for isolated Workspaces.
- Owner-confirmed deletion and the "removing a Connection deletes the volume" flow hook.
- Verification that the CLIs really keep their state inside the volume.

## 4. Out of scope

- Login UX and port forwarding: OVE_BOX015, ONB. Reading or validating tokens: never. Backup/export (credential volumes are excluded by construction; DATA/BACKUP must not include them).

## 5. Detailed requirements

1. **Naming and labels:** volume name `ovm-cred-<install8>-<cli>` (scope `cli`) or `ovm-cred-<install8>-<cli>-<workspace8>` (scope `cli-workspace`); labels `app.overmind.managed=true`, `app.overmind.kind=credentials`, `app.overmind.cli`, `app.overmind.workspace?`. Volumes are created through `ContainerCli.volumeCreate` with a size limit if the CLI supports it (default 1 GiB, ASSUMPTION).
2. **Mount rules:** an Environment for CLI `claude` gets only the claude volume at `/creds/claude`; for `codex` only the codex volume at `/creds/codex`; an Environment with `cli: 'none'` (for example ollama-only or test) gets none. Never both. Mount mode rw. The volume is never mounted into any Environment of a different Workspace when scope is `cli-workspace`.
3. **Resolution API:** `volumesFor(env: { cli, workspaceId, isolatedWorkspace }): Promise<Result<VolumeRef[]>>` creating missing volumes (idempotent). The scope is read from config (`sandbox.credentialScope`) and forced to `cli-workspace` when `isolatedWorkspace` is true (ADR: isolated Workspace shares nothing). Changing the scope later does not migrate data: a new scope creates new volumes and the Owner logs in again (documented, the UI shows a notice via a status flag).
4. **Never read:** the adapter exposes no method to list files or read content of a volume. `container volume inspect` returns metadata only (size, creation date, labels). A lint rule (grep test) forbids `volume`-related commands that copy data out (`container cp`, `export`, `exec cat /creds`) anywhere in the adapter except in the explicit `verifyPersistence` test helper which only checks existence of a path, never content, and is compiled out of production builds.
5. **Persistence verification (`verifyPersistence`, test/dev only):** starts a throwaway Environment, runs the CLI's config-dir probe (`test -d /creds/claude` after `claude --version`), recreates the Environment and checks the marker file survives. Used by the integration tests and by BOX021.
6. **Deletion:** `deleteVolume(ref, { approvalToken })` requires a valid Owner approval (action `sandbox.delete_credentials`, SR-25 style, single-use) and refuses while an Environment mounts it. Removing a Connection (PROV020) calls this after the Owner confirms in the UI (the UI text warns that the login will be lost). Audit event `sandbox.credentials_deleted` (ids only).
7. **Exclusions:** credential volumes are never mounted read-only into agent work areas, never mounted into the engine, never included in `listEnvironments` output beyond ids. DATA/BACKUP tasks are told in the docs that volumes are outside the data directory by design.
8. **Stale-session guidance:** because transcripts live in the volume, the doc lists the data-leak property of scope `cli` and the mitigation (isolated Workspaces use their own volumes; Owner may switch to `cli-workspace` in settings at the cost of one login per Workspace).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ContainerCli.volume*` (BOX003), approval verification and audit (PERM), `VolumeRef` type (OVE_ARCH012), secret-free logging (OVE_ARCH004). Login guidance rules are in OVE_SEC009 and must be linked from the module header.

## 8. Architecture and code placement

`packages/adapters/sandbox-macos/src/volumes/{credential-volume-manager.ts,scope-policy.ts,volume-naming.ts,delete-volume.ts}`; `scope-policy.ts` is pure. Config key `sandbox.credentialScope` is declared in the sandbox config section owned by OVE_BOX017.

## 9. Security and safety

Highest-value secrets in the system (subscription logins) live here, outside Overmind's visibility. Controls: no read API, no copy-out commands, labelled and named per CLI (and Workspace when required), mounted only where the CLI runs, deletion needs approval, nothing in backups, nothing in logs. Abuse cases: a malicious repo makes the CLI print the token (screens are never parsed for tokens; SEC003 redaction applies); a prompt-injected Agent runs `cat /creds/claude/...` and posts it: possible inside the Environment, but egress is allowlisted to provider hosts and proxy-logged (BOX011), and this residual risk is recorded in the threat model; an Agent of Workspace B reading Workspace A transcripts is blocked only by scope `cli-workspace`, which is therefore forced for isolated Workspaces.

## 10. Errors and edge cases

- Volume creation fails (disk): `box.credential_volume_error`, the Environment is not created.
- Volume exists without labels (manually created): refuse to adopt (`box.credential_volume_error`).
- Two Environments of the same CLI start simultaneously: shared volume is fine; concurrent CLI writes are the CLI's responsibility; document refresh-token races as a known CLI behaviour.
- Owner deletes volume while an Environment is stopped: allowed with approval; next start asks for login (`needs_login`, PROV014).
- Install id changes (data directory restored on another Mac): volumes with another install id are ignored and reported as foreign.
- Disk quota unsupported by `container volume create`: no size flag used; documented.

## 11. Acceptance criteria

- [ ] An Environment mounts exactly the volume of its CLI and never the other CLI's volume (spec-level test).
- [ ] With scope `cli-workspace` or an isolated Workspace, two Workspaces get different volumes.
- [ ] No code path reads a volume's contents (grep-based architecture test passes; helper compiled out in production).
- [ ] Deleting a volume without a valid single-use approval fails; with it succeeds only when unmounted.
- [ ] A login marker survives destroy and recreate of the Environment in the integration test, and does not appear in an Environment of another scope.
- [ ] Volumes are absent from backup/export file lists (documented contract, checked by a DATA-side test referencing this doc).

## 12. Test plan

Unit tests for naming, scope policy, mount resolution; fake-runner tests for create/inspect/delete flows and refusal cases; integration (macOS runner) for persistence with `fake-claude`/`fake-codex` writing a marker under their config dirs (TEST006). Commands: `pnpm vitest run packages/adapters/sandbox-macos/src/volumes`.

## 13. Parallelization notes

Parallel with BOX007/BOX008. BOX007 consumes `VolumeRef`s only. PROV020 (Connections) calls deletion; agree on the `CredentialVolumes` application interface early (declared in `packages/application/src/sandbox/credential-volumes.ts`, owned by OVE_BOX019 to avoid a new port owner; if needed a proposal).

## 14. Open questions and assumptions

- ASSUMPTION: `CLAUDE_CONFIG_DIR` and `CODEX_HOME` relocate all CLI state including login (verified by the smoke test in BOX005 and the integration test here).
- Open for the Owner (security versus convenience): one login per CLI for all normal Workspaces (default, less secure for transcripts) versus a login per Workspace.
