---
id: OVE_CHIEF004
title: Implement documentation-link validation and gap classification rules
area: CHIEF
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHIEF001, OVE_DATA016, OVE_SEC002]
soft_depends_on: [OVE_CHIEF003]
provides: ["lib:doc-link-rules", "lib:gap-classification"]
needs: ["contract:ProjectDocRef", "lib:path-guard"]
owns: ["packages/domain/src/chief/docs/**"]
reads: ["packages/contracts/src/chief/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 16.4"]
adr_refs: [16, 15]
---

# OVE_CHIEF004: Implement documentation-link validation and gap classification rules

## 1. Summary

Pure rules for ADR 0016: every Task must link to a place in Project Documentation or be rejected or escalated, and a missing answer is either a "how" gap (Chief decides, records a Decision) or a "what" gap (always the Owner).

## 2. Context

Project Documentation is Markdown in the project folder, versioned in Git, shared by Chief and Agents; each Task points to the place it follows from. Because the repository can be modified by Agents and may contain untrusted text, the documentation counts as `external` for security (SEC004) but is authoritative for scope. Chief must not add scope on its own. The prototype lesson (always `/work`) applies: doc paths are relative to the Workspace root.

## 3. Scope (in)

- `DocLink = { path, anchor?, gitCommit? }` normalisation and validation (relative, inside the Workspace's documentation roots, `.md`).
- `validateTaskDocLink(task, docIndex): LinkVerdict` (`ok`, `reject(reason)`, `escalate(reason)`).
- `classifyGap(gap): 'how' | 'what'` rules for typed gaps coming from Chief output, plus safe defaults.
- Doc index type `DocIndex` (list of known paths with anchors and commit hash) provided by the caller.

## 4. Out of scope

- Reading and indexing documentation files: `OVE_CHIEF005`. Creating tasks: `OVE_CHIEF008`. Recording the Decision: `OVE_CHIEF012`.

## 5. Detailed requirements

1. A link is valid when: path is relative with no `..`, no absolute prefix, no URL scheme; extension `.md` or `.mdx`; the canonical path is inside a configured documentation root of the Workspace (default `docs/` plus root-level `README.md`, `SPECIFICATION.md`; list from Workspace settings); symlinks are resolved by the caller before this function (`lib:path-guard`, SEC002) and the function receives the canonical relative path; `anchor` (heading slug) when present MUST exist in the `DocIndex` entry.
2. The linked file MUST exist in the index at `gitCommit` (if given) or HEAD; a link to a deleted section yields `reject(reason: 'target_missing')`.
3. `validateTaskDocLink` outcomes: no link -> `reject('no_link')` for Chief-originated plans, `escalate('missing_doc_link')` when the Task came from the Owner or a Discussion outcome (so the Owner can point to the place or add Documentation); invalid link -> `reject`; valid -> `ok`.
4. `classifyGap(gap)`: Chief output already labels `kind`, but the label is a claim; the rules override it toward `what` in these cases: the gap concerns user-visible behaviour, scope inclusion or exclusion, a user-facing feature, a legal or privacy implication, money or accounts, data retention, or an external integration choice that changes what the product does; it is `how` only when it concerns an implementation choice with the same user-visible outcome (library, naming, internal structure, test framework). The rules operate on typed gap `topic` values from a closed enum (`library_choice`, `naming`, `internal_structure`, `test_framework`, `migration_strategy`, `feature_inclusion`, `feature_behaviour`, `integration`, `data_policy`, `pricing`, `other`); `other` is `what` (fail toward the Owner).
5. `how` gap handling result: `{ decideAlone: true, recordAs: 'decision', constraints: ['must_not_contradict_docs', 'must_fit_budget'] }`; `what` gap result: `{ decideAlone: false, route: 'owner_question' }` (question to the Owner in chat, task blocked until answered).
6. `DocIndex` limits: max 5000 entries, max anchor length 120; the function is linear in the number of tasks.
7. Deterministic, clock-free, no I/O.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`lib:path-guard` (SEC002) for canonicalisation upstream; `ProjectDocRef` contract (DATA) for the stored form (`workspaceId, path, gitCommit`).

## 8. Architecture and code placement

`packages/domain/src/chief/docs/{doc-link.ts,validate-task-link.ts,gap.ts,doc-index.ts}`.

## 9. Security and safety

Path traversal and symlink tricks in doc links are rejected structurally. Because documentation text is untrusted content, the rules never interpret document prose; they only check that a pointer exists. Defaulting unknown topics to `what` prevents Chief from granting itself scope decisions. A rejected link never creates a Task.

## 10. Errors and edge cases

- Anchor with different case or punctuation: slug-normalised comparison (documented algorithm, GitHub-style slugs).
- Doc root changed after tasks were created: existing tasks keep their link; new links validated against the new roots.
- Link to a file that exists in Git history only: `target_missing` unless `gitCommit` is given and exists.
- Duplicate links on many tasks: allowed.
- Link path with Windows separators or `%2e%2e`: rejected as invalid.

## 11. Acceptance criteria

- [ ] `../secrets.md`, `/etc/passwd`, `https://x/y.md`, `docs/a.txt` and `docs\\a.md` are rejected.
- [ ] A task with a valid link and existing anchor is `ok`.
- [ ] Task without link: `reject('no_link')` from Chief, `escalate('missing_doc_link')` from the Owner.
- [ ] Gap topics `library_choice` and `test_framework` classify `how`; `feature_inclusion` and `other` classify `what`; a Chief label of `how` on `feature_behaviour` is overridden to `what`.
- [ ] Performance: 1000 tasks validated against a 5000-entry index in under 50 ms.

## 12. Test plan

Table-driven tests; property test: no accepted link contains `..`. Command: `pnpm vitest run packages/domain/src/chief/docs`.

## 13. Parallelization notes

Parallel with CHIEF002/003. Used by CHIEF008. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: documentation roots default to `docs/` and root README; configurable per Workspace (WSPACE).
- ASSUMPTION: gap topic enum is a closed list extended additively.
