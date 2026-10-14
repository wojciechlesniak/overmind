---
id: OVE_PERM021
title: Implement audit redaction and per-action details allowlist enforcement
area: PERM
kind: security
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_PERM019, OVE_SEC002, OVE_SEC003]
soft_depends_on: [OVE_SEC003]
provides: ["lib:audit-redactor", "lib:audit-no-secrets-test"]
needs: ["lib:redaction", "lib:redaction-corpus", "lib:path-guard"]
owns: ["packages/application/src/audit/redaction/**", "packages/testing/src/audit/no-secrets.ts"]
reads: ["packages/application/src/logging/redaction/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 15"]
adr_refs: [3, 22]
---

# OVE_PERM021: Implement audit redaction and details allowlist enforcement

## 1. Summary

Defence in depth between callers and the audit store: strict per-action schemas plus pattern redaction, path-to-display conversion, bounded and sanitised text, and a reusable test helper proving that no secret reaches an audit event.

## 2. Context

Audit events are long-lived, exportable and summarised to Telegram. SR-06/SR-07 forbid secrets in logs and errors; the same applies here. Risk sources: agent free text, absolute paths, tokens in URLs, CLI output, Keychain refs, login codes (ADR 0022).

## 3. Scope (in)

`redactAuditDraft(draft)` used by `AppendAudit`; string sanitisers; path display conversion; `expectAuditEventSafe(event)`; a corpus test running the SEC003 corpus through `AppendAudit`.

## 4. Out of scope

The pattern table and corpus (ARCH004/SEC003), area details schemas (their action files), log redaction.

## 5. Detailed requirements

1. Order inside `AppendAudit`: strict schema validation, sanitise, redact, size check, sign. Replacements are `[REDACTED]` or `[redacted-path]`; the shape does not change.
2. Keys matching the secret key regex (ARCH004) are rejected at registry time; if one appears at runtime its value is replaced and `redaction_applied: true` is added.
3. Every string value passes the shared pattern table (bearer/API keys, Telegram bot tokens, `keychain:` refs, URLs with credentials, login codes, private key blocks, base64/hex blobs of 40+ chars).
4. Strings: NFC, control and bidi override characters (U+202A..202E, U+2066..2069) removed, newlines become spaces, max 200 chars (`…`), max 20 fields.
5. Fields declared `path` (`z.string().meta({kind:'path'})`) and `target.display`: inside a Workspace become Workspace-relative, inside home `~/…`, elsewhere only the last two components prefixed `…/` with `outside_home: true`. Absolute host paths and user names are never stored.
6. Field names `content, body, prompt, output, stdout, stderr, message, text` are forbidden in schemas (registry lint). Needed excerpts use `excerpt`, max 80 chars after redaction.
7. `expectAuditEventSafe(event)` asserts no pattern match, no `/Users/`, `/home/`, `/private/`, `/var/`, no `file://`, no `keychain:`, no 40+ char high-entropy token, no control characters; exported through `packages/testing`.
8. Corpus test: embed SEC003 secrets in the details of each registered PERM action schema; none may be stored.
9. If redaction throws on a value the field is dropped and `redaction_error: true` is set; the event is still written.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`redact` patterns (ARCH004), corpus (SEC003), `displayPath` (SEC002). No duplicated pattern lists.

## 8. Architecture and code placement

`packages/application/src/audit/redaction/{redact-draft.ts,sanitise.ts,paths.ts}`; helper in `packages/testing/src/audit/`. Pure functions; Workspace roots passed in.

## 9. Security and safety

Two independent mechanisms (allowlist and patterns); fail closed per field; host layout and user names never persisted; the helper makes the property enforceable in every area's tests.

## 10. Errors and edge cases

- Object/array detail values: rejected by schema.
- Path in a non-path field: still caught by the `/Users/<name>` pattern.
- 200+ char token: truncated and flagged.

## 11. Acceptance criteria

- [ ] All corpus secrets are absent from stored events for every registered PERM action.
- [ ] `/Users/alice/secret-project/src` is never stored in absolute form.
- [ ] Bidi and control characters are stripped.
- [ ] A forbidden field name fails the registry lint.
- [ ] `expectAuditEventSafe` fails on a deliberately leaky event.

## 12. Test plan

Unit tests per sanitiser, corpus test, negative helper tests. `pnpm vitest run packages/application/src/audit/redaction`.

## 13. Parallelization notes

Parallel with PERM020 (interface `redactAuditDraft(draft): AuditDraft`).

## 14. Open questions and assumptions

- ASSUMPTION: 200 chars, 20 fields and 2 KiB suffice.
- Open: hashed path correlation across events; default no.
