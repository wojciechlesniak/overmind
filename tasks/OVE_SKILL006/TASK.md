---
id: OVE_SKILL006
title: Implement the Skill text scanner (static rules) and ScanSkillText
area: SKILL
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_SKILL001]
soft_depends_on: []
provides: ["usecase:ScanSkillText", "lib:skill-scanner"]
needs: ["contract:SkillScanFinding", "port:Clock"]
owns: ["packages/application/src/skill/scan/**", "packages/domain/src/skill/scanner/**"]
reads: ["packages/contracts/src/skill/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 13", "SPECIFICATION 9"]
adr_refs: [12, 3, 27]
---

# OVE_SKILL006: Implement the Skill text scanner (static rules) and ScanSkillText

## 1. Summary

A pure, deterministic static scanner that inspects Skill instruction text for prompt-injection patterns, hidden characters, exfiltration and privilege-escalation instructions, and returns typed findings with a severity.

## 2. Context

Skills from the internet are the main prompt-injection supply chain (ADR 0012). The scanner never decides alone: it informs the Owner at review time and blocks only `high` findings on creation. It runs on every new text regardless of source. `requiredTools` is metadata, so the scanner also flags text that asks the Agent to widen permissions.

## 3. Scope (in)

- Rule set with stable rule ids, severities and tests; `ScanSkillText(text, requiredTools) -> ScanResult`.
- Unicode and structure analysis; URL and command extraction (reported, not fetched).

## 4. Out of scope

- Dynamic analysis, network lookups, model-based classification (not allowed in MVP). Review UI: SKUI.

## 5. Detailed requirements

1. Rule ids (enumerated in `scan-rules.ts`): `hidden_unicode` (bidi override, zero-width, tag characters), `ignore_instructions` (phrases telling the model to ignore previous rules, in EN and PL), `role_hijack` (system-prompt impersonation, fake fences), `fence_break` (attempts to close or spoof Overmind data fences), `exfiltration` (send data to URL, base64 of secrets, `curl | sh`), `secret_access` (reads of key files, env dumps, `~/.ssh`), `permission_escalation` (disable sandbox, request all tools, bypass approval), `rule_override` (claims to override Owner Rules), `remote_exec` (download-and-run), `url_present` (info, hosts listed), `oversize_line`, `encoded_blob`.
2. Severity mapping: `high` (fence_break, hidden bidi, rule_override, permission_escalation with imperative form, remote_exec to pipe); `medium` (exfiltration, secret_access, ignore_instructions); `low`/`info` for the rest. Overall severity is the maximum.
3. Pure function, no IO, no regex with catastrophic backtracking (bounded patterns, input capped at 20000 chars, time budget tested with adversarial input).
4. Normalise first (NFKC copy for matching, original for line numbers) to defeat homoglyph and spacing tricks; report line numbers and a sanitised excerpt (<=120 chars, control characters replaced).
5. `scannerVersion` constant bumped on rule change; stored with the result so old versions can be re-scanned (`RescanSkills` is out of MVP, flagged).
6. Result never includes the whole text; excerpts are escaped for display and marked as untrusted by the UI.
7. A golden corpus of benign Skills (including the builtin `overmind` Skill) must produce no `high`/`medium` findings; a malicious corpus produces expected rule hits.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Contracts from SKILL001; SEC fence helpers for the fence-break pattern (`lib:prompt-assembly` constants).

## 8. Architecture and code placement

`packages/domain/src/skill/scanner/{rules.ts,normalise.ts,scan.ts}` plus thin use case in application.

## 9. Security and safety

The scanner is advisory, not a security boundary: the real defence is that Skill text is placed in prompts only via `PromptAssembler` as fenced instructions and never grants permissions. The scanner must never execute or fetch anything it extracts. Findings must not leak secrets: excerpts are truncated and sanitised.

## 10. Errors and edge cases

- Adversarial input (very long lines, nested unicode): bounded time, returns `oversize_line`.
- Non-UTF-8: rejected before scan.
- Empty text: `skill.invalid_instructions`.
- False positives: Owner can still accept `medium`; `high` on import blocks accept unless the Owner confirms each finding (SKILL008).

## 11. Acceptance criteria

- [ ] Every rule has a positive and negative fixture.
- [ ] Benign corpus yields no medium/high findings.
- [ ] Scan of 20000 chars completes under 50 ms on CI hardware budget.
- [ ] Output is deterministic.
- [ ] No IO imports in the module (architecture test).

## 12. Test plan

Table-driven unit tests, property tests for normalisation, ReDoS timing test. Command: `pnpm vitest run packages/domain/src/skill/scanner`.

## 13. Parallelization notes

Fully parallel after SKILL001. Blocks SKILL004, SKILL007, SKILL008.

## 14. Open questions and assumptions

- ASSUMPTION: no model-based scanning in MVP.
- OPEN: whether to rescan existing versions when rules change (post-MVP).
