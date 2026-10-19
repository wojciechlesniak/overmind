# OVE_ARCH030 Vite relocation integration

## Authority and bounded scope

The Owner approved the ARCH002 split into small tasks and production-quality work
on DEVELOP. The registered OVE_ARCH030 owns thirteen paths. Its approved finite
handoff preserves all historical ARCH002 source; no bulk implementation is reused.
The integrator alone applies the two dependency-register context changes below.
No dependency version, release date, license, review date or policy changes.

## Implementation and real validation

The desktop dev/build/preview scripts now select `tools/vite/desktop.config.ts`
explicitly. The config derives the desktop root from its own module location.
The current desktop integration suites were updated before removing the old
config, Node-only tsconfig/reference and desktop SWC dependency declaration.
Tools already declares the same approved SWC catalog pin from OVE_ARCH027.

Real public tests first demonstrated preview consuming the development proxy and
seven invalid proxy-origin cases. The same assertions passed after minimal fixes.
Preview ignores the development proxy; malformed input uses a fixed diagnostic.
Original development-server/build assertions and deadlines remain intact.

The normal pinned pnpm generator changed only the three-line desktop SWC importer;
whole-byte comparison proves every other lockfile byte unchanged. Normal frozen
installation passed. No dependency or install-policy exception was used.

Actual checkpoint `ove030-native-repair1-v12-20261019.json` records full typecheck,
full lint, sixteen scoped unit tests and fifteen tests in the two current desktop
integration files passing. Both the desktop build script and root-CWD explicit
Vite CLI build passed. Formatting passed. The first native checkpoint retained
its two optional-chain lint errors, corrected only in the new skeleton test.

Actual CLI default-port probes, remaining applicable security checks, full normal
unit hooks, independent whole Standards/Spec reviews and exact lifecycle hosted
checks remain pending at this checkpoint. No Mac escape, product penetration or
parent ARCH002 acceptance is claimed.

## Exact integrator change: docs/dependencies.md

In the existing `@vitejs/plugin-react-swc` entry, replace only:

```text
- Used by: apps/desktop (dev); tools (dev, OVE_ARCH027 relocation prerequisites)
```

with:

```text
- Used by: tools (dev, desktop Vite configuration)
```

In the same entry, replace only the trailing value/context sentence:

```text
OVE_ARCH027 declares the same pin directly in Tools for the later Vite configuration relocation; desktop keeps its declaration until that relocation works.
```

with:

```text
OVE_ARCH030 moves the desktop Vite configuration into Tools, its sole direct importer; the validated desktop scripts select that configuration explicitly.
```

Keep the preceding value sentence, version 4.3.3, license MIT, global verification
date 2026-10-17, actual last-reviewed date 2026-10-16, maintenance, alternatives,
risk and all other entries byte-for-byte unchanged. This records actual importer
placement, without implying a new registry/security/license review.
