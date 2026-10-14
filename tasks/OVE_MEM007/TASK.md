---
id: OVE_MEM007
title: "Guard memory writes against poisoning and instruction injection"
area: MEM
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH004, OVE_MEM001, OVE_MEM003, OVE_SEC004]
soft_depends_on: ["OVE_SEC004"]
provides: ["lib:memory-write-guard", "usecase:memory.release-quarantine-view"]
needs: ["contract:AgentMemoryEntry", "lib:redactor", "lib:injection-corpus", "lib:error-catalogue"]
owns: ["packages/domain/src/memory/guard/**", "packages/application/src/memory/guard/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.3"]
adr_refs: [8, 14, 16]
---

# OVE_MEM007: Guard memory writes against poisoning and instruction injection

## 1. Summary

Implement the write guard that every memory insert passes: normalisation, redaction, instruction-like and permission-key detection, flagging, quarantine, and provenance validation, so summaries cannot smuggle rules into later prompts.

## 2. Context

A summary written from agent output is the main persistence channel for prompt injection: text stored today is read by a future Task. ADR 0016 and 0003: nothing remembered may weaken Owner Rules or permissions; only the Owner changes permissions. SEC004 supplies the corpus and fence rules.

## 3. Scope (in)

- Pure detectors, guard service returning accept/flag/quarantine/reject, quarantine view for the Owner (read-only).

## 4. Out of scope

- Prompt fencing at read time: MEM008. UI: not in this area.

## 5. Detailed requirements

1. Normalise to NFC, strip control and bidi characters (flag `invisible_chars`), collapse whitespace, truncate to 2000 (flag `oversize_truncated`).
2. Redact secrets with the shared redactor (flag `secret_redacted`).
3. Detect instruction-like text (imperative addressing the reader, 'ignore', 'from now on', 'always', 'never', role claims, markdown headings imitating system text, in English and Polish) and permission keys (`allow`, `approve`, `grant`, tool names, path patterns): flag; any `instruction_like` or `permission_keys` flag sends the entry to `quarantined` (never indexed, never in prompts).
4. URLs flagged `url_present` and stripped of markup; allowed in content as plain text.
5. Provenance validation: entry without provenance or with `trust: 'system'` and `derivedFromUntrusted: true` is rejected (`mem.provenance_required`).
6. Output: `{ decision: 'accept'|'quarantine'|'reject', entry, flags }`; guard decisions are deterministic and versioned (`guardVersion` in provenance).
7. Owner can see quarantined entries read-only with flags; no release action in MVP (decisions about content go through Owner Rules).

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

SEC004 corpus and redactor.

## 8. Architecture and code placement

Pure detectors in domain; guard orchestration in application.

## 9. Security and safety

Fail closed: uncertain text is quarantined, not accepted; detectors are deterministic (no model) so the guard itself cannot be injected; flags are surfaced to the Owner; the guard is the only insert path (repository insert requires a guard-issued token).

## 10. Errors and edge cases

- Legitimate summary 'Added rule that carts always round up': may be flagged; quarantine is visible to Owner, accepted cost.
- Polish phrases ('zawsze', 'ignoruj poprzednie') detected.
- Zero-width characters inside words are stripped before detection.

## 11. Acceptance criteria

- [ ] Whole SEC004 corpus ends quarantined or rejected, never active.
- [ ] Benign fixtures (the three mock entries) pass unflagged.
- [ ] Repository insert without guard token impossible (type test).
- [ ] Polish and English instruction phrases detected.
- [ ] Guard output deterministic across runs.

## 12. Test plan

- Table tests, corpus test, type tests. Commands: `pnpm vitest run packages/domain/src/memory/guard packages/application/src/memory/guard`.

## 13. Parallelization notes

Blocks MEM005 and MEM006 use of the guard.

## 14. Open questions and assumptions

- Open: whether false positives should be releasable by the Owner. Default: no, view only.
