# OVE_ARCH032 engine bundler relocation

## Bounded implementation

Move the current bundler and declaration into `tools/build/engine`, replace only
runtime contract loading with the merged `readProtocol` data reader, and update
the engine build script, four packaging callers and still-unmoved process suite.
Keep all existing guard logic, output options, source-map privacy, version/SHA
validation, assertions and deadlines. Append two public bundler regressions for
throwing and computed protocol source. No compatibility module remains.

Tools already declares catalog esbuild 0.28.2 from OVE_ARCH027. Remove only the
former engine development declaration. The normal pnpm lock generator must produce
exactly that importer removal; frozen installation and all other policy bytes stay
unchanged. No new dependency, version, license exception or permission is requested.

## Finite dependency-register integration request

After actual native/packaging proof, the integrator may change only these two
sentences in the existing esbuild entry of `docs/dependencies.md`:

- Used by: `tools` (build-only development dependency; the relocated engine bundler
  and packaging callers use this importer after OVE_ARCH032).
- Value: Single-file Node22 CommonJS bundle, external source maps and inspectable
  metafile for the standalone engine. The Tools bundler uses the existing 0.28.2
  pin; the engine invokes its Tools command without its own esbuild declaration.

All package pins, registry snapshot/review dates, licenses, alternatives, native
risk and install-script restrictions remain unchanged. This proposal grants no
shared-file ownership; only the integrator applies the exact finite context edit.

## Verification and limits

Actual RED, generator/frozen-install, native, packaging, security and review
receipts are retained externally. Task criteria remain unchecked until real proof
supports them. Current process tests stay in `apps/engine/test` until OVE_ARCH033.
Normal committed/rebased hooks, fresh hosted gates and both independent whole
reviews remain required. No DeveloperID, notarization, product penetration or
parent OVE_ARCH002 acceptance is claimed by this relocation.

## Finite engine README integration request

Independent whole review found that `apps/engine/README.md` still advertises the
removed `build/bundle.mjs` entry. The integrator must replace only that inline
entry with `../../tools/build/engine/bundle.mjs`; retain every surrounding bundle,
map, version, protocol, guard and packaging contract sentence unchanged. This is
an exact documentation correction under CONVENTIONS section 8.7, not additional
runtime scope. Initial review findings stay recorded until independent follow-up
confirms the repaired whole candidate. No native test result is rewritten.
