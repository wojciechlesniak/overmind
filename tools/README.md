# Development tools

Use the Node version in `.nvmrc` (`nvm use`), then run:

```sh
corepack enable && corepack install
pnpm install --frozen-lockfile
node --test --import tsx tools/skeleton.test.ts
```

Node outside the declared 22.x range is rejected. Corepack selects the exact
pnpm release and verifies the hash in `packageManager`. Do not bypass engine
checks or regenerate the lockfile with a different package manager.

Each tool lives in `tools/<name>/`, with a `run.ts` entry point, colocated tests,
and pure logic separated from filesystem or process calls. The root scripts
reserve their final commands; their owner tasks supply the implementations.
Until then those commands fail visibly instead of reporting false success.

The skeleton has 17 workspace packages plus the root project. Internal imports
use `@overmind/*` and explicit `workspace:*` edges. Package manifests are the
source of truth for the dependency graph; source entry points are temporary
placeholders marked with their successor task ID.

## Bootstrap decisions (OVE-001)

- pnpm 12 reads non-authentication configuration from `pnpm-workspace.yaml`.
  `engineStrict: true` therefore enforces engines; `.npmrc` also retains the
  requested `engine-strict=true` spelling for npm compatibility.
- pnpm 12 replaces `onlyBuiltDependencies` with `allowBuilds`. No dependency
  build is permitted. `esbuild: false` explicitly denies tsx's transitive
  postinstall; its platform binary is installed as an optional dependency.
  `strictDepBuilds: true` rejects any newly introduced, unreviewed build script.
  See the [pnpm settings reference](https://pnpm.io/settings/build).
- `verifyDepsBeforeRun: error` prevents commands from silently repairing an
  inconsistent install and then running after a failed repair.
- Until OVE-005 installs Lefthook and its configuration, `prepare` checks for
  `lefthook.yml` before running `lefthook install`. Once that file exists, an
  unavailable or failing Lefthook is an error. This allows a clean bootstrap
  install without introducing hook implementation from a later task.

## Bootstrap dependency justification

`tsx` is the only external dependency introduced by OVE-001, as a development
dependency through `catalog:`. Its MIT-licensed TypeScript loader runs the
required Node tests and future development scripts. It avoids a separate
compile step; the alternative is maintaining a bootstrap compilation pipeline.
The maintenance cost is one pinned loader and its esbuild platform dependency.
No dependency lifecycle scripts are allowed. Version 4.23.15 and pnpm 12.11.2
were verified against the npm registry on 2026-10-15; Node 22.23.3 was downloaded
from nodejs.org and checked against its published SHA-256. The complete
dependency register remains owned by OVE-008.

## Hooks

Use `pnpm test` for the bootstrap and unit tests; the Vitest runner replaces
the earlier Node test command above. Use `pnpm test:int` for real Git hook
integration tests, including linked worktrees and CI installation.

`pnpm install` runs the idempotent `prepare` script and installs Lefthook into
the common Git hook directory. `CI=true` leaves hooks untouched. If Lefthook
is unavailable, installation fails visibly; repair it with
`pnpm exec lefthook install` after installing the locked dependencies.

Pre-commit checks only staged paths, rejects files over 1 MiB (except PNGs
under `tasks/` and `docs/`) and secret filenames, including `.env.example`.
Use another filename for checked-in environment documentation. Formatting
runs before ESLint fixes on shared paths to avoid concurrent writes; both
re-stage their fixed paths. Finish unstaged edits before staging a file for
commit, since `stage_fixed` stages the complete fixed file. A second staged-size
gate in commit-msg runs after Lefthook finishes pre-commit restaging, so
formatter expansion cannot bypass the limit. Filename and task checks run in
parallel. Task validation starts when OVE_SETUP013 supplies it.
`lefthook-secrets.yml` is already an extension point for OVE_SETUP007; Lefthook
permits it to be absent until then.

Commits use `type(scope): imperative subject`, with an optional scope from
`tasks/PLAN.md`, `deps` or `release`. Start the subject with a lower-case letter,
use no emoji or trailing period and keep header/body/footer lines within 100
characters. Imperative wording and the usefulness of an explanation are also
reviewed by humans. `feat`, `fix` and `security` require an explanatory body.
On `task/OVE_XXXNNN`, add a blank-separated final footer matching the branch:

```text
feat(perm): add policy intersection

Deny access unless both policies permit it.

Refs: OVE_PERM001
```

Merge and revert references are exempt. Fixup/squash messages use commitlint's
default ignores. Other branches and detached HEAD warn when a task reference
is absent. Co-author trailers are allowed.

Pre-push runs typecheck, lint and unit tests sequentially and stops at the
first failure; boundaries join once OVE_ARCH002 supplies its checker. For a
single deliberate local exclusion use, for example,
`LEFTHOOK_EXCLUDE=tests git push` after running the relevant tests separately.
Hooks are advisory; OVE_SETUP006 repeats the checks in CI and protects hook
configuration changes with the `hooks-change` label.

Lefthook 2.2.1 (MIT) supplies worktree-aware hooks instead of bespoke Git hook
installation. The requested 2.2.2 is younger than the required 72 hours;
2.2.1 is the previous mature patch. Its dependency postinstall remains denied:
the packaged platform binary is invoked by our explicit, CI-aware prepare.
Commitlint CLI and its Conventional config 21.2.3 (MIT) provide the standard
parser and rules instead of a second commit parser. The two local rules add
branch references and project policy. OVE_SETUP008 owns the dependency register.

Git test fixtures must use `isolatedGitEnvironment()` from
`tools/hooks/git-test-environment.ts` for subprocesses. Git hooks export
repository/index/object/config selections: inheriting them while running
`git init` in a temporary folder can modify the caller's repository instead.
The fixture environment removes all `GIT_*` values and disables external Git
configuration. Commands that intentionally inspect the active repository
(such as the commit rule and staged-size guard) retain their normal environment.
