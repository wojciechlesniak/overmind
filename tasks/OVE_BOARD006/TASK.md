---
id: OVE_BOARD006
title: "Create Tasks with a mandatory, verified Project Documentation link"
area: BOARD
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT020, OVE_ARCH003, OVE_ARCH007, OVE_ARCH010, OVE_BOARD002, OVE_BOARD003, OVE_CHIEF015, OVE_DATA002, OVE_DATA010, OVE_DATA017, OVE_PERM008, OVE_PERM020, OVE_SEC002]
soft_depends_on: ["OVE_BOARD005"]
provides: ["usecase:board.create-task", "port:DocRefVerifier", "usecase:CreateTask"]
needs: ["lib:result", "lib:error-catalogue", "port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "port:AuditLog", "contract:Actor", "port:ProjectDocResolver", "port:WorkspaceRepository", "usecase:escalation.raise", "lib:path-canonicaliser", "port:AgentDirectory"]
owns: ["packages/application/src/board/create-task/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.4"]
adr_refs: [11, 16]
---

# OVE_BOARD006: Create Tasks with a mandatory, verified Project Documentation link

## 1. Summary

Implement the single entry point for creating a Task. It enforces ADR 0016: every Task points at a place in the Project Documentation, verified to exist; otherwise the creation is rejected or, where the caller asks, converted into an Escalation to the Owner. No other code path may insert a Task.

## 2. Context

ADR 0016: Project Documentation (Markdown files in the project folder, versioned in Git) and Owner Rules are the source of truth; each Task must follow from the Documentation; Agents add no scope of their own; a Task without a link is rejected or needs Escalation. SPEC 16 criterion 4: Chief creates Tasks from the Documentation, each with a link to the place in the Documentation. Gaps: a missing "how" is decided by Chief and recorded as a Decision; a missing "what" always goes to the Owner (SPEC 6). The mock shows the chip `spec.md#koszyk` on every card and the detail box `WYNIKA Z DOKUMENTACJI` with the quoted passage. Security: the repository (including docs) is untrusted content (SEC004), so a docRef proves provenance of scope, not permission.

## 3. Scope (in)

- Use case `createTask(input, actor)` and the `DocRefVerifier` port (adapter on top of DATA's `ProjectDocResolver`).
- Rejection and escalation paths for a missing or unverifiable docRef.
- Validation of assignee, lane, provenance and acceptance criteria on creation.
- Timeline `created` entry, event `task.created`, audit record on denied attempts.

## 4. Out of scope

- Batch creation from a Discussion outcome or a Chief plan: OVE_BOARD007 (it calls this use case per item inside one transaction).
- Changing a docRef later (`doc_ref_changed`): follow-up; not in MVP (Owner or Chief via a future task).
- How Chief decides a "how" gap: CHIEF area; this use case only reports `board.doc_ref_unresolvable` with the kind of failure.

## 5. Detailed requirements

1. **Input** `CreateTaskInput = { workspaceId, laneKey?: string (default: the first lane of category 'todo'), title, description?, docRef: { path, anchor?, quote? } | undefined, assigneeAgentId?, acceptanceCriteria?: {text}[], provenance: { origin, discussionId?, decisionId?, planId?, draftKey?, note? }, priority?, onMissingDocRef: 'reject' | 'escalate' (default 'reject') }`. The `actor` is a separate argument produced from the authenticated caller; `provenance.createdBy` is ALWAYS overwritten with it.
2. **Who may create:** `owner` and `chief` (any origin), `system` (Workflow `collect` Node, `origin: 'workflow_collect'`). `agent` and `channel` (Telegram) actors are refused with `board.move_not_permitted` (name reused: `details.operation = 'create'`), audited. Agents propose Tasks through typed proposals (DISC outcome drafts, `PlanProposal`) that Chief or Owner accepts; acceptance is what calls this use case (SEC004 R3).
3. **docRef enforcement, in order:**
   a. `docRef` absent or empty path: if `onMissingDocRef === 'escalate'` and actor is chief or system, call `usecase:escalation.raise({ kind: 'task_without_documentation', workspaceId, proposal: {title, provenance} })` and return `err(board.doc_ref_required, { escalationId })`; otherwise return `board.doc_ref_required`. NO Task row is created in either case.
   b. Canonicalise `path` against the Workspace's Documentation roots using `lib:path-canonicaliser` (SEC002): reject absolute paths, `..`, symlinks that leave the root, non-Markdown files (`.md`, `.mdx` only; ASSUMPTION) -> `board.doc_ref_outside_documentation` (audited, `details` holds the relative path only).
   c. `DocRefVerifier.verify(workspaceId, docRef)` -> `{ exists: boolean, gitCommit?: string, anchorFound?: boolean, excerpt?: string (<= 400 chars) }` via `ProjectDocResolver`: file must exist in the Workspace's Allowed Directory for documentation; if `anchor` is given it must match a Markdown heading slug or an explicit `{#id}` marker in the file (`anchorFound`); unresolved file or anchor -> `board.doc_ref_unresolvable` with `details.reason: 'file_missing' | 'anchor_missing'` (these map to the "gap" cases in ADR 0016).
   d. On success store `{ path, anchor, gitCommit (current HEAD blob/commit if available), quote: excerpt }`. `quote` is a snapshot used for the detail panel; it is data (never executed, sanitised on display).
4. **Lane and status.** Target lane = given `laneKey` or default todo lane; must be active and of category `todo` (creation into `doing`/`review`/`done` lanes is refused: `board.invalid_transition`). Initial status `queued`. WIP is checked as in BOARD008 for the lane (a hard WIP on the todo lane is uncommon; same rule applies).
5. **Assignee.** Optional; if given must pass `AgentDirectory.isUsableIn(agentId, workspaceId)` (visibility rules, ADR 0028); otherwise `board.workspace_mismatch`.
6. **Acceptance criteria.** Up to 20, ids generated, `met: null`.
7. **Atomicity.** In one `UnitOfWork`: insert Task (seq assigned by repository), append `created` timeline entry (summary template `board:timeline.created`, includes provenance origin), write `task.created` event row; after commit publish on the bus. Duplicate `(source, draftKey)` returns the existing Task as success with `duplicate: true` (idempotent for retries).
8. **Audit.** Any refusal for path escape or forbidden actor writes an audit event (`board.task_create_denied`, ids and relative path only).
9. **Output:** `Result<{ task: Task, duplicate: boolean }, AppError>`.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

`createTask` domain function (OVE_BOARD002); `ProjectDocResolver` and `ProjectDocRef` (DATA); path canonicaliser (SEC002); `usecase:escalation.raise`; `AuditLog`; error catalogue. The same verifier is reused by BOARD007 and, read-only, by DISC outcome validation (capability `port:DocRefVerifier`).

## 8. Architecture and code placement

Application layer `packages/application/src/board/create-task/{create-task.ts,doc-ref-verifier.ts,input.ts}`; `DocRefVerifier` is a thin port declared in `packages/application/src/ports/DocRefVerifier.ts` (owned here) implemented by an adapter over DATA's resolver in `apps/engine` composition (no adapter code in this task; a fake `FakeDocRefVerifier` is in `packages/testing/src/fakes/`). Domain stays free of I/O.

## 9. Security and safety

Trust boundaries: (1) the caller identity decides who may create (agents cannot); (2) the docRef path is attacker-influenced (Agent output, repo content) and must never reach the filesystem unchecked: canonicalise, no symlink escape, markdown-only, relative output; (3) the excerpt is untrusted repo text: capped and stored as data, never fed to prompts except through the PromptAssembler as a fenced block (SEC004); (4) a docRef proves where scope comes from; it grants nothing (permissions remain with PERM); (5) repository docs can be modified by Agents inside their worktree, so a docRef is verified at creation and recorded with the Git commit to make later divergence visible. Rejections never echo absolute paths. Fail closed: if the resolver is down, creation fails with `internal.unavailable`, no Task is created.

## 10. Errors and edge cases

- Path exists but outside the Documentation roots (e.g. `src/index.ts`): `board.doc_ref_outside_documentation`.
- Anchor given as `#koszyk` vs `koszyk`: normalised (strip leading `#`, lower-case slug compare with GitHub-style slugging, documented).
- Two Tasks with the same docRef: allowed (several Tasks per section are normal).
- Documentation file renamed after creation: existing Tasks keep the old path and show `docRefStale` in the read model (BOARD011 checks cheaply by commit); creation of new ones fails.
- Title only whitespace: `validation.invalid_input`.
- Retry after crash (same draftKey): idempotent success.
- Escalation port unavailable while `onMissingDocRef: 'escalate'`: returns `board.doc_ref_required` without escalation id and logs `error` (the caller must not assume an Owner was notified).

## 11. Acceptance criteria

- [ ] Creating without docRef returns `board.doc_ref_required` and creates no row (reject mode) or raises an Escalation (escalate mode).
- [ ] `../secrets.md`, absolute paths, a symlink escaping the root and `.ts` files are rejected with `board.doc_ref_outside_documentation` and an audit event.
- [ ] Missing file or anchor returns `board.doc_ref_unresolvable` with the reason.
- [ ] Agent and Telegram actors cannot create; Owner, Chief and system can.
- [ ] Task, `created` timeline entry and event are written atomically; crash between them leaves nothing.
- [ ] Duplicate draftKey is idempotent.
- [ ] A private Agent of another Workspace cannot be assigned.

## 12. Test plan

- Unit: `create-task.test.ts` with fakes (verifier scripted for each failure), authorisation matrix test (actor kinds x outcome), atomicity test using fake `UnitOfWork` with failure injection after repository insert.
- Security: path escape corpus (reuse SEC002 fixtures) fed into `docRef.path`.
- Commands: `pnpm vitest run packages/application/src/board/create-task`.

## 13. Parallelization notes

BOARD007 depends on this. BOARD008 and BOARD005 are independent. Hotspot: none; the verifier port is owned here, adapters are wired in the composition root (ENGINE) by a separate task.

## 14. Open questions and assumptions

- ASSUMPTION: only `.md` and `.mdx` count as Documentation files.
- ASSUMPTION: `onMissingDocRef` defaults to `reject`; Chief flows pass `escalate`.
- Open: where the "what vs how" classification of a documentation gap is made (CHIEF); this use case only reports the failure kind.
