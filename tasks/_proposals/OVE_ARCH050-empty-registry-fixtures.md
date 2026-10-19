# OVE_ARCH050: preserve real Git fixtures with a tracked empty registry

The mandatory OVE_ARCH049 generator admits only an existing tracked canonical generated output. Three existing real Git fixtures predate this artifact. The integrator is requested to apply only the following fixture adaptations; the OVE_ARCH050 author does not edit these foreign paths.

- `tools/docs-check/run.test.ts`: import `renderPluginRegistry` from `./plugin-registry.ts`; write `tools/docs-check/plugin-registry.generated.ts` with `renderPluginRegistry([])` after creating the checker directory and before the existing `git add`.
- `tools/docs-check/targets.test.ts`: the same import and empty generated output bootstrap in `fixture()`, before the existing `git add`.
- `tools/docs-check/git-environment.int.test.ts`: the same import and bootstrap in the real external-root CLI fixture, before its existing `git add`; add only `tools/docs-check/plugin-registry.generated.ts` to the exact expected tracked-inventory string, in Git lexical order. Its nested run/targets cases reuse their updated fixtures.

Retain every existing assertion, subprocess timeout, Vitest budget, retry setting, inherited Git-environment test and broken-link/publication/asset proof. No public missing-output fallback, generator-policy change, dependency, configuration or production change is requested.

The caller will reject nonempty candidate inventories from a root different from the trusted CLI/runtime checkout. Empty external-root fixtures remain supported without importing another checkout's static registry. Actual new/removed plugin CLI proof uses copied trusted runtime and generated artifact co-located in a real Git fixture.

The integrator applied exactly these three fixture adaptations, recorded in `ove050-finite-fixture-integration-20261019.json`. All original assertions and budgets were preserved. That source integration is not a test result or whole-task acceptance; applicable runtime checks and independent reviews remain separately required.
