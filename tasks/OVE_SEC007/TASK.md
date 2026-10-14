---
id: OVE_SEC007
title: Create the per-task security review checklist and its PR tooling
area: SEC
kind: security
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_SEC001]
soft_depends_on: [OVE_SEC002, OVE_SEC003, OVE_SEC004, OVE_OSS003]
provides: ["doc:security-review-checklist", "lib:security-checklist-tool"]
needs: []
owns: ["docs/security/review-checklist.md", "docs/security/pr-security-section.md", "tools/security/review-checklist.ts", "tools/security/review-checklist/**"]
reads: ["docs/security/requirements.md", "docs/security/abuse-cases.md", "tasks/CONVENTIONS.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 19"]
adr_refs: [3, 16, 25]
---

# OVE_SEC007: Create the per-task security review checklist and its PR tooling

## 1. Summary

The Definition of Done says "Security section re-read against the code; negative tests for denied paths exist". This task makes that concrete: a checklist reviewers and implementing agents use for every task, tailored by what the task touches, a PR template section, and a small tool that selects the relevant checklist items from the task front matter and verifies that the PR description addressed them.

## 2. Context

Security is part of every task (CONVENTIONS section 7). Many tasks are implemented by agents and merged by a human (ADR 0025); a consistent, short, risk-targeted checklist is the cheapest control. The checklist is derived from `docs/security/requirements.md` (SR ids) and abuse cases (AC ids). PR templates are owned by `OVE_OSS003`; this task supplies the section text.

## 3. Scope (in)

- `docs/security/review-checklist.md`: universal items plus modules per risk class.
- `docs/security/pr-security-section.md`: the snippet OSS003 includes in the PR template.
- Tool `pnpm security:checklist --task OVE_X [--pr-body file]`: prints the applicable items, and in `--verify` mode checks the PR body.

## 4. Out of scope

- PR template file, labels and gate workflow: `OVE_OSS003`. Automated security gates (escape tests, supply chain, secret scan): their own tasks. Penetration testing.

## 5. Detailed requirements

1. **Universal items (every task), each with a one-line "how to check":**
   U1 Section 9 of the TASK.md re-read against the diff; any deviation explained.
   U2 Deny by default: new capability is off/blocked unless explicitly allowed; no `allowAll` flags.
   U3 Fail closed: behaviour when a dependency, policy or check is unavailable is a block plus log (test exists).
   U4 Negative tests: for every denied path/input/caller at least one test asserting denial (list them in the PR).
   U5 No secrets in code, tests, snapshots, fixtures, logs, errors (run `pnpm security:scan-snapshots`).
   U6 Untrusted input validated by strict zod schemas with bounds; no `any` at boundaries.
   U7 No `eval`/`new Function`/dynamic `import(variable)`/shell strings; subprocess via `ProcessRunner` with argv.
   U8 Errors use `Result`/`AppError`; messages leak no paths/stack/SQL/tokens.
   U9 Logging via `Logger` with constant messages; nothing sensitive at info+.
   U10 Audit event written for every security-relevant decision (allow/deny/approval/policy change/pause) in the same transaction as the state change.
   U11 Idempotency: retries/replays cannot duplicate side effects; non-idempotent actions marked and guarded.
   U12 No new dependency without justification (S5), license allowed.
   U13 Ownership: only `owns` paths touched (`pnpm ownership:check`).
   U14 Docs/ADR updated for any change of boundary, permission model or contract.
2. **Risk modules**, selected by front matter fields (`area`, `kind`, `owns` globs, `provides`/`needs` capability prefixes) via a mapping file `tools/security/review-checklist/modules.json` ("if owns matches `packages/gateway/**` or needs `api:` -> module GATEWAY"):
   - GATEWAY: scope declared, authz before handler, body limits, idempotency key, Host/Origin if HTTP, no token logging (SEC005 suite passes).
   - FILESYSTEM/PATHS: uses `PathGuard`, canonical paths, no string path checks (`startsWith`), `openVerified` on host-side opens, no following symlinks implicitly (SEC002 matrix extended with the new case).
   - SANDBOX/BOX: mounts only canonical Allowed Directories, `/work`, read-only/ephemeral rootfs, egress policy, escape test case added (TEST007).
   - PERMISSIONS: intersection semantics, delegation only narrows, permission-expanding actions require Local Approval, Telegram path limited to current Run, audit.
   - PROMPTS/CONTENT: uses `PromptAssembler`, content labelled, proposals typed, agent output treated as data (SEC004 corpus extended).
   - SECRETS: Keychain only, `Secret` type, no argv/env leakage, redaction vectors added (SEC003).
   - TELEGRAM/CHANNELS: sender pairing check, update dedupe, rate limit, no secrets, approvals scope (SEC008 suite).
   - PROVIDERS/HERDR: state treated as hint, real evidence for completion, login-required/choice dialogs recognised, no blind retry, no text typed into dialogs (fake CLI cases added, TEST006).
   - WORKFLOW/RUNTIME: non-idempotent actions marked, checkpoints, limits (iterations/time/cost), safe evaluator only.
   - UI: no raw HTML, Markdown sanitised, no Tauri command added without capability review, strings via i18n (no injection), links through `openExternal`.
   - DATA/PERSISTENCE: migrations non-destructive, parameterised queries only, permissions 0600, append-only where ADR 0008 requires, no secrets in tables.
   - DEPENDENCIES/CI: SEC006 rules, action pins, permissions.
   - LOGIN/AUTH FLOWS: SEC009 rules.
3. **Checklist format:** Markdown with stable ids (`SEC-CHK-U1`, `SEC-CHK-GATEWAY-3`), each item: statement, evidence expected (test name, command, or reviewer note), related SR/AC ids. Items are short (one or two lines). Total universal list fits one screen.
4. **PR section snippet** (`pr-security-section.md`):
   ```
   ## Security review
   - Task security section (9) re-read: [ ] yes
   - Touched risk modules: <auto-filled list from `pnpm security:checklist`>
   - Negative tests added (list names): 
   - New attack surface / permissions / dependencies: none | describe
   - Checklist items not applicable (with reason):
   - [ ] I verified the items above against the diff
   ```
5. **Tool behaviour:** `pnpm security:checklist --task OVE_X` reads `tasks/OVE_X/TASK.md`, selects modules, prints Markdown ready to paste. `--verify --pr-body pr.md` checks that the section exists, every selected module is mentioned, the "Negative tests" line is non-empty unless the task `kind` is `docs`/`decision`, and no "n/a" without reason; exit 1 otherwise. A CI step (fragment for OSS003/SETUP006) runs verify on PRs.
6. **Review depth:** tasks touching GATEWAY, SANDBOX, PERMISSIONS, SECRETS or CI get label `needs-security-review` and a second reviewer; the tool prints this recommendation.
7. **Feedback loop:** when an escape, injection or auth bug is found, the checklist gains an item and a regression test in the corresponding suite (SEC002/004/005/TEST007); document the "add an item" procedure with a template.
8. **Self-test:** fixtures with sample task front matter (gateway route task, UI task, docs task) and expected module selections.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

SR/AC registers (SEC001), suites from SEC002/004/005/008/TEST007, supply chain rules (SEC006), ownership lint (ARCH009), front matter parser (ARCH009/SETUP013 shared). Do not duplicate requirement text: items reference ids.

## 8. Architecture and code placement

Docs under `docs/security/`; tool in `tools/security/review-checklist.ts` with `tools/security/review-checklist/{modules.json,select.ts,verify.ts,templates/}`. Pure functions (select/verify) unit-tested; CLI thin wrapper.

## 9. Security and safety

The checklist is a process control, not a boundary: it must be short enough to actually be used. The tool reads PR bodies (untrusted text from contributors/agents): treat as data, parse with simple string rules, never evaluate. Do not echo PR content into logs verbatim above debug.

## 10. Errors and edge cases

- Task with no `owns` (docs/decision): universal items only, negative-test line optional.
- Unknown area/capability prefix: falls back to universal + warns that mapping needs an update.
- PR body missing the section: verify fails with the template printed.
- A module's items already enforced by CI: item marked `(automated: <job>)` so reviewers can skip manual checks but confirm the job ran.
- Multiple modules overlapping items: de-duplicated by id.

## 11. Acceptance criteria

- [ ] `review-checklist.md` has U1-U14 and all 13 risk modules with stable ids and evidence hints.
- [ ] `pr-security-section.md` is ready to include in the PR template.
- [ ] `pnpm security:checklist --task` selects the expected modules for the fixture tasks.
- [ ] `--verify` fails on missing section, unmentioned module, empty negative-tests line, and passes on a complete body.
- [ ] Every item references at least one SR or AC id (script check).
- [ ] The procedure for adding an item after a bug is documented.

## 12. Test plan

Unit tests for `select.ts` and `verify.ts` with fixtures; golden-file test for the printed Markdown; a consistency test that every `SR-nn` mentioned exists in `requirements.md`. Commands: `pnpm vitest run tools/security/review-checklist`, `pnpm security:checklist --task OVE_SEC007`.

## 13. Parallelization notes

Small, mostly writing. Can proceed in parallel with SEC002-009 using SEC001's SR list; update items as those suites land. OSS003 includes the snippet via proposal/PR to its own template.

## 14. Open questions and assumptions

- ASSUMPTION: `needs-security-review` is a GitHub label applied by CODEOWNERS or the OSS003 gate workflow.
- Open: whether agents (implementers) must run the tool themselves before opening a PR; default yes, as part of the DoD checklist in the PR description.
