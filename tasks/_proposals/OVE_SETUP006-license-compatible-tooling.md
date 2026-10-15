# License-compatible development tooling

Status: implemented under the Owner's explicit request to replace incompatible
dependencies while preserving the current license policy. This supersedes the
initial tool selections where necessary; it does not approve license exceptions.

## Replacements

| Previous source of denied packages | Replacement | Effect |
| --- | --- | --- |
| Vite 8.3.4 requires Lightning CSS (MPL-2.0) | Vite 7.3.7 | Still receives important/security fixes and satisfies Vitest 5's peer range; PostCSS is the default transformer |
| jsdom 30.1.2 requires MIT-0 CSS tooling | Happy DOM 21.0.1 | Supported directly by Vitest and Testing Library; only test environments change |
| eslint-plugin-react-hooks 7.1.1 requires Babel/browserslist/caniuse-lite (CC-BY-4.0) | Oxlint 1.87.0 hooks/compiler rules | ESLint 10 remains for strict TS and other checks; no unsupported ESLint downgrade |
| spdx-expression-parse requires spdx-exceptions (CC-BY-3.0) | Small policy expression evaluator + spdx-license-ids 3.0.24 (CC0-1.0) | Accepts registered SPDX IDs and LicenseRef values with AND/OR/parentheses; WITH/plus terms never grant permission |

Versions were verified against official npm metadata on 2026-10-15 and all meet
the existing 72-hour release-age requirement. Oxlint 1.88.0 was younger than the
required age, so mature 1.87.0 is pinned instead. No peer override, license
metadata rewrite, report exclusion, install-script allowance or age exception is
introduced. Full dependency resolution removes old optional peer snapshots too.

Sources: [Vite support policy](https://vite.dev/releases),
[Happy DOM integration](https://github.com/capricorn86/happy-dom/wiki/Setup-as-Test-Environment),
[Oxlint compiler mapping](https://oxc.rs/blog/2026-08-18-react-compiler-support).

## Scope and retained safeguards

This changes development tooling for Overmind's own application source. It does
not install, select or change end-user skills, agents or their instructions.

The two UI package configs and api-client's per-file opt-in now select Happy DOM.
Shared setup, network denial, process isolation and all package coverage thresholds
are retained. Script evaluation and external script/style/image/iframe loading,
including filesystem HTTP requests, are explicitly disabled. A behavioral
regression verifies an inserted script cannot execute in the test process. Happy
DOM differs from jsdom in browser fidelity; future Playwright tests remain the
authority for actual browser behavior.

The 14 active Oxlint rules cover rules-of-hooks, exhaustive-deps and the 12
applicable compiler checks from the previous recommended preset. The upstream
config/gating diagnostics concern Babel compiler options; Oxlint exposes fixed
valid compiler options and no compiler gating configuration. The upstream
component-hook-factories export in 7.1.1 is a deprecated no-op, not a lost check.
The pinned publisher tarball was checked against its npm SHA-512 when inspecting
this mapping. The two implementations can differ in edge cases; regression tests
exercise hook order, dependencies, purity, valid components, parser failure and
UI/backend scoping. Nested Oxlint configs are disabled; its root config has the
same maintainer approvals as ESLint, and all suppression comments need reasons.

The policy evaluator does not need exception-name data because every WITH/plus
term is denied. It parses their syntax but never approves those terms, including
unknown exception names. A separate permitted OR alternative still passes, as
required by the policy. License IDs themselves must exist in the CC0 registry
or use valid LicenseRef syntax. It parses all operands,
preserves AND precedence, bounds work, and retains package-specific MPL exception
handling (the exceptions file remains empty).

Affected earlier ownership paths: root tooling/catalog/lockfile (SETUP001/008),
React lint module and suppression checks (SETUP003), shared/package test configs
and DOM test (SETUP004), staged hook (SETUP005). This direct Owner request
authorizes these coordinated replacements; original task history is preserved.
The version/context prose in those completed tasks describes the original
implementation; this proposal records the subsequent change.

The license block is resolved only when actual local and hosted reports pass.
The remaining SETUP006 isolation/boundary/fork/hardware acceptance gaps are
independent of these replacements; this proposal does not waive them.
