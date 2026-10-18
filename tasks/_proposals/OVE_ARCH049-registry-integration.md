# OVE_ARCH049: finite shared I/O integration

## Scope and authority

The root integrator approved and applied exactly these four shared paths after
actual RED, then approved the existing-target lifecycle below after scoped GREEN
and independent Standards/Spec review. The Task049 author edited no shared file.

- `tools/docs-check/files.ts`
- `tools/docs-check/files.test.ts`
- `tools/adr/files.ts`
- `tools/adr/files.test.ts`

Fatal UTF-8 decoding retains the docs reader's one-MiB bound, BOM and valid U+FFFD
behavior, canonical/symlink/device/regular-file checks and descriptor identities.
The ADR writer retains existing readers, new-target behavior and protections;
existing-target temporary cleanup now requires ownership of the created descriptor
and matching path identity. It must not remove an EEXIST collision, publish a
replaced temporary, remove another operation's file or discard the original.
No dependency, policy, runtime plugin installation or second writer was added.

## Approved existing-output lifecycle

The public generator accepts only the fixed tracked existing canonical regular
`tools/docs-check/plugin-registry.generated.ts`. It uses the bounded fatal docs
reader before passing captured prior content to the repaired ADR Files.write.
All actual Git inventory, path/source/syntax admission precedes any write. Missing,
untracked, symlinked, hardlinked or BOM-prefixed output denies; generated output
is canonical UTF-8 without a BOM and bounded to one MiB. Only existing-target
atomic replacement is allowed; the public generator never bootstraps an absent
output or falls back to direct creation. Check mode writes nothing.

The 198-byte empty output was bootstrapped exclusively through the actual renderer
after the real current Git inventory returned zero candidates. Public check and
two repeated writes preserved bytes and file identity; independent real Git-to-
TypeScript-AST comparison passed. The normal source commit was 3c084c7, with actual
hooks and zero secret findings. Receipt:
`ove049-bootstrap-normal-source-commit-20261018.json`.
Task050 owns public CLI/consumer wiring. No Task050 file is changed here.

## Actual evidence and pending controls

- Pure renderer: actual original3 behavior RED, then unchanged3 GREEN; receipts
  `ove049-renderer-red-20261018.json` and `ove049-renderer-green-20261018.json`.
- Shared I/O: actual12 tests collected,8 passed4 semantic failures before repair
  (UTF8, foreign temporary deletion and replaced temporary publication). RED exit1
  is retained in `ove049-shared-io-red-20261018.json`.
- Integrator reports actual unchanged12 GREEN in
  `ove049-io-027-policy-green-20261018.json`, plus independent zero-finding reviews
  `ove049-shared-io-standards-20261018.json` and
  `ove049-shared-io-spec-20261018.json`.
- Owned inventory/discovery/generator: actual24 collected,3 passed21 semantic
  behavior failures at explicit unimplemented seams, not startup or collection
  errors; receipt `ove049-discovery-generator-red-20261018.json` retains exit1.
- Actual 29/29 owned tests passed after implementation. Full native typecheck
  passed. The first full lint failed 5 checks (four shared style checks and one
  owned typed-mode guard); its failure is retained. Minimal repairs kept runtime
  denial, ownership checks and assertions unchanged. Fresh full native typecheck,
  full lint and scoped format then passed, followed by 41/41 focused tests
  (29 registry + 8 shared reader + 4 shared writer). Receipt:
  `ove049-native-complete-checkpoint-20261018.json`.
- Independent whole-source Standards and Spec reviews of 3c084c7 failed on an
  output race and stale proposal evidence. Four real-I/O regressions then ran
  against unchanged production: 33 collected, 29 passed 4 failed because the public
  generator returned success after output replacement/unlink during candidate
  admission. Mutation and competing-output preservation assertions passed first.
  This actual RED is retained in `ove049-output-race-red-20261018.json`.
- The repair reuses a private strict output reader before and after asynchronous
  candidate admission, requires the fresh output to equal the ORIGINAL captured
  previous bytes before check/no-op/write, and retains the native writer's final
  previous-content guard. Competing replacements/absence deny and are preserved;
  an ordinary initially stale output remains eligible for intentional generation.
  The unchanged 33 registry tests and 12 shared tests then passed 45/45, including
  all four real admission-race regressions. Fresh full native typecheck, full
  lint and scoped formatter checks passed. Receipts:
  `ove049-native-typecheck-review-race-repair-20261018.json`,
  `ove049-native-lint-review-race-repair-20261018.json` and
  `ove049-native-focused-review-race-repair-20261018.json`.

These focused checkpoints do not themselves establish whole-task acceptance.
Rebase onto the latest DEVELOP, full normal/security gates, independent exact-head
reviews and fresh hosted CI must also be evidenced before normal finish/done and
an authorized merge. No isolated tool check proves macOS isolation or product
penetration testing.
