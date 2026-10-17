# OVE_OSS004 documentation checker integration

The original CLI2 adoption was blocked by its transitive license and HIGH audit finding. The Owner explicitly approved the exact embedded markdownlint 0.41.1 core instead; see [approved narrow adoption](OVE_OSS004-markdownlint-core-adoption.md). No license, security, release-age, peer or install-script policy exception is granted.

The alternatives are Prettier alone (formatting cannot enforce the required Markdown semantics), a custom complete Markdown linter (needless duplicated maintenance), and a separate link-checker dependency (not adopted: small pure offline link functions belong in this tool).

Coordinated changes outside owns are the root devDependency, generated pnpm lockfile and the existing docs/dependencies.md catalog-reserve entry. The existing check:docs root command already targets tools/docs-check/run.ts. Tool maintenance includes compatibility review on dependency updates and deterministic fixtures for GitHub heading/link behavior.

The README describes pnpm dev as reserved until OVE_SETUP012 supplies it and gives the current desktop-only command separately. Root GLOSSARY.md is the existing source; planned docs/GLOSSARY.md is recorded with its owning translation task. Missing documents are listed as pending with owner task IDs, never as working links. Publication remains blocked while Owner markers or pending documents exist.


Additional integrator-owned changes proposed: correct the existing tools/ci/architecture.ts check:docs owner from OVE_OSS002 to OVE_OSS004, and protect .markdownlint-cli2.jsonc in tools/ci/config-integrity.ts with the existing config-change label plus a real negative fixture. No new approval flow or gate weakening is proposed.


## Rebased integration, approved 2026-10-17

After rebase on DEVELOP 7815088, the integrator approved the exact additional
changes needed by already-merged work: autolink the esbuild Source URL; describe
the engine's synthetic namespace as virtual file URLs under overmind/source
without publishing a literal file-URL string; regenerate credits from the actual
headlines; and validate literal filtered commands against their real tracked
workspace manifest. Unfiltered commands still require root scripts. No unknown
script or workspace is allowed, no command is executed and no privacy rule is
relaxed. Pure negative tests and the real tracked-Git CLI fixture cover both.

ARCH001's actual architecture, boundary data and Mermaid files are now linked;
its pending entry was removed after rebase. The exact registry owner correction
and config-change guard for the Markdown configuration were approved and applied
with a real RED fixture (without label previously exited 0) then GREEN denial
without label and acceptance with the existing label. The original 30-second
fixture timeout is preserved; one timing failure passed unchanged on retry.
