---
id: OVE_BOX014
title: Manage one git worktree per Agent with tamper checks and never-deleted branches
area: BOX
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH013, OVE_ARCH014, OVE_BOX003, OVE_ENGINE016, OVE_PERM014, OVE_SEC002]
soft_depends_on: [OVE_BOX007, OVE_ARCH014]
provides: ["port:WorktreeManager", "lib:worktree-manager"]
needs: ["port:ProcessRunner", "lib:path-guard", "port:AuditSink", "port:ApprovalVerifier", "port:AtomicFileWriter", "port:Clock"]
owns:
  - packages/application/src/ports/WorktreeManager.ts
  - packages/adapters/sandbox-macos/src/worktree/**
reads: ["docs/research/herdr-analiza.md", "docs/security/path-canonicalisation.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 17", "SPECIFICATION 11"]
adr_refs: [3, 4, 20]
---

# OVE_BOX014: Manage one git worktree per Agent with tamper checks and never-deleted branches

## 1. Summary

Give every Agent that works in a git repository its own `git worktree` (own branch, own directory mounted at `/work`) so parallel Agents do not trample each other (SPEC 17 risk, herdr pattern), never delete branches automatically, and protect the host from malicious repository configuration that an Agent could plant in `.git` (hooks, filters, fsmonitor).

## 2. Context

herdr analysis 2.6: one worktree per agent, branches never deleted, a dirty checkout needs an explicit force. The Agent's `/work` is the worktree directory; `.git` metadata of a worktree points to host absolute paths that do not exist in the container, so Git is told its directories through environment variables (set in the spec by OVE_BOX007): `GIT_DIR=/git/worktree`, `GIT_COMMON_DIR=/git/common`, `GIT_WORK_TREE=/work`. Danger: the common `.git` directory is mounted read-write, so a malicious Agent (or prompt injection) can write `.git/hooks/post-checkout`, `core.fsmonitor`, `core.sshCommand`, `filter.x.smudge`, `diff.external`, aliases with `!` etc. that later execute on the HOST when the Owner or the engine runs git. This task makes that risk visible and bounded.

## 3. Scope (in)

- Port `WorktreeManager` and its adapter using host `git` through `ProcessRunner`.
- Worktree creation, reuse, status, removal rules, branch naming.
- Hardened host-git invocation profile and the repository config/hook baseline and integrity check.
- Non-git directories (direct mode).

## 4. Out of scope

- Merging agent branches into the main branch (a controlled step owned by BOARD/WFRT, which uses this task's hardened runner). Pull requests, `git push` (ADR 0021 Zgoda, done by the Owner or an approved action). Showing diffs in UI.

## 5. Detailed requirements

1. **Port:**
   ```ts
   interface WorktreeManager {
     ensure(i: { workspaceId; agentId; primaryRoot: CanonicalPath; baseRef?: string }): Promise<Result<WorktreeInfo>>;
     info(workspaceId, agentId): Promise<Result<WorktreeInfo | null>>;
     checkIntegrity(primaryRoot: CanonicalPath): Promise<Result<IntegrityReport>>;
     acceptBaseline(primaryRoot, approvalToken): Promise<Result<void>>;
     remove(i: { workspaceId; agentId; force?: boolean; approvalToken? }): Promise<Result<void>>;
   }
   WorktreeInfo = { mode: 'worktree'|'direct'; workPath: CanonicalPath; gitDir?: CanonicalPath; commonDir?: CanonicalPath; branch?: string; baseCommit?: string; dirty: boolean }
   ```
2. **Location and naming:** worktree directory `<primaryRoot>/.overmind/worktrees/<agentSlug>` (inside the Allowed Directory, so permissions and mounts stay inside the plan); branch `overmind/<agentSlug>`, where `agentSlug` = lowercase ASCII from the Agent name plus the first 6 chars of the Agent id; collisions get `-2`, `-3`. `.overmind/` is appended to `<commonDir>/info/exclude` (local, not versioned) so the repo's working tree status stays clean. Branch names are validated with `git check-ref-format --branch` through the runner; names never come from Agent-controlled text.
3. **Create from:** `baseRef` default `HEAD` of the primary checkout (resolved to a commit id); `git worktree add -b <branch> <path> <commit>`; if the branch exists the worktree is reattached (`git worktree add <path> <branch>`), never reset. An existing dirty worktree is reused as is (work in progress survives restarts).
4. **Branches are never deleted by Overmind:** `remove` deletes the worktree directory registration (`git worktree remove`) but never `git branch -d/-D`, never `git gc --prune`, never `git worktree prune --expire=now` beyond its own registered entries. `remove` of a dirty worktree returns `box.worktree_dirty` unless `force: true` with a valid approval token (deletion of files is on the default Approval list, ADR 0021). Removing a Workspace (DATA) never calls remove automatically; leftover worktrees are listed to the Owner.
5. **Non-git or bare cases:** if `primaryRoot` is not a git work tree (no `.git`), mode `direct`: `workPath = primaryRoot`, no git env vars; a flag `sharedWithOtherAgents` is true when another Environment mounts the same directory (UI warning). Submodules: the worktree is created; submodules are not initialised automatically (documented); `.git` files pointing outside the root (`gitdir:` to an external location) make the repo `unsupported` for worktree mode with a clear error and direct mode requires an explicit Owner choice.
6. **Hardened host-git profile (`HardenedGit`):** every host git call goes through one wrapper that sets: `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_TERMINAL_PROMPT=0`, `GIT_ASKPASS=/usr/bin/false`, `GIT_PAGER=cat`, `GIT_OPTIONAL_LOCKS=0` for read-only calls, `LC_ALL=C`, and arguments `-c core.hooksPath=/dev/null -c core.fsmonitor=false -c core.sshCommand=/usr/bin/false -c credential.helper= -c protocol.ext.allow=never -c protocol.file.allow=user -c core.untrackedCache=false`. Only a fixed set of subcommands is permitted (`rev-parse`, `worktree add|list|remove`, `status --porcelain=v2`, `branch --list`, `check-ref-format`, `config --file ... --list`), never `checkout`/`merge`/`commit` with hooks implicitly enabled. The wrapper refuses to run in a repository whose integrity report is `tampered` (requirement 7).
7. **Baseline and integrity (`checkIntegrity`)**: parse (never execute) `<commonDir>/config` with `git config --file <path> --list --null` and compare against a stored baseline `{ configSha256, hooksTreeSha256, dangerousKeys: [] }` kept in `<dataDir>/sandbox/git-baselines.json` (keyed by canonical root, atomic write). The danger list (config keys that can execute code): `core.fsmonitor`, `core.hookspath`, `core.sshcommand`, `core.pager`, `core.editor`, `core.askpass`, `credential.helper`, `diff.external`, `diff.*.command`, `diff.*.textconv`, `filter.*.clean|smudge|process`, `merge.*.driver`, `alias.*` values starting with `!`, `include.path`, `includeif.*.path`, `gpg.program`, `gpg.*.program`, `url.*.insteadof`, `uploadpack.packobjectshook`, `receive.*hook`. First sight of a repo: baseline is created only if no dangerous key exists; otherwise the report is `needs_review` listing key names (not values) and the Owner must run `acceptBaseline` via Local Approval (legitimate cases: git-lfs filters). Later runs: any change of `config` or `hooks` content (excluding `*.sample`) since the baseline is `tampered` => `box.git_tamper`, audit `sandbox.violation`, Environment for that repo stopped, worktree creation blocked until the Owner reviews and accepts.
8. **When it runs:** before `ensure`, after every Environment stop for that repo (post-run check), and on Run end. Between those points the Agent can alter `.git` only inside its Environment; the post-run check detects it before any host git command or Owner action can be affected inside Overmind. Owner-run git in a terminal outside Overmind is not protected; the notification of tampering tells the Owner.
9. **Restore option:** `IntegrityReport` offers `restoreFromBaseline` (copies the stored baseline `config` back; hooks directory files not in baseline are quarantined by moving to `<dataDir>/sandbox/quarantine/<ts>/` after Owner approval). The baseline copy of `config` is stored in the data directory (it contains remote URLs possibly with tokens embedded by the Owner; the file is 0600 and redacted in logs, and excluded from backups unless the redaction pass succeeds).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ProcessRunner` with `inheritEnv: 'none'`, `PathGuard` for all paths, `AtomicFileWriter`, approvals (PERM), `AuditSink`. No other module may run `git` on the host; the boundary lint bans direct use.

## 8. Architecture and code placement

Port `packages/application/src/ports/WorktreeManager.ts`; adapter `packages/adapters/sandbox-macos/src/worktree/{worktree-manager.ts,hardened-git.ts,config-danger.ts,baseline-store.ts,integrity.ts,naming.ts}`. `config-danger.ts` and `naming.ts` are pure. It lives in the macOS sandbox adapter because it protects the same boundary and mounts, although git itself is portable; extracting later is a move, not a rewrite.

## 9. Security and safety

Abuse cases: (1) malicious repo ships `.gitattributes` with a filter and the Agent sets `filter.x.smudge` in config, then host `git worktree add` or `status` runs it: the wrapper disables hooks and fsmonitor, the integrity check blocks first, and `filter.*` is on the danger list; (2) Agent writes `.git/hooks/pre-commit` that runs when the Owner commits: post-run check detects and quarantines; (3) Agent sets `url.<evil>.insteadOf`: flagged; (4) branch name injection `--upload-pack=...` or `-D`: names are generated and validated, passed after `--`; (5) symlinked `.overmind` pointing outside the root: PathGuard refuses; (6) Agent deletes the worktree contents: its own branch work is lost, but others' branches are untouched and nothing deletes branches; (7) two Agents in one worktree: impossible, one worktree per Agent id. Fail closed: if integrity cannot be computed, git operations are refused.

## 10. Errors and edge cases

- Detached HEAD or unborn branch (empty repo): `ensure` creates an orphan-safe worktree from the first commit or returns `box.worktree_dirty`-style `unsupported_repo` with guidance; documented.
- Primary checkout dirty: allowed, the worktree is created from the commit, not the dirty tree (the UI explains).
- Shallow clones and sparse checkout: supported for worktree add; sparse config copied by git.
- `git` binary missing: `platform.command_not_found`; direct mode still works.
- Worktree directory deleted manually: `info` shows stale; `ensure` runs `git worktree prune` for that entry only and recreates.
- Very large repository: worktree creation timeout 120 s with progress; failure leaves no half-registered worktree (cleanup in `finally`).
- Case-insensitive APFS branch/dir name collisions: slug includes id fragment.

## 11. Acceptance criteria

- [ ] `ensure` for two Agents on one repo yields two directories and two branches; branches survive `remove`.
- [ ] No code path calls `git branch -d/-D` or prune with expire now (grep architecture test).
- [ ] Planting a hook, `core.fsmonitor`, `filter.*.smudge` or an `!` alias in the repo makes `checkIntegrity` report `tampered`/`needs_review` and blocks further host git calls; `acceptBaseline` needs a valid approval token.
- [ ] Hardened wrapper rejects non-allowlisted subcommands and always passes the safety `-c` flags (argv golden test).
- [ ] Dirty worktree removal fails without force + approval.
- [ ] Non-git directory returns direct mode without git env variables.
- [ ] Worktree and git dirs returned are inside the primary root (PathGuard) or the call fails.

## 12. Test plan

Unit: naming, danger-key parser (table of config snippets), baseline store. Integration with real git on Linux and macOS using temp repos (`worktree.int.test.ts`), including the planted-hook scenarios. Escape-style case contributed to TEST007 as `ESC-024 git metadata tamper` by documenting the scenario in BOX021. Commands: `pnpm vitest run packages/adapters/sandbox-macos/src/worktree`.

## 13. Parallelization notes

Independent of lifecycle code; BOX007 consumes `WorktreeInfo`. BOARD/WFRT consume the port (the merge step). Hotspot: `config-danger.ts` list (single owner).

## 14. Open questions and assumptions

- ASSUMPTION: Git 2.39+ on the host (macOS Command Line Tools ship it). The implementer records the minimum.
- Open for the Owner/SEC: replace the shared common-dir mount with an alternates-based clone per Agent (agent gets its own writable `.git`, the engine fetches its branches through `git fetch`), which removes the tamper surface on the Owner's real repository at the cost of deviating from the "worktree" wording of SPEC 17. Default: worktrees with the controls above.
