# SETUP010 merge block: the pinned Tauri graph exceeds the license allow-list

Status: blocked; no policy change or license exception is approved or applied.
The Owner's instruction to retain the current policy and merge block remains in force.
Approval of staged SETUP006 isolation evidence does not waive license requirements.

On 2026-10-16 the existing, checksum-verified cargo-deny 0.20.2 command rejected
six packages in the actual SETUP010 Cargo.lock. Sources and dependency bans passed.

| Package | Locked version | Declared license | Required dependency chain |
| --- | --- | --- | --- |
| cssparser | 0.37.0 | MPL-2.0 | tauri-utils → dom_query → cssparser |
| cssparser-macros | 0.7.1 | MPL-2.0 | cssparser → cssparser-macros |
| dtoa-short | 0.3.5 | MPL-2.0 | cssparser → dtoa-short |
| selectors | 0.38.0 | MPL-2.0 | tauri-utils → dom_query → selectors |
| option-ext | 0.2.0 | MPL-2.0 | dirs → dirs-sys → option-ext |
| target-lexicon | 0.12.16 | Apache-2.0 WITH LLVM-exception | GTK system-deps → cfg-expr (Linux branch) |

The first five are also reachable in the actual macOS arm64 graph. They are part
of Tauri's required dependency closure, including its build-time asset processing;
removing the optional shell/dialog plugins does not remove the CSS dependency chain.
The sixth is in the all-platform lockfile inspected by the unchanged license gate.

Reproduce from the repository root:

```sh
pnpm exec tsx tools/pinned-bin/install.ts cargo-deny
# Execute the returned verified path:
<verified-cargo-deny> --manifest-path apps/desktop/src-tauri/Cargo.toml check licenses bans sources
```

The exact manifests and license texts are available in the crate archives named by
Cargo.lock; primary metadata endpoints are `https://crates.io/api/v1/crates/<name>/<version>`.
No direct dependency version or exact upstream pin was changed to hide the problem.
The full locked graph was checked for the 72-hour release-age floor and Rust <=1.90;
fresh compatible transitive versions were replaced with mature versions, including
Tauri helper crates and combine 4.6.8. No release-age bypass was added.

The code, negative security tests, native compilation and independent reviews can
be completed while blocked. SETUP010 must remain unmerged and its issue open until
a license-compatible dependency graph is demonstrated, or the Owner explicitly
changes the policy for an identified scope. Replacing the selected native framework
would require a separate architectural decision, not a silent implementation change.
SETUP011 cannot start under the Owner's sequential merge instruction.

Cargo-audit 0.22.2 reports no blocking vulnerabilities and two allowed upstream
warnings: RUSTSEC-2024-0370 (proc-macro-error 1.0.4, unmaintained) and
RUSTSEC-2024-0429 (glib 0.18.5, unsound). Both are absent from the resolved macOS
arm64 target graph; they remain visible in the all-platform audit. No advisory
ignore was added. This is not evidence of a physical isolation/escape test.
