# ARCH001 alignment proposals and baseline drift

Status: recorded for the owning tasks; not permission to change runtime or
relax boundaries. ARCH001 changes documentation/data only.

## Existing instructions and paths

- CONVENTIONS 5 says rebase on main and only a human merges. The Owner explicitly
  requested branches from latest DEVELOP, reviewed/tested merges into DEVELOP,
  and parallel independent tasks. That session instruction takes precedence for
  this work; no repository protections or production settings are bypassed.
  OVE_SETUP013/018 and the documentation owners should align the generic wording.
- CONVENTIONS names docs/GLOSSARY.md, but the actual source is root GLOSSARY.md.
  OVE_OSS005 owns translation/alignment. ARCH001 links the existing root file.
- CONVENTIONS/PLAN describe a not-yet-built repository. Seventeen npm workspaces
  now exist, mostly with placeholder exports. ARCH001 explicitly separates
  current scaffold state from the target, without changing those source files.
- ARCH001 requests 400-700 lines although the generic task size guidance is
  roughly 400 changed non-test lines. The task-specific document size takes
  precedence; no additional product capability is introduced.

## Package manifest alignment before boundary enforcement

At baseline e8a300ffc45e38a0ba7bd5123d88f78e23a43918:

| Owner                                       | Drift to address without relaxing the target                                                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OVE_SETUP016, OVE_ENGINE002                 | apps/engine declares api-client and ui-kit, both forbidden in its target row. Remove unused scaffold dependencies or file an ADR for any proposed real use.                                 |
| OVE_TG013, OVE_ENGINE020                    | Telegram declares domain, lacks api-client and only has the application root export available. Use contracts, api-client and application/ports; no direct use-case import.                  |
| OVE_ARCH006/012/009                         | application currently exports only ".". Add the explicit "./ports" entry and generated public barrel; adapters' existing application dependency must be restricted to that entry in source. |
| OVE_ARCH004/005/007/013/014/015, OVE_SEC002 | system/logging/i18n/service-macos are planned catalogue entries, not created packages. Their owners coordinate minimal package manifests/references before first implementation.            |
| OVE_TEST002                                 | testing is planned and test-only; do not add it to production imports or re-export it from production modules.                                                                              |

ARCH002's first enforcement must report the actual manifest/import drift.
ARCH001 does not waive it, claim its fixtures exist, or manufacture a passing
architecture job. Owning tasks must correct source manifests before a green
production gate can be claimed.

## Schema and rule interpretations for ARCH002

Use exactly the version-1 keys in ARCH001; no undocumented exceptions field.
The -1 layer value denotes packages/content outside L0-L4, not a new layer.
Rust shell/Skill/tool entries are in the complete catalogue; only npm workspace
entries require package.json. Rust remains outside ARCH002's TS analysis.
Longest-prefix matching selects the Rust subtree independently of the webview.

The JSON is deny-by-default for Tauri packages. ARCH002 requirement 5 explicitly
permits imports only in apps/desktop/src/shared/platform/tauri/**; its checker
must apply that specified source-location rule. The current schema cannot encode
conditional file exceptions, and this document does not add an unsupported key
or grant a blanket desktop Tauri allowance.

The generic "nothing imports apps" ceiling and toolsMayImportAny coexist:
the flag describes the matrix's library columns; app roots remain non-library
entrypoints. Tools can inspect app files as data and same-app tests exercise
their own app. If a tool truly needs executable app reuse, propose an explicit
interpretation/ADR instead of quietly treating a CLI entrypoint as a library.

Testing support may depend on contracts/domain and application/ports.
Only test files and package test-support folders can consume it; nested adapter
test-support paths must be covered. No version-1 matrix cell grants a type-only
exception; import type cannot bypass N.

## Cross-task contradictions requiring owner coordination

- ENGINE019 says api-client has zero Node imports, but ENGINE021 explicitly owns
  a Node socket implementation exported at @overmind/api-client/node.
  Keep the default/browser core Node-free and test export/bundle isolation;
  ENGINE019/021 should align wording. This is not a Node dependency in the UI.
- ENGINE009 wants the Node client for ensure-running, while the engine matrix row
  denies api-client. ENGINE009/021 and composition owners must coordinate a port
  or propose an ADR if an engine-owned CLI truly needs the client; no undocumented
  per-command exception is added here.
- ENGINE020 owns the in-process gateway binding. It must be injected from engine
  composition rather than importing gateway/application into api-client or
  letting Telegram call use cases directly (ARCH001 matrix).
- ENGINE021 asks to reuse ARCH005 socket resolution, but api-client may not
  import application/system adapters. Its owners must share a permitted pure
  contract/helper or inject the resolver; no hidden cross-layer import.
- ARCH004's context mentions a UI file sink; the UI filesystem prohibition wins.
  Route UI diagnostics through the gateway or its mock seam instead.
- ARCH015 refers to ARCH004 redaction helpers, but adapters may not import each
  other or application/logging. Coordinate a permitted pure helper or injected
  capability through ports; never import the logging adapter into i18n.
- PLAN/ARCH001 name skills/overmind; SKILL012 owns
  packages/skills-builtin/overmind/SKILL.md. SKILL012/013 and the documentation
  owners must choose one canonical content path and update the catalogue/data
  together before it is created. ARCH001 records the required PLAN path and
  does not create a new importable skills package.
- SKILL012 describes an agent credential in an environment string, while
  ARCH001/ARCH012 prohibit raw secrets across ordinary ports and prohibit
  secrets in Sandbox env. ENGINE028, SKILL012/013 and SEC003 must align a
  restricted, in-memory credential handoff/relay and its leakage tests before
  implementing the helper. Neither the Skill text nor an env variable grants
  rights; no general Owner token is exposed to a container or webview.
- SEC001 enumerates 12 TB identifiers although its acceptance prose says 11.
  ARCH001 preserves all 12, including its nine required identifiers, without
  renumbering. SEC001 should fix the count while keeping IDs stable.

These are engineering alignment proposals, not new feature requests or accepted
policy exceptions. Link future owning fixes back to this record.

## Shared documentation links

OSS004 owns docs/architecture/README.md; the parent may link ARCHITECTURE.md,
boundaries.json and the four diagrams there after this document exists.
No edits to that file or to AGENTS.md/CONTRIBUTING.md are made by ARCH001.
The parent coordinates any required root links through the owning task after
its dependent integration is merged.
