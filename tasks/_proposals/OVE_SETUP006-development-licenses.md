# Development dependency license policy decision — OVE_SETUP006

Status: declined by the Owner on 2026-10-15. Preserve the original policy and merge block.

The implemented license checker faithfully enforces TASK.md requirement 8 and fails on these existing development dependencies:

| License | Packages | Use |
| --- | --- | --- |
| MIT-0 | @csstools/color-helpers, @csstools/css-syntax-patches-for-csstree | jsdom CSS tooling |
| CC-BY-4.0 | caniuse-lite | browser compatibility data used by lint/build tooling |
| CC-BY-3.0 | spdx-exceptions | SPDX license exception data used by the policy parser |
| MPL-2.0 | lightningcss and installed platform binary | Vite CSS transformer |

Proposed Owner decision: add MIT-0, CC-BY-3.0 and CC-BY-4.0 only to a separate development allow-list. Keep the production allow-list unchanged. Preserve upstream license/attribution material. Use the task's existing package-specific, justified, expiring MPL exception mechanism for the named Lightning CSS development packages, expiring 2027-01-15. No GPL/AGPL/LGPL/SSPL/BUSL/noncommercial/unknown exception is proposed.

Until the Owner responds, the checker remains fail-closed. The report is real pnpm licenses list output; dependency versions and lockfile are unchanged by this proposal. OVE_SETUP008 will maintain the full dependency register.
