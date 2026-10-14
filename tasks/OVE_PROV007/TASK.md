---
id: OVE_PROV007
title: Generate and install Overmind detection rules for herdr (needs-login, selection prompt)
area: PROV
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH012, OVE_PROV004, OVE_PROV006, OVE_SETUP015]
soft_depends_on: [OVE_BOX002]
provides: ["lib:herdr-detection-rules", "lib:herdr-rules-generator"]
needs: ["lib:herdr-bundle", "port:Sandbox", "lib:redaction"]
owns:
  - packages/adapters/herdr/src/detection-rules/**
  - tools/herdr/gen-detection-rules.ts
  - docs/providers/herdr-detection-rules.md
reads: ["packages/domain/src/prov/terminal-state/profiles/", "docs/research/box-channels-spike.md", "vendor/herdr/"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 17"]
adr_refs: [20, 26]
---

# OVE_PROV007: Generate and install Overmind detection rules for herdr (needs-login, selection prompt)

## 1. Summary

herdr lets the host supply local detection manifests that override its own. Overmind generates such manifests from the same rule profiles that PROV006 uses (one source of truth) so that herdr itself reports the "login expired" and "CLI choice dialog" screens as `blocked` instead of a false `done`. The files are installed into every Environment at session start, and herdr's remote manifest updates stay disabled.

## 2. Context

Prototype 5A: herdr reported `done` while Claude showed `401 OAuth access token has expired, please run /login` and the "Set up auto mode for your environment?" dialog; its `blocked` rule covers only action-permission dialogs. herdr supports local manifests (TOML with regex rules, fragment of screen, OSC title, priority) under `~/.config/herdr/agent-detection/`, with local overrides winning over remote ones. Overmind's own classifier (PROV006) is the primary defence; these manifests make herdr's hint better so that the herdr-side `blocked` also protects its own `agent.prompt --wait` gate. herdr's remote manifest updates are not allowed (Spec 13 pattern: no remote rule update without Owner control; SETUP015 disables it, and `herdr.dev` is not on the egress list).

## 3. Scope (in)

- Generator that turns PROV006 profiles (`claude`, `codex`) into herdr manifest TOML.
- Installer that writes the files into the Environment's tmpfs home at session start (through `Sandbox.exec`).
- Verification that herdr loaded them (`herdr agent explain` or equivalent).
- Documentation of the format and the update procedure.

## 4. Out of scope

- The rule profiles and the classifier (PROV006). Pulling remote manifests (explicitly not done). Handling the states (PROV013 dialogs, PROV014 login).

## 5. Detailed requirements

1. **Single source:** the generator imports the profile objects from `packages/domain/src/prov/terminal-state/profiles/*` and emits one TOML per CLI: `agent-detection/claude.toml`, `agent-detection/codex.toml`. Each rule keeps the profile rule id as a comment and as the herdr rule name (`overmind.claude.login_expired`). No regex is written by hand in TOML. A CI check regenerates and fails on diff (`pnpm herdr:rules --check`).
2. **Mapping:** profile rules `login_expired`, `login_required`, `choice_dialog`, `rate_limit` map to herdr state `blocked` with an evidence label, higher priority than herdr's built-in rules; the permission dialog stays herdr's own rule (it works, prototype 5A). Position constraints (match must be near the bottom) are expressed as herdr's bottom-N-lines option if available, otherwise only enforced by PROV006 and noted in the doc.
3. **Capture of the format:** the exact manifest schema (field names, priority semantics, location variable) is taken from the herdr version pinned in `vendor/herdr/VERSION` and the spike (BOX002: which directory is read and how `HOME` is set inside the Environment). The generator has one `HerdrManifestFormat` adapter object per pinned version; an unknown version fails the generation (no guessing).
4. **Install:** at session start (called by PROV027) `installDetectionRules(envId)` writes the generated files to the manifest directory inside the Environment (tmpfs `HOME`) via `Sandbox.exec` (`argv` = `['/bin/sh','-c','mkdir -p ... && cat > ...']` with file content passed on stdin, never interpolated into argv). Files are written mode 0644, owner `agent`; existing files are replaced, unknown files in that directory are left alone but reported.
5. **Verify:** after install call `herdr agent explain` / `integration.status` through the client (or the schema's equivalent) and check that the rule names are loaded; a failure yields a warning `prov.rules_not_loaded` and the session still starts (Overmind's own classifier remains active), recorded as a degraded flag on the session.
6. **Remote updates:** the environment variable or setting that disables remote manifest download is asserted to be set (constant from SETUP015); the installer refuses to start the herdr server through this path when it is unset. The egress allowlist contains no herdr host (test in BOX011/BOX023).
7. **Versioning:** a header comment in each file records `generated-by`, herdr version and profile versions (CLI versions the rules were captured from). PROV022 warns when the installed CLI version differs from the profile version.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Profiles and rule ids of PROV006; `Sandbox.exec` (ARCH012, BOX010); `HerdrClient` (PROV004) for explain; constants from SETUP015. Do not duplicate regexes.

## 8. Architecture and code placement

`packages/adapters/herdr/src/detection-rules/{generate.ts,formats/<herdr-version>.ts,install.ts,verify.ts}` plus `tools/herdr/gen-detection-rules.ts` (dev CLI and `--check`). The installer is an adapter that receives `Sandbox` as an injected port. Generated files are build artefacts compiled into the package as strings; nothing is read from the network.

## 9. Security and safety

Rule files are code-adjacent configuration: they are generated from reviewed profiles, shipped inside the app, written only into the tmpfs home of an Environment and never fetched remotely, so a hostile site cannot alter detection. Regexes are bounded (the PROV006 ReDoS rules apply) so a hostile screen cannot hang herdr. The manifests only make herdr more conservative (more `blocked`); they cannot approve anything. File content travels over stdin so no Agent-controlled data reaches an argv.

## 10. Errors and edge cases

- herdr version not supported by any `HerdrManifestFormat`: generation fails in CI; at runtime the installer skips with `prov.rules_not_loaded` and the classifier keeps working.
- Directory not writable (read-only root misconfiguration): warning plus degraded flag; BOX smoke tests catch this earlier.
- A herdr update changes the manifest schema: format adapter updated by PR with fixtures.
- Rules loaded twice (restart): idempotent overwrite.

## 11. Acceptance criteria

- [ ] Generated TOML for both CLIs matches golden files; `--check` fails when a profile regex changes without regeneration.
- [ ] With `FakeHerdr`, the installer writes both files and verification finds the rule names; a fault `rulesIgnored` yields the warning, not a failure.
- [ ] Installer passes file content on stdin (assert argv contains no rule text).
- [ ] Starting without the remote-manifest-disable constant is refused.
- [ ] Doc lists format fields, location, update procedure.

## 12. Test plan

Golden-file tests for the generator; unit tests for the installer with a fake `Sandbox`; integration with `FakeHerdr`; one opt-in real-herdr test (tagged `real-herdr`) that checks `herdr agent explain` shows the login rule on a recorded screen. Command: `pnpm vitest run packages/adapters/herdr/src/detection-rules`.

## 13. Parallelization notes

Independent of PROV005; needs PROV006 profile files stable. Conflict hotspot: none (own folder). PROV022 reads the version header.

## 14. Open questions and assumptions

- ASSUMPTION: herdr's local manifest directory is relative to `HOME` and `HOME` is the tmpfs `/home/agent`; BOX002 confirms.
- Open: whether herdr's manifest format can express "only in the last N lines"; if not, the manifest rules may over-block stale scrollback, which is the safe direction.
