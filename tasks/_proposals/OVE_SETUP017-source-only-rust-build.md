# Preserve source-only Rust validation after adding engine resources

Integrator-approved scope: `apps/desktop/src-tauri/build.rs`, a pure
`build_config.rs` helper and the existing Rust security tests.

Actual CI run39031149721 fails in the Tauri build script because a fresh source
checkout has neither the generated sidecar nor its two generated companions.
The existing non-release source-only mode already removes `externalBin`; it
must also remove only the exact two engine resource mappings in that mode.
All Rust license resources and unrelated resources remain required.

The helper returns no override for release profiles or when the sidecar exists.
Those builds retain the original mandatory binary/resources configuration.
No capability, manifest pin, license restriction, runtime verification, lint or
CI gate changes. Tests cover both no-override branches, the narrow development
change and malformed resource maps; actual source-only Cargo validation must
run from a fresh tracked-source export without generated resources.
