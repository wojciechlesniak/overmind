# OVE_SETUP016: coordinated scaffold integration

Approved by the task orchestrator under the Owner's authorization to implement,
test, review and integrate the backlog. This records necessary shared changes;
it introduces no additional license exception or relaxed security gate.

- Add catalog `esbuild: 0.28.2`, already selected in ADR0030 and documented in
  `docs/dependencies.md`; declare it only as an engine development dependency and
  regenerate the pnpm lockfile. Keep `allowBuilds.esbuild: false`, the72-hour age
  gate and exact existing runtime versions.
- Add the engine package's explicit task scripts. Keep root scripts unchanged.
- Add `build/bundle.d.mts` as the type declaration companion for the owned
  JavaScript bundler, so strict TypeScript integration tests can import its API.
- Reuse the shared test JSON boundary; do not introduce a runtime Zod dependency
  into the CLI scaffold.
- SETUP010's Rust receipt parser originally accepted only `{status,pid,socket}`
  and rejected SETUP016's named version/protocol/detail fields. Extend only that
  receipt and its tests: preserve `deny_unknown_fields`, positive PID, exact
  expected socket and successful live ping. Accept `already_running`; supplied
  protocol other than1 reports incompatible. Missing protocol remains explicit
  compatibility with the legacy010 shape, without claiming version validation.
  Never render the receipt's untrusted detail. No new crate or Cargo lock change.
- The engine README is the command/receipt document; no earlier standalone shell
  contract document exists. ENGINE will take ownership of optional hook imports
  when adding real composition/service modules, replacing them with static imports.

Packaging, service installation, SQLite, signing and actual release isolation
remain in their owning tasks. This scaffold makes no claim that they are present.
