# Isolate the existing Rust sidecar fixtures

Integrator-approved scope: `apps/desktop/src-tauri/tests/sidecar.rs` only.

The actual packaging acceptance leaves a real engine executable in the normal
Tauri build output. Tauri build scripts copy it into any Cargo target directory.
The old tests attempted to create their helper at that fixed location and
correctly refused to overwrite it (`AlreadyExists`), poisoning the second test.
A fresh Cargo target therefore cannot isolate these fixtures.

Run each existing sidecar test in a copy of the real Rust test executable inside
a fresh private fixture directory, using the actual Tauri shell plugin and
unchanged process assertions. Keep exclusive helper creation, a bounded child
test deadline, and cleanup. Do not delete, rename or overwrite real packaged
outputs. No production code, capability, dependency or assertion is relaxed.

The scoped command failed with both original tests before this fix. The PR must
record its real rerun and full checks, and confirm the original sidecar checksum
is unchanged.

Real verification on 2026-10-17: the scoped Rust command passed both tests.
Each child executed exactly one actual test; the outer timeout test still
waited for the real 15-second deadline and checked helper termination.
The SHA-256 of the pre-existing real sidecar stayed unchanged.
