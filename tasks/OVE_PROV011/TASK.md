---
id: OVE_PROV011
title: Implement the Codex CLI profile and provider (login by callback, resume, text-only mode)
area: PROV
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_PROV010, OVE_PROV034, OVE_TEST006]
soft_depends_on: [OVE_PROV014, OVE_PROV017, OVE_TEST006]
provides: ["adapter:CodexProvider", "lib:codex-cli-profile"]
needs: ["adapter:CliModelProvider", "contract:CliProfile", "lib:fake-cli-scenarios", "port:Clock", "port:Logger"]
owns:
  - packages/adapters/providers/src/codex/**
  - docs/providers/codex-cli.md
reads: ["docs/research/prototyp-wnioski.md", "packages/adapters/providers/src/cli/", "tools/fake-cli/"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 15", "SPECIFICATION 17"]
adr_refs: [7, 22, 26]
---

# OVE_PROV011: Implement the Codex CLI profile and provider (login by callback, resume, text-only mode)

## 1. Summary

Add OpenAI's Codex CLI as the second provider by writing its `CliProfile` and a thin provider on top of the generic `CliModelProvider` of PROV010. The profile captures what differs: the resume form (`codex resume <id>`), the login methods (browser sign-in needs a callback on port 1455, device code is optional), the working-directory pitfall seen in the prototype, usage and limit text, and a one-shot `exec` mode for tool-free completions.

## 2. Context

Prototype (test B): Codex 0.162.1 ran on a ChatGPT subscription inside the container and finished a task in about 10 s. "Sign in with ChatGPT" fails from a container because the browser redirects to `http://127.0.0.1:1455/auth/callback` on the Mac while the listener is in the container; the working workaround is to run `curl "<callback url>"` inside the container (BOX015, no token touches Overmind); "Sign in with Device Code" works only when enabled in the account's security settings. Codex was once started in `/` and wrote its file into the container root: working directory `/work` is mandatory (PROV027 enforces it, the profile must not undo it). herdr reported `done` for Codex without any command.

## 3. Scope (in)

- Codex `CliProfile` (launch, resume, env, login, probes, skills target, interrupt key, static capabilities and models, `textOnly`).
- `CodexProvider` as a configuration of `CliModelProvider`.
- Spike with real evidence and redacted screen fixtures (`login required`, device-code screen, permission prompt, rate limit).
- Documentation `docs/providers/codex-cli.md`.

## 4. Out of scope

- The generic provider logic (PROV010), login orchestration and callback handling (PROV014, BOX015), usage parsing (PROV017), screen rules (PROV006 profile `codex`).

## 5. Detailed requirements

1. **Capabilities:** `{ providerId: 'codex', kind: 'cli', streaming: true, tools: true, shell: true, fileEdit: true, structuredOutput: 'json', images: false, cancel: 'hard', resume: true, requiresSandbox: true, reportsLimits: true, models }`; models from the profile table (ASSUMPTION: the default model id reported by the CLI plus the ones listed by its model command; refreshed by PROV022).
2. **Launch:** `argv: ['codex', '--model', <modelId>]`; resume `['codex', 'resume', <sessionId>]` (a bare program name, never a path). The CLI is started with its approval and sandbox behaviour left at the CLI default for the container (ASSUMPTION; the CLI's own Linux sandbox may not work inside the container, which is acceptable because the container is the boundary). No bypass flag (PROV034 denies them); if the CLI cannot work without one the spike records it and the Owner decides (open question).
3. **Environment:** `CODEX_HOME=/creds/codex` (baked in the image, repeated for clarity), update check and telemetry disabled through the documented settings (names recorded by the spike), `LANG=C.UTF-8`.
4. **Login:** `methods: ['browser_callback', 'device_code']`, `callbackPort: 1455`, `startArgv: ['codex', 'login']`; preference order for the wizard: device code if enabled, otherwise browser with the callback workaround (BOX015 `forwardPort` or `loginCallbackExec`). The profile only declares the data; the flow is PROV014.
5. **Interrupt key:** per spike (ASSUMPTION `ctrl-c` is NOT used because it may exit the CLI; if only Ctrl-C interrupts, the profile sets `interruptKey: null` and `cancel` falls back to stop). `cancel` capability stays `hard` through stop.
6. **Probes:** `version: ['codex','--version']`; usage via the CLI's status command or slash command found in the spike (captured text goes to PROV017, source `per_cli`).
7. **textOnly:** `codex exec` one-shot with the read-only sandbox option and no approvals (ASSUMPTION), prompt via stdin, output as text/JSON; if the spike finds it cannot be made tool-free, omit and document.
8. **Working directory guard test:** a test with `fake-codex` scenario `starts_in_root` proves that a launch without `cwd '/work'` is impossible through this profile (the profile has no cwd field; the use case supplies it).
9. **Spike evidence:** run the pinned Codex version in an Environment; record version, working command lines, the screens named above and the observed provider hosts (feeds BOX023 evidence); store fixtures under `tools/fake-cli/screens/codex/`; write results in the doc with date and version (`verifiedAgainst`).
10. **False done:** the profile registers the rule that a Codex `done` with no command executed (no work evidence) is classified by `VerifyTurnOutcome` (PROV015) as `no_effect`; the profile contributes the "work happened" screen markers.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`CliModelProvider` (PROV010), `CliProfile` and validator (PROV034), `fake-codex` (TEST006), PROV006 `codex` rule profile, PROV015 verification. No copy of invoke or stream logic.

## 8. Architecture and code placement

`packages/adapters/providers/src/codex/{profile.ts,capabilities.ts,index.ts}`. Data-only profile plus provider construction; no cross import from `src/claude`. Registered in PROV026.

## 9. Security and safety

Same rules as PROV010: validated launch only, credentials only in `/creds/codex` and never read, callback URLs and device codes never logged (they are handled by BOX015/PROV014 under SEC009), replies untrusted and redacted, no bypass flags, `/work` fixed. The login callback port 1455 is forwarded only temporarily and only for Codex (SEC009 L-rules). Telemetry and update checks are disabled so no extra egress hosts are needed (BOX023 evidence confirms).

## 10. Errors and edge cases

- Browser callback login fails (`ERR_CONNECTION_REFUSED` on the Mac): PROV014 offers the callback workaround or device code; this profile only declares both.
- Device code disabled on the account: the CLI prints instructions; PROV006 `codex.login_required` classifies; wizard shows a localized hint without quoting CLI text.
- Codex goes `done` immediately with no command: verified as `no_effect`, not completed.
- Rate limit text variants: PROV006/PROV017 handle; here only the profile's usage probe differs.
- Version drift of the CLI: warning from PROV022 comparing `verifiedAgainst`.

## 11. Acceptance criteria

- [ ] Profile passes `validateLaunchSpec`, includes resume as a bare program name and no bypass flags.
- [ ] With `fake-codex`, the provider completes a task, and scenarios `login_required`, `done_without_command`, `rate_limit` produce `needs_login`, `no_effect` (not completed) and `limit_reached` respectively.
- [ ] `ModelProvider.contract` suite passes for Codex.
- [ ] Spike document with version, date, hosts and fixtures exists (real evidence).
- [ ] `grep` test: the Codex folder does not import from the Claude folder.

## 12. Test plan

Unit tests for profile launch/resume; integration with `FakeHerdr` + `fake-codex`; contract suite (PROV024); opt-in `real-cli` test. Command: `pnpm vitest run packages/adapters/providers/src/codex`.

## 13. Parallelization notes

Can run in parallel with PROV016 once PROV010 is merged. Own folder only. The `codex` rule profile of PROV006 and the fake CLI of TEST006 are the shared fixtures.

## 14. Open questions and assumptions

- ASSUMPTION: no bypass flag is needed for Codex inside the container; if needed, an Owner decision and an ADR are required (not decided here).
- Open: Codex model listing method; if none, a static table maintained by PR with `verifiedAgainst`.
