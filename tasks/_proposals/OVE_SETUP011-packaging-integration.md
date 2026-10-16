# SETUP011 packaging decision and dependency matrix integration

The Owner explicitly authorized completing tasks in order, independent reviews
and passing merges to DEVELOP. SETUP011 requires a decision ADR and updates to
SETUP008's six compatibility rows after its merge. This proposal records that
necessary shared-doc integration; it grants no new license, runtime split,
installation script, credential use or production dependency.

The report and accepted ADR record the actual pinned Node SEA/node:sqlite experiment,
three shortlisted candidates and explicit unavailable signing/TCC measurements.
The compatibility rows below replace the former candidate notes for later owning
tasks. This is a documented decision, not a dependency installation or new license
approval. The report records unmeasured release evidence and the time-cap overrun.
All dependency installations and probe code remain on spike/OVE_SETUP011,
which is retained and never merged into DEVELOP. Exact output/commit evidence
are referenced from the documentation PR.

| Input | Decision | Owning-task implication |
| --- | --- | --- |
| better-sqlite3 13.0.3 | Fallback only | Built-in gates passed; not adopted. Same-Team-ID addon loading must pass before any fallback ships. |
| node:sqlite in 22.23.3 | Selected default | DATA supplies a driver-neutral adapter; TEST checks the same Node runtime. |
| bun 1.4.3 | Rejected for product runtime | No runtime split approval or binary-license exception; benchmark alone is insufficient. |
| postject 1.0.0-alpha.6 | Selected build tool | SETUP017 pins injection tool and preserves provenance/licenses; alpha risk remains. |
| @yao-pkg/pkg 6.23.0 | Rejected | Extra packaging abstraction/graph unnecessary for the single bundled entry. |
| esbuild 0.28.2 | Selected build tool | SETUP016 bundles CommonJS with maps/metafile; no install scripts enabled here. |

The verified shared resource downloader is reused for official Node/Bun archives.
The generic tar binary selector also matches Node's include/node/ directory;
the experiment selects the exact bin/node member from the verified archive.
SETUP017 must retain equivalent bounded, checksum-verified extraction rather
than bypassing the downloader or trusting an unverified global runtime.

The host has no Developer ID Application identity. Ad-hoc checks cannot establish
same-Team-ID addon loading, notarization or general protected-folder consent.
No disable-library-validation entitlement is added. SETUP014 keeps all of its
release gates and the approved SETUP006 physical-isolation requirements.
