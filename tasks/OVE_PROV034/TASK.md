---
id: OVE_PROV034
title: Define the CliProfile contract, launch validator, profile registry and TextCompletion port
area: PROV
kind: contract
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_PROV001, OVE_PROV006]
soft_depends_on: [OVE_BOX005]
provides: ["contract:CliProfile", "lib:cli-profile-registry", "lib:launch-spec-validator", "port:TextCompletion"]
needs: ["lib:result", "lib:error-catalogue", "contract:ModelRef"]
owns:
  - packages/contracts/src/provider/cli-profile.schema.ts
  - packages/application/src/provider/cli-profile/**
  - packages/application/src/ports/TextCompletion.ts
reads: ["docs/research/prototyp-wnioski.md", "docs/adr/0022-oficjalne-cli-jak-herdr.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 11"]
adr_refs: [7, 20, 22, 26]
---

# OVE_PROV034: Define the CliProfile contract, launch validator, profile registry and TextCompletion port

## 1. Summary

All knowledge that differs between the official CLIs (binary name, safe flags and environment, how to resume, which key interrupts, where Skills go, which login methods exist, which probes detect version and login state) lives in one data-like `CliProfile` per CLI. Session start, Skill installation, login, detection and the providers read profiles instead of branching on provider names (OCP). A validator guarantees that no profile can produce an unsafe command line.

## 2. Context

Spec 9 and ADR 0022: Overmind uses only the official CLIs, started in herdr inside the isolation, and never sees credentials. Prototype findings: the CLI must start in `/work`; the resume command must be a bare program name from `PATH`; Codex browser login needs a callback forward to port 1455 while Claude uses a pasted code; CLI config directories are `CLAUDE_CONFIG_DIR=/creds/claude` and `CODEX_HOME=/creds/codex` (BOX005). PROV006 holds the screen rule profiles; this contract references them by id.

## 3. Scope (in)

- Zod schema `CliProfile` and sub-structures; TypeScript helper to build profiles.
- `validateLaunchSpec(spec)` rules and a registry (`CliProfileRegistry`, lookup by `ProviderId`).
- Optional `textOnly` launch for one-shot, tool-free completions and the `TextCompletion` port that Discussion and summariser adapters use.
- Documentation of how to add a CLI.

## 4. Out of scope

- The concrete Claude and Codex profiles (PROV010, PROV011), screen rules (PROV006), the use of profiles (PROV012, PROV014, PROV022, PROV027).

## 5. Detailed requirements

1. **Shape (excerpt):**
   ```ts
   CliProfile = {
     id: 'claude'|'codex'|string; displayName: string; binary: string /* bare name, ^[a-z][a-z0-9_-]{0,31}$ */;
     screenProfile: string;                                    // PROV006 rule profile id
     launch(ctx: { model: ModelRef; resume?: { sessionId: string } }): LaunchSpec;  // pure
     interruptKey: 'esc'|'ctrl-c'|null;
     configDir: string;                                        // e.g. '/creds/claude'
     skills: { dir: string | null; layout: 'skill-dir' };       // PROV012 target, null = prompt-block only
     login: { methods: ('paste_code'|'device_code'|'browser_callback')[]; callbackPort?: number; startArgv: string[] };
     probes: { version: string[]; loginStatus?: string[]; models?: string[]; usage?: { argv: string[] } | { slash: string } };
     env: Record<string, string>;                              // safe, non-secret (telemetry off, autoupdate off)
     capabilities: ProviderCapabilities;                       // PROV001, static part
     textOnly?: { launch(ctx: { model: ModelRef }): LaunchSpec; promptVia: 'stdin'; outputFormat: 'text'|'json' };  // one-shot, tools disabled (ASSUMPTION per CLI, verified in PROV010/011)
     verifiedAgainst: { cliVersion: string; on: ISODate };     // the version the rules and flags were captured from
   }
   LaunchSpec = { argv: string[] /* argv[0] === binary */; env: Record<string, string> }
   ```
2. **TextCompletion port** (one file, used by PROV031 and PROV032, implemented by CLI providers and Ollama):
   ```ts
   interface TextCompletion {
     complete(req: { providerId: ProviderId; modelId: string; workspaceId: WorkspaceId; agentId?: AgentId;
       purpose: 'discussion_turn'|'summary'|'compaction'; prompt: string /* opaque, assembled per SEC004, <=200 KiB */;
       timeoutMs: number; maxOutputChars: number }, opts?: { signal?: AbortSignal }
     ): Promise<Result<{ text: string; modelRef: string; usage?: ModelUsageDraft; truncated: boolean }, AppError>>;
   }
   ```
   `complete` is tool-free by definition: an implementation that cannot guarantee that (profile without `textOnly`) returns `provider.capability_missing` instead of falling back to an interactive session. The result text is untrusted data.
3. **Validator rules (each tested):** `argv[0]` equals `binary`; every element is a string of at most 512 chars without NUL or newline; the model id passes `^[A-Za-z0-9._:/@-]{1,100}$` and is placed as a single element right after its flag; no element may equal or start with a denied flag from `DENIED_FLAGS` (`--dangerously-skip-permissions`, `--dangerously-bypass-approvals-and-sandbox`, `--yolo`, `--add-dir` with a path outside `/work`, `--config` overriding sandbox or approval keys, `--mcp-config`, `--settings`); the resume element must match `^[A-Za-z0-9_-]{8,128}$`; env keys match `^[A-Z][A-Z0-9_]{0,63}$`, values at most 256 chars and none may contain a path outside `/work`, `/creds`, `/home/agent`, `/opt/overmind`, `/run/overmind`; no key may be in the `SECRET_ENV_DENYLIST` (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `*_TOKEN`, `*_SECRET`); no proxy variables (they are BOX runtime values).
4. **Resume form:** `launch({ resume })` returns the CLI's own resume argv built only from `binary` and the validated id (for example `[binary, '--resume', id]` or `[binary, 'resume', id]` as the profile defines); never a path, never a shell string.
5. **Registry:** `CliProfileRegistry { register(profile): Result<void>; get(id): Result<CliProfile>; list() }`; registration runs the validator against sample contexts and refuses invalid profiles (`provider.not_found` for unknown ids). Profiles are registered by the provider module (PROV026) at composition time; no dynamic loading from disk or network.
6. **Staleness:** `verifiedAgainst.cliVersion` is compared with the detected version by PROV022; a mismatch is a warning with the profile's date, never a failure.
7. **Docs:** `docs/providers/adding-a-cli.md` lists the steps and the security rules (new CLI means new profile, new screen rule profile, new provider hosts entry reviewed in BOX023, new fixture screens in TEST006).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ProviderCapabilities`, `ModelRef`, errors (PROV001), screen profile ids (PROV006), error model (ARCH003).

## 8. Architecture and code placement

Schema in `packages/contracts/src/provider/cli-profile.schema.ts`; builder, validator and registry in `packages/application/src/provider/cli-profile/{validate.ts,registry.ts,denied.ts,define-profile.ts}`. Pure code, no I/O. Concrete profiles live in `packages/adapters/providers/src/<cli>/profile.ts` (PROV010/011), keeping CLI knowledge in adapters and the rules in the application layer.

## 9. Security and safety

The profile is the only place where a command line for an agent CLI is built, so unsafe flags cannot appear by accident: bypass flags, extra directories, MCP configuration, settings overrides, secret environment variables and proxy variables are rejected by construction. Model ids are validated and never interpolated into a shell string. Registration fails closed. A malicious repository or Agent cannot influence a profile because profiles are code compiled into the app.

## 10. Errors and edge cases

- Model id starting with `-` (would look like a flag): rejected by the regex (first character must be alphanumeric).
- Profile for a CLI without resume support: `launch({ resume })` returns an error `provider.capability_missing` (`resume`).
- Two profiles with the same id: registration error.
- Unknown extra fields in a profile: stripped by the schema (strict mode off for forward compatibility, but the validator ignores them).

## 11. Acceptance criteria

- [ ] A table of hostile launch specs (bypass flag, path binary, `--add-dir /`, secret env, proxy env, newline in an element, model id `--x`) is rejected with a specific rule id each.
- [ ] A valid profile registers and `get('claude')` returns it; invalid registration fails.
- [ ] Resume argv is built only from binary and a validated id.
- [ ] Contract appears in the snapshot and passes additive-only check.

## 12. Test plan

Unit table tests for the validator and registry; schema tests; property test: for random valid model ids and resume ids the output passes validation and for ids with forbidden characters never. Command: `pnpm vitest run packages/application/src/provider/cli-profile packages/contracts/src/provider`.

## 13. Parallelization notes

Merge early (PROV010, PROV011, PROV027 import it). Additive changes only.

## 14. Open questions and assumptions

- ASSUMPTION: no CLI bypass flags in the MVP; Agents run in the CLI's default (auto) mode inside the container and CLI permission windows become Approvals (ADR 0022). Whether to allow a bypass flag later is an Owner decision.
- Open: how Claude Code and Codex report usage (slash command or subcommand) is captured by the profile probes in PROV017.
