# Owner approval: 27 exact Rust dependency versions

On 2026-10-16 the Owner explicitly approved exceptions only for the 27 Rust
packages/versions reported by PR944's dependency review and authorized implementation,
tests, independent reviews and merge to DEVELOP after all checks pass.

The exact approved identities, SPDX expressions, Cargo.lock checksums and notice
hashes are recorded in tools/check-licenses/rust-approvals.json. Cargo receives six
exact-version exceptions; its existing Unicode/Zlib allowance is unchanged. The npm
allow-list and npm exceptions remain unchanged. GitHub's package exclusion matcher
ignores versions, so an additional required local/CI gate checks every registry
package against the common allow-list or an exact approved identity, version,
checksum and SPDX expression. Future versions and unrelated packages do not inherit
this decision. Missing notices/source archives or policy drift fail closed.

Because GitHub applies those exclusions repository-wide, the gate also rejects any
additional Cargo manifest or lockfile outside the checked desktop graph. It checks
tracked and non-ignored untracked files, including tracked files hidden by ignore
rules. Adding another Rust project requires explicitly extending the validation.

The five MPL source archives are unchanged upstream .crate files, verified against
Cargo.lock and retained with original license notices. Texts/notices for all 27
packages and the source availability statement are versioned under third-party/rust.
Tauri bundles that directory as Contents/Resources/licenses/rust so the notices and
MPL sources accompany the app. This prepares compliance artifacts now; signing and
notarization remain SETUP014/017 work and real isolation evidence is not waived.

Changes to shared license/CI/config files and native bundle resources are necessary
to implement this explicit approval. No dependency version, vulnerability severity,
release-age requirement, source restriction or unrelated license is relaxed.

The native beforeBuildCommand runs the root license gate before building the UI,
so packaging also refuses missing/tampered notices or source archives. The static
Tauri guard pins this integration and the exact resource destination. A native
regression compares all five copied archives byte-for-byte and checks all 29 notice
files plus the source availability statement. The expanded real Git config tests
have a 30-second bound to cover the added protected license files.
