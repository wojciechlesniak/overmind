# OVE_ARCH018: retain the actual plugin configuration in the coverage fixture

The actual covered suite passed 967 cases and failed one existing coverage-merge
fixture at startup: its copied root configuration names the new boundary-rules
project, but the fixture does not copy that project configuration.

The integrator adds only the eslint-rules/boundaries fixture directory and copies
its actual vitest.config.ts alongside the existing configurations. No plugin
implementation or additional workspace package is fabricated in the fixture.

Preserve all four Domain probes, three real shards, merged rejection assertions,
15-second child and 60-second case budgets, coverage sources and thresholds.
Keep the original failure and verify the repaired real fixture before broad tests.
This compatibility repair supplies no architecture-rule or parent acceptance.
