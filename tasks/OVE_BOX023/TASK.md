---
id: OVE_BOX023
title: Provide the reviewed provider host list (lib:provider-hosts) as one shared contract
area: BOX
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH008, OVE_BOX011]
soft_depends_on: [OVE_BOX012, OVE_BOX015]
provides: ["lib:provider-hosts"]
needs: ["lib:contract-pipeline"]
owns:
  - packages/contracts/src/sandbox/provider-hosts.schema.ts
  - packages/contracts/src/sandbox/provider-hosts.data.ts
  - tools/sandbox/sync-provider-hosts.ts
  - docs/sandbox/provider-hosts.md
  - tasks/_proposals/OVE_BOX023-provider-hosts-json.md
reads: ["packages/adapters/sandbox-macos/allowlist/provider-hosts.json", "docs/research/prototyp-wnioski.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 11", "SPECIFICATION 17"]
adr_refs: [20, 21, 22]
---

# OVE_BOX023: Provide the reviewed provider host list (lib:provider-hosts) as one shared contract

## 1. Summary

The CLIs (`claude`, `codex`) must reach their providers while every other domain needs an Owner Approval. Three places need the same host list: the egress proxy (BOX011), the mount/egress plan builder (PERM017) and the Permission Profile "Development" (PERM011). This task makes the list one reviewed, typed, evidence-backed contract in `packages/contracts` so nobody keeps a copy.

## 2. Context

Prototype finding 3.2.4: the VM needs a host allowlist with providers allowed up front and everything else subject to an Approval (ADR 0021, new domain). BOX011 already ships `allowlist/provider-hosts.json` inside the sandbox adapter, but PERM (application layer) may not import an adapter (Clean Architecture, CONVENTIONS section 6), and PERM017 and PERM011 need the list under the capability name `lib:provider-hosts`. `herdr.dev` must never appear (remote manifests are disabled, SETUP015). Login hosts are a subset needed only while the Owner logs in (SEC009).

## 3. Scope (in)

- Zod schema `ProviderHostList` and the canonical typed data object `PROVIDER_HOSTS`.
- Pure accessors `providerHostsFor(providerId)`, `allProviderHosts()`, `loginHostsFor(providerId)`.
- A sync tool and CI check that keep BOX011's JSON identical to the contract.
- Evidence document listing, per host, which CLI phase needs it and how it was observed.

## 4. Out of scope

- Matching logic and proxy behaviour (OVE_BOX011); per-Environment policy composition (OVE_PERM017); Owner approvals for new domains (OVE_BOX013); the Ollama host (it is called by the engine on the host, never from inside an Environment, PROV016).

## 5. Detailed requirements

1. **Schema:** `ProviderHostList = { version: 1; reviewedOn: ISODate; providers: Record<'claude'|'codex', { hosts: HostName[]; loginHosts: HostName[]; notes?: string }> }`. `HostName` = lowercase ASCII/punycode FQDN, 4..253 chars, labels 1..63, no wildcard, no IP literal, no port, no scheme. `loginHosts` MUST be a subset of `hosts`.
2. **Data (ASSUMPTION until verified by evidence):** `claude`: `api.anthropic.com`, `claude.ai`, `console.anthropic.com`, `platform.claude.com`; `codex`: `api.openai.com`, `chatgpt.com`, `auth.openai.com`. `loginHosts`: `claude.ai`, `console.anthropic.com`, `platform.claude.com`; `auth.openai.com`, `chatgpt.com`. The implementer verifies each host by running the real CLI (start, one model call, login) in an Environment whose policy is `allowlist` with `onNewHost: 'block'`, and records the blocked/allowed hosts from the BOX011 decision log in `docs/sandbox/provider-hosts.md` (table: host, CLI, phase, evidence date, CLI version). A host without evidence is removed.
3. **Accessors:** `providerHostsFor(id: 'claude'|'codex'|'ollama'|string): readonly HostName[]` returns the hosts for known CLI providers and an empty array for anything else (`ollama`, unknown ids), never throws. `allProviderHosts()` returns the sorted union. `loginHostsFor(id)` returns the login subset. Returned arrays are frozen.
4. **Invariants (unit tests):** no wildcard entries; no `herdr.dev`, `localhost` or IP literal; no package registry (`registry.npmjs.org`, `github.com`) and no telemetry hosts; at most 12 hosts per provider; sorted and de-duplicated; every `loginHosts` entry is in `hosts`.
5. **Sync tool:** `tools/sandbox/sync-provider-hosts.ts` writes `packages/adapters/sandbox-macos/allowlist/provider-hosts.json` from `PROVIDER_HOSTS` (stable key order, trailing newline). CI runs it with `--check`; a diff fails the build with the message "edit packages/contracts/src/sandbox/provider-hosts.data.ts and run pnpm sandbox:sync-hosts". After this task the JSON file is generated; the proposal file `tasks/_proposals/OVE_BOX023-provider-hosts-json.md` asks the BOX011 owner to load the generated file (or import the contract through the composition root) and to stop editing it by hand.
6. **Change control:** the data file carries the header "reviewed list, change by PR only, with evidence". CODEOWNERS (OSS003) lists security reviewers for this path. The runtime never writes the list; there is no setting, API route or Agent action that edits it (Owner-approved new domains live in policy, PERM, not here).
7. **Docs:** `docs/sandbox/provider-hosts.md` explains why updates to the CLI can add hosts, the procedure to re-verify after a CLI version bump (also run by the terms/version check PROV023), and that blocked hosts surface as `sandbox.egress_blocked` Approvals (BOX013) instead of silent failures.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Contracts pipeline (ARCH008) for the schema; decision log of BOX011 as the evidence source; `docs/sandbox/` layout from BOX022.

## 8. Architecture and code placement

Contract layer only: `packages/contracts/src/sandbox/{provider-hosts.schema.ts,provider-hosts.data.ts}`; no I/O, no dependency on adapters, so PERM (application) and BOX (adapter) both depend downward on it (DIP). The tool in `tools/sandbox/` is dev-only. Matching (`exact` or `*.suffix`) stays in BOX011/PERM004; this task deliberately exports no matcher, so there is one implementation.

## 9. Security and safety

The list is an allowlist that widens network reach for every Agent, so it is minimal, explicit and reviewed. No wildcards on provider apex domains (a wildcard like `*.openai.com` would include user-content hosts and enable exfiltration). Unknown provider id yields an empty list (deny by default). The list cannot be changed at runtime or by any Agent, Skill or document. A malicious change is caught by the invariants test and the CODEOWNERS review. Provider hosts are reachable only through the proxy, which still blocks private addresses and rebinding (BOX011).

## 10. Errors and edge cases

- CLI update starts using a new host: calls fail, BOX013 raises a new-domain Approval; the fix is a reviewed PR with evidence, never a permanent runtime bypass.
- `providerHostsFor('ollama')`: empty array (local model, no Environment egress needed).
- JSON out of sync: CI check fails; the proxy keeps using the checked-in JSON until fixed.
- A host that serves both provider and user content: not added; documented as a decision in the doc.

## 11. Acceptance criteria

- [ ] Given the data object, When the invariants test runs, Then it passes and rejects a fixture with a wildcard, an IP, `herdr.dev` or a duplicate.
- [ ] `providerHostsFor('claude')`, `('codex')`, `('ollama')`, `('x')` return the expected arrays (the last two empty).
- [ ] `sync-provider-hosts --check` passes on a clean tree and fails after hand-editing the JSON.
- [ ] `docs/sandbox/provider-hosts.md` has an evidence row for every host with CLI version and date (real observations, SPEC 19.5).
- [ ] PERM017 and BOX011 can import the contract without importing any adapter (boundary lint passes).

## 12. Test plan

Unit: schema and invariants, accessors, frozen arrays. CI script test for the sync check. Manual evidence run documented in the doc. Command: `pnpm vitest run packages/contracts/src/sandbox`.

## 13. Parallelization notes

Can start as soon as BOX011 is merged; PERM017 and PERM011 may stub the capability with a constant until then. Hotspot: the JSON file (generated here, listed in the proposal for BOX011).

## 14. Open questions and assumptions

- ASSUMPTION: the host data in requirement 2 is correct; evidence may add or remove hosts (for example a Claude Code telemetry or OAuth host). Telemetry is disabled through CLI environment variables (PROV010/011), not allowlisted.
- Open: Codex device-code login hosts if the Owner enables that method.
