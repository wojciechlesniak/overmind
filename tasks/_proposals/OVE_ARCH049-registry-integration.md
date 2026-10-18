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

The initial empty output will be bootstrapped through the actual renderer only
after actual current Git inventory verification. It has not yet been created.
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
- Minimal owned implementation is now prepared after that RED. Five additional
  cases cover BOM/symlink/hardlink/untracked output refusal and independent real
  Git-versus-TypeScript-AST import/key comparison across tracked add/remove. They
  have not run. Original24 assertions and native budgets/retry0 remain unchanged.

No whole-task acceptance item is checked. Actual owned GREEN, remaining denial and
race proof, native format/typecheck/lint, full normal/security gates, independent
exact-head Standards/Spec review and fresh hosted CI remain required before the
normal public finish/done and authorized DEVELOP merge. No isolated tool check
proves macOS isolation or product penetration testing.
