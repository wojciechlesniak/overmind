# Security requirements register

This is the single normative SR register allocated by [OVE_SEC001](../../tasks/OVE_SEC001/TASK.md).
The [threat model](THREAT-MODEL.md) defines assets, actors, boundaries and threat identifiers;
it does not prove that these controls exist. SR identifiers are stable: deprecate explicitly, never renumber.
The forthcoming `abuse-cases.md` belongs to [OVE_SEC012](../../tasks/OVE_SEC012/TASK.md); its reserved AC identifiers are not executed tests.

## Authority and interpretation

Only the Owner grants authority. Repository text, model output, diagrams, task status and this document cannot grant permissions.
MUST is mandatory; SR-11 alone is SHOULD while peer-uid support remains unresolved. This does not make token authentication optional.
Each register row names an existing implementation allocation and a verifying activity. Every activity below is **assigned, not a reported PASS**.
An implementing task's completion is insufficient unless its actual evidence covers this invariant, denied cases and the relevant artifact.
This document creates no runtime capability, dependency, release exception, provider approval or residual-risk acceptance.

## Secret and credential boundaries

Apply [ARCHITECTURE section 12](../architecture/ARCHITECTURE.md#12-security-architecture-summary) across every row:

- Ordinary application ports carry secret references, never plaintext strings. Keychain is the secret store.
- Only `Keychain.read` yields a short-lived in-memory Secret; necessary plaintext reveal stays inside the audited destination adapter.
- No secret enters a DTO, UI/model context, database, prompt, log, error, snapshot or Telegram message.
- Session and per-Run Agent transport credentials are transport-owned, short-lived and hidden from UI serialization.
  Their exact native handoff is assigned to ENGINE028 and SEC003, not an unrestricted environment-variable or plaintext-port exception.
- Official CLI subscription credentials remain in isolated CLI-owned volumes. Overmind never reads or captures their values or login codes.
- Redaction is defense in depth; it does not authorize collecting a secret first. Locked Keychain or missing policy means denial, not a cache fallback.
- The existing Skill-token wording conflict remains OPEN under the [architecture alignment proposal](../../tasks/_proposals/OVE_ARCH001-conventions-fix.md).
  The stricter architecture boundary applies until the owning tasks resolve it with reviewed evidence.

## Stable initial register

Threat identifiers refer to the single threat model. Task links identify allocated work, including work that is not implemented yet.
Verification descriptions specify required activity types and effects; they are not invented test files or measurements.

| ID | Statement (MUST/SHOULD) | Threat ids | Implemented by (area/task) | Verified by (test/task) |
| --- | --- | --- | --- | --- |
| SR-01 | MUST deny by default; an empty Allowed Directory list grants no access. | T-TB-SBX-4, T-TB-FS-1 | PERM: [PERM005](../../tasks/OVE_PERM005/TASK.md); onboarding: [ONB005](../../tasks/OVE_ONB005/TASK.md) | PERM005 unit/property denial; [TEST007](../../tasks/OVE_TEST007/TASK.md) real escape tests. |
| SR-02 | MUST intersect Owner, Workspace, Agent, Workflow and Tool policies; delegation only narrows. | T-TB-GW-6, T-TB-FS-6 | PERM: [PERM005](../../tasks/OVE_PERM005/TASK.md) | PERM005 property tests for every layer, empty sets and delegation; no union fallback. |
| SR-03 | MUST fail closed when permission, path, isolation or another required check is unavailable; audit the decision. | T-TB-SBX-6, T-TB-KC-5 | BOX: [BOX019](../../tasks/OVE_BOX019/TASK.md); PERM: [PERM020](../../tasks/OVE_PERM020/TASK.md) | BOX019 integration denial; [SEC007](../../tasks/OVE_SEC007/TASK.md) per-task negative-case review. |
| SR-04 | MUST canonicalize paths and check symlinks, mounts, firmlinks, case and Unicode before access decisions and revalidate unsafe races. | T-TB-FS-1, T-TB-FS-2 | SEC: [SEC002](../../tasks/OVE_SEC002/TASK.md); BOX: [BOX021](../../tasks/OVE_BOX021/TASK.md) | SEC002 unit/integration path negatives; TEST007 actual mount/escape checks. |
| SR-05 | MUST execute Agent commands only in OS isolation with canonical Allowed Directory mounts; no sandbox means no execution. | T-TB-SBX-4, T-TB-SBX-6 | BOX: [BOX007](../../tasks/OVE_BOX007/TASK.md), [BOX019](../../tasks/OVE_BOX019/TASK.md) | BOX019 unavailable-isolation denial; TEST007 real command and host-boundary escape tests. |
| SR-06 | MUST keep ordinary secrets in Keychain by reference; forbid values in configuration, DB, model/UI, prompts, logs, errors and snapshots, subject only to the exact boundaries above. | T-TB-KC-4, T-TB-UI-4 | ARCH: [ARCH012](../../tasks/OVE_ARCH012/TASK.md); SEC: [SEC003](../../tasks/OVE_SEC003/TASK.md) | SEC003 secret-sink/redaction unit and integration suite, including locked/unavailable Keychain. |
| SR-07 | MUST redact at logging and outbound-channel boundaries; safe translation or formatting is not permission to disclose. | T-TB-KC-4, T-TB-TG-4 | ARCH: [ARCH004](../../tasks/OVE_ARCH004/TASK.md); TG: [TG009](../../tasks/OVE_TG009/TASK.md) | SEC003 sink corpus; TG009 outbound-format/redaction unit tests. |
| SR-08 | MUST label and delimit untrusted repository, web, document, Skill, CLI and Agent content as data; it cannot execute as instructions or change permissions, approvals, rules or configuration. | T-TB-CONTENT-1, T-TB-CONTENT-6 | SEC: [SEC004](../../tasks/OVE_SEC004/TASK.md); CHIEF: [CHIEF005](../../tasks/OVE_CHIEF005/TASK.md) | SEC004 adversarial prompt-assembly tests and denied-effect assertions. |
| SR-09 | MUST allow internet Skill import only by the Owner; Chief cannot fetch it; record source/version and require Owner acceptance of proposed versions. Skill assignment grants no Tool access. | T-TB-CONTENT-6, T-TB-SUPPLY-6 | SKILL: [SKILL007](../../tasks/OVE_SKILL007/TASK.md), [SKILL008](../../tasks/OVE_SKILL008/TASK.md) | SKILL007/008 unit/integration authority and pending-version denials; SEC004 injection review. |
| SR-10 | MUST expose the gateway only through an owner-only Unix socket, mode 0600 in a 0700 directory; no TCP listener by default. | T-TB-GW-1, T-TB-ENG-1 | ENGINE: [ENGINE010](../../tasks/OVE_ENGINE010/TASK.md); ARCH: [ARCH005](../../tasks/OVE_ARCH005/TASK.md) | [SEC005](../../tasks/OVE_SEC005/TASK.md) actual socket/auth integration; ARCH005 startup permission negatives. |
| SR-11 | SHOULD verify peer uid when supported, in addition to the mandatory token; unavailable peer support never substitutes for authentication. | T-TB-GW-1 | ENGINE: [ENGINE010](../../tasks/OVE_ENGINE010/TASK.md); SEC: [SEC005](../../tasks/OVE_SEC005/TASK.md) | SEC005 platform peer-identity integration and explicit unsupported-capability review. |
| SR-12 | MUST authenticate every gateway request with high-entropy, constant-time-compared credentials, rotate the session token on engine start and bind Agent tokens to scope. | T-TB-GW-1, T-TB-GW-4, T-TB-GW-6 | ENGINE: [ENGINE012](../../tasks/OVE_ENGINE012/TASK.md), [ENGINE028](../../tasks/OVE_ENGINE028/TASK.md) | SEC005 token/rotation/forgery integration; ENGINE028 expiry, Run binding and revocation tests. |
| SR-13 | MUST protect any enabled HTTP-on-TCP dev/test listener with Host/Origin validation, no CORS wildcard and no token in URLs or cookies. | T-TB-GW-1, T-TB-GW-4 | ENGINE: [ENGINE023](../../tasks/OVE_ENGINE023/TASK.md) | SEC005 HTTP rebinding/CSRF/auth negatives when that optional mode exists; disabled remains the default. |
| SR-14 | MUST accept Telegram input only from the single paired chat; ignore and rate-limit every other sender/group. | T-TB-TG-1, T-TB-TG-5 | TG: [TG003](../../tasks/OVE_TG003/TASK.md), [TG013](../../tasks/OVE_TG013/TASK.md) | [SEC008](../../tasks/OVE_SEC008/TASK.md) actual pairing, sender/group forgery and flood integration. |
| SR-15 | MUST limit Telegram Approvals and Access Request grants to the current Run; they never create permanent access. | T-TB-TG-2, T-TB-TG-6 | PERM: [PERM016](../../tasks/OVE_PERM016/TASK.md); TG: [TG011](../../tasks/OVE_TG011/TASK.md) | SEC008 remote-scope/replay integration; PERM016 grant expiry and ended-Run tests. |
| SR-16 | MUST prevent Agents and Telegram from widening permissions, lifting Approval requirements or editing Owner Rules; these require Local Approval. | T-TB-CONTENT-1, T-TB-TG-6 | PERM: [PERM009](../../tasks/OVE_PERM009/TASK.md), [PERM012](../../tasks/OVE_PERM012/TASK.md); DATA: [DATA015](../../tasks/OVE_DATA015/TASK.md) | SEC008 remote escalation negatives; PERM009/012 and DATA015 local-authority integration. |
| SR-17 | MUST append attributable security decisions to the audit/event store; diagnostic logs are not audit evidence. | T-TB-GW-3, T-TB-ENG-3, T-TB-TG-3 | PERM: [PERM020](../../tasks/OVE_PERM020/TASK.md); ENGINE: [ENGINE016](../../tasks/OVE_ENGINE016/TASK.md) | PERM020 append-only/tamper contract tests; ENGINE016 caller/action/denial integration. |
| SR-18 | MUST never blindly replay a non-idempotent action after crash, timeout or retry; unknown effects require reconciliation. | T-TB-ENG-2, T-TB-HERDR-2 | ENGINE: [ENGINE005](../../tasks/OVE_ENGINE005/TASK.md); PROV: [PROV008](../../tasks/OVE_PROV008/TASK.md) | [TEST011](../../tasks/OVE_TEST011/TASK.md) actual crash/restart fault injection; PROV008 ambiguous-delivery integration. |
| SR-19 | MUST treat herdr/CLI state and authenticated Agent reports as hints/declarations; verify completion through real effects/artifacts; deny command delivery while the CLI awaits Approval and raise an Approval or Escalation; recognize login/choice dialogs and never auto-answer them. | T-TB-HERDR-3, T-TB-HERDR-6 | PROV: [PROV006](../../tasks/OVE_PROV006/TASK.md), [PROV008](../../tasks/OVE_PROV008/TASK.md); WFRT: [WFRT056](../../tasks/OVE_WFRT056/TASK.md) | [TEST006](../../tasks/OVE_TEST006/TASK.md) simulator failures; PROV008 blocked-Approval zero-send, Approval/Escalation and real adapter integration; WFRT056 provenance tests. |
| SR-20 | MUST route sandbox egress through an allowlist proxy; provider hosts are pre-allowed, every other domain needs Approval, and redirects/DNS cannot bypass the policy. | T-TB-NET-2, T-TB-NET-6 | BOX: [BOX011](../../tasks/OVE_BOX011/TASK.md), [BOX012](../../tasks/OVE_BOX012/TASK.md), [BOX013](../../tasks/OVE_BOX013/TASK.md) | BOX011 SSRF/redirect unit and integration tests; TEST007 actual DNS/socket/proxy escape tests. |
| SR-21 | MUST leave CLI login credentials/codes inside the official CLI flow, outside Overmind processes/logs; any callback forwarding is temporary and bound to the intended environment. | T-TB-NET-1, T-TB-PROVIDER-4 | SEC: [SEC009](../../tasks/OVE_SEC009/TASK.md); BOX: [BOX015](../../tasks/OVE_BOX015/TASK.md); PROV: [PROV014](../../tasks/OVE_PROV014/TASK.md) | SEC009 pure-helper unit/property tests and session/redaction denials; BOX015 real-socket squatter/relay tests and actual macOS forward/teardown integration; PROV014 fake-CLI login orchestration, cancel and expiry integration. |
| SR-22 | MUST preserve pinned lockfiles/Actions/image digests, denied install scripts, license policy, provenance/SBOM and verified bundled binary checksums/signatures. | T-TB-SUPPLY-1, T-TB-SUPPLY-2 | SEC: [SEC006](../../tasks/OVE_SEC006/TASK.md); SETUP: [SETUP006](../../tasks/OVE_SETUP006/TASK.md), [SETUP008](../../tasks/OVE_SETUP008/TASK.md), [SETUP015](../../tasks/OVE_SETUP015/TASK.md) | SEC006 supply-chain negative probes/review; [SETUP014](../../tasks/OVE_SETUP014/TASK.md) exact release artifact checks. |
| SR-23 | MUST forbid eval/dynamic execution of data; workflow conditions use the bounded safe evaluator. | T-TB-CONTENT-2, T-TB-CONTENT-6 | WFRT: [WFRT015](../../tasks/OVE_WFRT015/TASK.md), [WFRT016](../../tasks/OVE_WFRT016/TASK.md); ARCH: [ARCH002](../../tasks/OVE_ARCH002/TASK.md) | WFRT015/016 malformed/limit unit tests; [WFRT017](../../tasks/OVE_WFRT017/TASK.md) fuzz/injection suite; ARCH002 executable boundary-rule negatives. |
| SR-24 | MUST treat Agent output as untrusted: structured reports are schema-validated and size-capped; free text remains wrapped data for Chief and other Agents. | T-TB-CONTENT-1, T-TB-CONTENT-3 | AGENT: [AGENT014](../../tasks/OVE_AGENT014/TASK.md); SEC: [SEC004](../../tasks/OVE_SEC004/TASK.md) | AGENT014 schema/size/authenticated attribution tests; SEC004 cross-Agent injection negatives. |
| SR-25 | MUST require Local Approval for permanent directory additions, permission expansion, Approval overrides and Owner Rule changes; preserve ADR 0021 default action approvals. | T-TB-TG-6, T-TB-FS-6 | PERM: [PERM009](../../tasks/OVE_PERM009/TASK.md), [PERM016](../../tasks/OVE_PERM016/TASK.md); DATA: [DATA015](../../tasks/OVE_DATA015/TASK.md) | PERM009/016 local-proof and remote denial integration; SEC008 stolen-phone/permanent-grant negatives. |
| SR-26 | MUST create/check owner-only data directories/files (0700/0600), refuse symlinks and recheck on every engine start. | T-TB-ENG-1, T-TB-ENG-4 | ARCH: [ARCH005](../../tasks/OVE_ARCH005/TASK.md), [ARCH013](../../tasks/OVE_ARCH013/TASK.md) | ARCH005 startup permission/symlink integration; ARCH013 confined atomic-write contract tests. |
| SR-27 | MUST exclude secrets from backups/exports, redact exports and use an Owner-selected backup directory. | T-TB-ENG-4 | BACKUP: [BACKUP003](../../tasks/OVE_BACKUP003/TASK.md), [BACKUP004](../../tasks/OVE_BACKUP004/TASK.md), [BACKUP007](../../tasks/OVE_BACKUP007/TASK.md) | BACKUP003 exclusion/manifest tests; BACKUP007 export integration; SEC003 secret-sink review. |
| SR-28 | MUST reach pinned, verified herdr only through the replaceable adapter inside isolation; preserve named Agent/terminal mapping and checked resume/delivery behavior. | T-TB-HERDR-1, T-TB-SUPPLY-1 | PROV: [PROV005](../../tasks/OVE_PROV005/TASK.md), [PROV008](../../tasks/OVE_PROV008/TASK.md); SETUP: [SETUP015](../../tasks/OVE_SETUP015/TASK.md) | PROV005/008 adapter contract/integration; SEC006 binary substitution/provenance checks. |
| SR-29 | MUST run real isolation escape tests in CI and gate the exact release artifact; missing hardware/harness/evidence blocks release. | T-TB-SBX-6, T-TB-SUPPLY-3 | TEST: [TEST007](../../tasks/OVE_TEST007/TASK.md); SETUP: [SETUP014](../../tasks/OVE_SETUP014/TASK.md), [SETUP021](../../tasks/OVE_SETUP021/TASK.md) | TEST007 actual escape harness; SETUP014 exact-SHA release-gate denial when evidence is absent. |
| SR-30 | MUST make Global Pause halt Runs and prevent new execution; Agents/Telegram cannot bypass it, and only the Owner resumes. | T-TB-SBX-5, T-TB-ENG-5 | PAUSE: [PAUSE003](../../tasks/OVE_PAUSE003/TASK.md), [PAUSE005](../../tasks/OVE_PAUSE005/TASK.md); WFRT: [WFRT052](../../tasks/OVE_WFRT052/TASK.md) | PAUSE003 authority/audit unit tests, PAUSE005 gate contract and WFRT052 pause/resume/cancel integration, including retry bypass. |
| SR-31 | MUST prevent Agent/overmind Skill credentials from expanding rights, reading another Run or calling Owner-scope routes; the helper has no authority outside Overmind. | T-TB-GW-6, T-TB-KC-6 | ENGINE: [ENGINE013](../../tasks/OVE_ENGINE013/TASK.md), [ENGINE028](../../tasks/OVE_ENGINE028/TASK.md); SKILL: [SKILL012](../../tasks/OVE_SKILL012/TASK.md) | SEC005 scope/cross-Run token negatives; SKILL012 helper contract tests and WFRT056 independent effect verification. |
| SR-32 | MUST keep Visibility separate from permissions and Workspace memory boundaries; public/private changes grant no additional access. | T-TB-CONTENT-4, T-TB-FS-6 | VIS: [VIS002](../../tasks/OVE_VIS002/TASK.md); PERM: [PERM005](../../tasks/OVE_PERM005/TASK.md) | VIS002 defaults/isolation/authority unit tests; PERM005 permission invariance properties. |
| SR-33 | MUST isolate Workspaces at the sandbox boundary and keep per-CLI credential volumes invisible to other Workspaces. | T-TB-SBX-1, T-TB-PROVIDER-4 | BOX: [BOX009](../../tasks/OVE_BOX009/TASK.md), [BOX019](../../tasks/OVE_BOX019/TASK.md) | BOX009 volume identity/lifecycle integration; TEST007 real cross-Workspace credential-access denial. **OPEN:** BOX009's shared `cli` default conflicts with ADR0020/SR-33; resolve the [allocation proposal](../../tasks/_proposals/OVE_BOX009-credential-workspace-isolation.md) before verification. |
| SR-34 | MUST bind Approvals to id, Run, action hash, expiry and single use; mutating routes use persisted replay-safe idempotency keys. | T-TB-GW-2, T-TB-TG-2 | PERM: [PERM013](../../tasks/OVE_PERM013/TASK.md), [PERM016](../../tasks/OVE_PERM016/TASK.md); ENGINE: [ENGINE015](../../tasks/OVE_ENGINE015/TASK.md); TG: [TG011](../../tasks/OVE_TG011/TASK.md) | SEC005 replay/idempotency integration; SEC008 forged/edited/expired callback negatives. |
| SR-35 | MUST sanitize untrusted Markdown, deny raw HTML/script execution and open links only through the existing external-URL allowlist. | T-TB-UI-1, T-TB-UI-6 | UI: [CHATUI008](../../tasks/OVE_CHATUI008/TASK.md); DS: [DS022](../../tasks/OVE_DS022/TASK.md) | CHATUI008 real-renderer security tests; DS022 malicious-link unit/browser cases. |
| SR-36 | MUST keep Tauri capabilities/CSP minimal: no remote content or arbitrary shell/filesystem plugins exposed to the webview. | T-TB-UI-2, T-TB-UI-6 | SETUP: [SETUP010](../../tasks/OVE_SETUP010/TASK.md) | SETUP010 CSP/capability and denied-IPC tests; SEC007 security review. |
| SR-37 | MUST enforce engine pause/cancel, default three parallel Agents, budgets/timeouts, environment CPU/memory/pids, request sizes and bounded queues. | T-TB-SBX-5, T-TB-GW-5 | BOX: [BOX017](../../tasks/OVE_BOX017/TASK.md); ENGINE: [ENGINE014](../../tasks/OVE_ENGINE014/TASK.md); PROV: [PROV019](../../tasks/OVE_PROV019/TASK.md), [PROV035](../../tasks/OVE_PROV035/TASK.md); WFRT: [WFRT052](../../tasks/OVE_WFRT052/TASK.md) | BOX017/PROV019 resource/concurrency integration; PROV035 budget unit tests; ENGINE014 flood negatives; WFRT052 cancellation and TEST007 exhaustion checks. |
| SR-38 | MUST keep telemetry disabled (literal false); no Overmind data leaves the machine except approved provider traffic and Telegram, still subject to capability and redaction checks. | T-TB-NET-4, T-TB-PROVIDER-4 | ARCH: [ARCH005](../../tasks/OVE_ARCH005/TASK.md); BOX: [BOX011](../../tasks/OVE_BOX011/TASK.md); TG: [TG009](../../tasks/OVE_TG009/TASK.md) | ARCH005 configuration denial tests; BOX011 egress integration and SEC007 outbound-channel review. |

## SPECIFICATION 16 security criteria

These six mappings preserve the original product acceptance criteria; a simulator cannot satisfy actual OS escape evidence.

| Criterion | SR coverage | Required future verification |
| --- | --- | --- |
| 1: first folder required; empty grants no access | SR-01, SR-04, SR-05 | ONB005 empty-folder gate; PERM005 denial; TEST007 actual filesystem boundary. |
| 7: background persistence and no duplicate effects after restart | SR-17, SR-18, SR-19, SR-26, SR-34 | ENGINE005 recovery plus TEST011 fault injection; persisted action/audit attribution. |
| 8: denied reads outside mounts, including CLI commands; CI escape | SR-04, SR-05, SR-29, SR-33 | TEST007 against the real sandbox/release environment, not a fake CLI. |
| 9: Telegram Run-only versus local permanent grants | SR-15, SR-25, SR-34 | PERM016 and SEC008 channel, expiry and replay integration. |
| 10: no Agent/Telegram privilege or Approval expansion | SR-02, SR-08, SR-16, SR-25, SR-31 | SEC004/005/008 denied authority, owner-route and forged-content effects. |
| 14: pause, cancel, three-Agent default, budgets and timeouts | SR-03, SR-18, SR-30, SR-37 | PAUSE003/005 and WFRT052 engine gates; PROV019/035 concurrency/budget checks; BOX017/ENGINE014 limits; TEST007 exhaustion. |

## ADR consequences

Links retain the canonical source records; existing Polish ADRs are not translated as unrelated work.

| ADR | SR coverage | Consequence retained |
| --- | --- | --- |
| [0003](../adr/0003-uprawnienia-deny-by-default-i-przeciecie.md) | SR-01, SR-02, SR-04, SR-09, SR-15, SR-16, SR-25 | Owner authority, intersected policies, narrowed delegation, audited path checks and no rights from a Skill. |
| [0004](../adr/0004-realna-izolacja-os.md) | SR-03, SR-05, SR-06, SR-08, SR-29 | OS enforcement and actual escape acceptance; UI settings or model refusal are insufficient. No weaker-isolation mode is approved here. |
| [0006](../adr/0006-telegram-jako-drugi-kanal.md) | SR-07, SR-14, SR-15, SR-16, SR-17, SR-34 | One engine state, paired channel, Run-only remote grants and no secrets over non-E2E transport. |
| [0010](../adr/0010-jedna-instalacja-jeden-wlasciciel.md) | SR-14, SR-38 | One local Owner/installation; no central accounts or telemetry; no multi-user scope added. |
| [0012](../adr/0012-skille-z-internetu-tylko-od-wlasciciela.md) | SR-08, SR-09, SR-24, SR-31 | Owner imports/reviews external Skills; Chief may propose, not self-install; source/version remain attributable. |
| [0020](../adr/0020-izolacja-macos-maszyna-wirtualna.md) | SR-04, SR-05, SR-20, SR-21, SR-29, SR-33, SR-37 | Real mounts, isolated CLI volumes, correct Workspace cwd, egress proxy and OS-level escape tests. |
| [0021](../adr/0021-domyslna-lista-zgod.md) | SR-15, SR-16, SR-20, SR-25, SR-34, SR-37 | Default Approvals for deletion, push/publication, outbound messages, payment, new domains and budget overrun; removing a requirement is local-only. |
| [0022](../adr/0022-oficjalne-cli-jak-herdr.md) | SR-19, SR-21, SR-28, SR-38 | Owner logs into official CLIs; credentials/codes stay out of Overmind; quota source is labelled and vendor-term risk stays OPEN. |
| [0026](../adr/0026-herdr-jako-warstwa-terminali.md) | SR-18, SR-19, SR-28 | Replaceable pinned adapter, named terminal mapping, checked resume/delivery, no command delivery while the CLI awaits Approval, Approval/Escalation instead, no blind prompt retry and state as a hint. |
| [0027](../adr/0027-skill-overmind-dla-agentow.md) | SR-19, SR-24, SR-31 | Scoped builtin helper/report declarations do not replace actual Quality Gate evidence or grant permissions. |
| [0028](../adr/0028-widocznosc-publiczny-prywatny.md) | SR-02, SR-25, SR-32 | Owner-controlled Visibility preserves isolated-Workspace privacy, per-Workspace memory and pinned Run configuration; it grants no rights. |

## Verification states and evidence

The register assigns future work; it records no runtime control as verified by this documentation task.
Use the owning task's exact artifact/head, activity, report and independent review when attaching evidence.

| State | Meaning | Closure rule |
| --- | --- | --- |
| ASSIGNED / OPEN | A real task/capability owns implementation or testing; relevant evidence is absent or incomplete. | Implement and test the invariant, including denial and unavailable-check behavior. |
| EVIDENCE AVAILABLE | An actual report exists for a stated artifact; scope and provenance still need review. | Check exact target, case identities, failures/skips and applicable independent review. |
| VERIFIED FOR ARTIFACT | The required activity actually passed for that artifact and invariant. | Never generalize to another binary, sandbox, platform or release. |
| OWNER RISK DECISION OPEN | A residual risk requires the Owner's separate decision. | Agent delegation, CI, this register or AI review cannot accept it. |

Failed, cancelled, missing or skipped required checks are not PASS. Keep original failures and unresolved evidence visible.
Local/static checks, fake CLIs, hosted packaging and genuine isolation/penetration tests are distinct activities.
Unavailable test commands/hardware block their assigned acceptance; no alternate success is fabricated.

## Open verification work

All runtime assignments above remain OPEN here. These specific gaps require attention without inventing a new implementation owner:

| Gap | Existing allocation | Required resolution |
| --- | --- | --- |
| Peer-uid availability, SR-11 | ENGINE010 / SEC005 | Document supported platforms and actual peer-check evidence; preserve mandatory token checks. |
| Native transport/Skill credential handoff, SR-06/12/31 | ENGINE028 / SEC003; architecture alignment proposal | Resolve the existing environment-token conflict before implementation acceptance; no plaintext-port/UI exception. |
| Actual isolation/release environment, SR-05/29/33 | SETUP021 / TEST007 / SETUP014 | Provide real dedicated-runner/escape evidence for the release target; hosted scaffold/packaging CI is insufficient. |
| Untrusted content and completion provenance, SR-08/19/24 | SEC004 / PROV008 / AGENT014 / WFRT056 | Demonstrate denied effects and authenticated evidence; a model's report is not proof. |
| Provider terms/login, SR-21/28 | SEC009 / PROV005 and Owner | Verify the chosen official CLI flow and terms separately; keep Owner acceptance in the threat model OPEN. |

An unmitigated or unallocated threat must stay OPEN and receive a finite proposal through its owning task/integrator.
No missing task is invented to make a table complete. New product/security scope requires its existing approval route.

## Parent coverage checklist

The [parent](../../tasks/OVE_SEC001/TASK.md) performs final aggregate review after SEC010, SEC011 and SEC012 merge done.
These unchecked items are parent acceptance work, not a claim that the assigned runtime suites have passed:

- [ ] Exactly SR-01..SR-38 exist once, with SR-11 SHOULD and the other required MUST controls preserved.
- [ ] Every row resolves to existing threat ids, concrete implementation ownership and a verifying task/activity.
- [ ] SPECIFICATION 16 criteria 1/7/8/9/10/14 and every required ADR consequence remain mapped.
- [ ] The final abuse catalogue resolves all reserved AC references and retains denied-effect test hooks.
- [ ] Every runtime evidence claim has an actual report and exact target; failed or unavailable controls stay OPEN.
- [ ] Resolve the OPEN BOX009 shared-credential-volume conflict with ADR0020/SR-33 before accepting its implementation or cross-Workspace verification.
- [ ] The three documents contain 600..900 substantive lines; their independent reviews cover the complete set.
- [ ] No secret, real credential, personal path, executable injection payload or unapproved residual-risk acceptance appears.
- [ ] Release isolation and provider-risk decisions remain separate from documentation completion.

## Review and change control

Recheck this register whenever an ADR, boundary, credential flow or security-sensitive public contract changes.
Use the threat model's review cadence, including quarterly provider-term review; no review execution is claimed here.
Area authors and SEC007 cite these stable ids, link to this register and propose corrections rather than duplicate it.
Keep the original statement and replacement rationale when deprecating an id; never silently remove its invariant.
SEC011 completion supplies a reviewed requirements document only. SEC001 aggregate acceptance, runtime verification,
Owner residual-risk decisions and release permission remain separate obligations.
