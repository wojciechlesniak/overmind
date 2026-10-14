---
id: OVE_ONB033
title: "Implement onboarding Project Documentation suggestions and linking with path checks"
area: ONB
kind: feature
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_DATA016, OVE_DATA017, OVE_ENGINE016, OVE_ONB004, OVE_ONB031, OVE_PERM031, OVE_SEC002]
soft_depends_on: ["OVE_ONB009"]
provides: ["usecase:SuggestOnboardingDocs", "usecase:LinkOnboardingDoc", "usecase:UnlinkOnboardingDoc", "api:onboarding.documentation.suggestions", "api:onboarding.documentation.link", "api:onboarding.documentation.linked", "api:onboarding.documentation.unlink", "lib:api-client-onboarding-documentation"]
needs: ["usecase:RegisterProjectDoc", "usecase:ListProjectDocs", "port:DirectoryLister", "port:AllowedDirectoryReader", "lib:path-guard", "port:PathProbe", "port:ProjectDocRefRepository", "lib:route-module", "port:AuditSink"]
owns: ["packages/application/src/onboarding/documentation/**", "packages/gateway/src/routes/onboarding/documentation.route.ts", "packages/api-client/src/onboarding/documentation.ts"]
reads: ["packages/application/src/onboarding/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [3, 16]
---

# OVE_ONB033: Onboarding Project Documentation suggestions and linking

## 1. Summary

Backend for the optional 'link your Project Documentation' choice in step 3: suggests Markdown files found inside the Owner's first Workspace folder, and registers the chosen one as a `ProjectDocRef` through DATA017. Nothing outside the Allowed Directory can ever be linked.

## 2. Context

Project Documentation (glossary, ADR 0016) is the source of truth for the Chief's plans: tasks must point at a place in it. Linking is optional in the wizard; the Chief can ask for it later. The folder was approved in step 1 (ONB005 created Workspace, Allowed Directory and policy), so the Allowed Directory is the only trust boundary. File picking by the Owner returns an absolute path from the native dialog, which is untrusted text.

## 3. Scope (in)

- `SuggestOnboardingDocs`: bounded, read-only scan of the Workspace folder for Markdown candidates.
- `LinkOnboardingDoc` (by suggestion id or picked path) and `UnlinkOnboardingDoc` (wizard only).
- Route module and api-client functions for the four routes in ONB031.

## 4. Out of scope

- `RegisterProjectDoc` internals, hash, Git facts (DATA017).
- UI: ONB037/ONB038.
- Planning from the documentation (CHIEF, later).

## 5. Detailed requirements

1. **Scan.** Uses `DirectoryLister` (ONB004) rooted at the Allowed Directory canonical path. Depth max 3, at most 2000 entries visited, at most 12 suggestions, 3 s budget; skips `.git`, `node_modules`, hidden dirs, build outputs (`dist`, `build`, `target`), and any symlink (never followed). Only `.md`/`.markdown`, size <= 1 MiB (same limits as DATA017). `scanned.truncated` true when a budget hit.
2. **Ranking and kind.** Order: `README.md` at root, `SPECIFICATION*.md`/`SPEC*.md`, `docs/**/ADR-like` (`docs/adr/*.md`, `adr/*.md`), other files under `docs/`, other Markdown. Within a group alphabetical by path. `title` comes from the first `# ` heading read with a 4 KiB cap (reuse DATA017's title extractor if exported, otherwise `lib:project-doc-title`; do not re-implement).
3. **Opaque ids.** `suggestionId = base32(sha256(workspaceId + '\0' + relativePath)).slice(0,26)`; the use case re-derives candidates on link (no server-side cache that could go stale) and rejects ids not in the fresh scan.
4. **Link by suggestion.** Resolve to `{ rootId, relativePath }` then call `RegisterProjectDoc`. **Link by picked path:** `pathText` -> `PathGuard.resolveForAccess({ input, roots: AllowedDirectoryReader(workspaceId), mode: 'read' })`; derive the relative path from the canonical root; a path outside any root -> `onboarding.doc_rejected{outside_workspace}`; symlink components -> `symlink`; non-Markdown -> `not_markdown`.
5. At most one documentation entry may be linked from the wizard (the Owner can add more later in Workspace settings). A second link while one exists: `onboarding.doc_already_linked` (unlink first). `linked` returns the single wizard-linked ref (by an `origin: 'onboarding'` tag; if DATA017 has no origin field, tag via the first registered ref of the Workspace and record the ASSUMPTION in 14).
6. **Unlink** removes the ref (DATA017 unregister if available) and is refused after onboarding completed (`already_completed`).
7. Preconditions: `steps.folder.done`; workspaceId equals the onboarding Workspace.
8. Audit: `onboarding.doc_linked`/`onboarding.doc_unlinked` with `{ workspaceId, projectDocId }` (no path in the audit details; the path can be private).
9. Idempotency-Key on link; Owner desktop principal only.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`RegisterProjectDoc`, `ListProjectDocs` (DATA017), `PathGuard` and `PathProbe` (SEC002), `DirectoryLister` and `folder-policy` helpers (ONB004), `AllowedDirectoryReader` (PERM), route-module and api-client conventions.

## 8. Architecture and code placement

`packages/application/src/onboarding/documentation/{suggest-docs.ts, link-doc.ts, unlink-doc.ts, doc-ranking.ts, suggestion-id.ts}`; routes in `packages/gateway/src/routes/onboarding/documentation.route.ts`. Pure ranking and id functions are separate and unit-tested; I/O only through ports.

## 9. Security and safety

- Deny by default: no Allowed Directory for the Workspace -> `perm.no_allowed_directories` -> `doc_rejected{not_allowed}`.
- Paths canonicalised before any decision; symlinks and mount crossings rejected (SEC002); `pathText` never echoed in errors beyond a bounded display form.
- File content is data: titles are plain text; no content excerpts are returned here.
- Scan is read-only, bounded (anti-DoS on huge repos), never follows symlinks (no escape via a link to `~/.ssh`).
- Fails closed when the path guard cannot decide.

## 10. Errors and edge cases

- Empty folder: `suggestions: []`, UI shows 'none found' (ONB037).
- Huge repo: truncated flag, still returns what it found.
- File deleted between scan and link: `doc_rejected{not_found}`.
- Unicode and spaces in names: handled; display as-is.
- Case-insensitive file system duplicates: de-duplicate by canonical path.
- Doc changed to a symlink after suggestion: rejected at link.

## 11. Acceptance criteria

- [ ] Given a repo with README, docs and node_modules then README ranks first and node_modules is skipped.
- [ ] Given a symlink to a Markdown file outside the folder then it is neither suggested nor linkable.
- [ ] Given a picked path outside the Allowed Directory then `doc_rejected{outside_workspace}` and nothing is registered.
- [ ] Given a suggestion link then `RegisterProjectDoc` is called once with root-relative path.
- [ ] Given a second link then `doc_already_linked`.
- [ ] Given an unlink after completion then `already_completed`.

## 12. Test plan

Unit: ranking, ids, budgets with fake `DirectoryLister`. Integration with real temp dirs (symlink, `..`, case folding) through `PathGuard`; route tests. Commands: `pnpm --filter @overmind/application test onboarding/documentation`.

## 13. Parallelization notes

Parallel with ONB032, ONB034..ONB036. Conflict hotspot: none. The UI tasks need only the contracts.

## 14. Open questions and assumptions

- ASSUMPTION: the ref origin tag may not exist in DATA017; then "wizard-linked" = the earliest ref registered while onboarding is in progress. OPEN for DATA to add `origin`.
- ASSUMPTION: one wizard link only; more in Workspace settings (WSPACE).
- OPEN: should Chief be told about the link (a hint in the greeting only, see ONB036).
