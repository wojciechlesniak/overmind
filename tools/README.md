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
