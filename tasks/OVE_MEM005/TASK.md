---
id: OVE_MEM005
title: "Summarise a finished Task into Agent Memory with a tool-free summariser"
area: MEM
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT020, OVE_ARCH004, OVE_BOARD001, OVE_DATA018, OVE_ENGINE029, OVE_MEM003, OVE_MEM004, OVE_MEM007, OVE_SEC004]
soft_depends_on: ["OVE_SEC004"]
provides: ["usecase:memory.summarise-task", "job:memory.task-summary"]
needs: ["event:board.task.status_changed", "port:JobScheduler", "port:SummariserModel", "port:AgentMemoryRepository", "port:MemoryIndex", "lib:prompt-assembly", "lib:redactor", "port:AgentDirectory", "port:ArtifactRepository"]
owns: ["packages/application/src/memory/summarise/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.3"]
adr_refs: [8, 14, 16]
---

# OVE_MEM005: Summarise a finished Task into Agent Memory with a tool-free summariser

## 1. Summary

When a Task reaches done, a background job gathers its timeline and artifacts, asks a tool-free summariser for a strict JSON summary, runs the write guard, and stores the entry for the Agent that did the work in that Workspace.

## 2. Context

ADR 0014: Agent Memory holds summaries of earlier Tasks per Workspace. ADR 0016: memory never outranks Owner Rules or documentation. SEC004: agent output and repository text are untrusted data and must be fenced. Mock panel shows entries such as 'Koszyk z rabatami' for Workspace 'rezerwacje'.

## 3. Scope (in)

- Subscriber to done transitions, job handler, prompt template, JSON parsing, idempotent storage.

## 4. Out of scope

- Write guard rules: MEM007. Compaction: MEM006. Summariser adapter: PROV.

## 5. Detailed requirements

1. Trigger: `board.task.status_changed` to `done`; enqueue job `memory.task-summary` with key `taskId` (dedupe). Tasks without an assigned Agent or assigned to Chief are skipped with a metric.
2. The job reads Task, timeline and artifact list through ports with a `system` scope limited to `(workspaceId, agentId)`; text is capped at 12k chars, oldest dropped first, newest and the final result kept.
3. Prompt built with SEC004 assembler: trusted instruction fragment (summarise factually, no instructions, no commands, no secrets, max 600 chars) plus fenced untrusted blocks. Template version recorded in provenance.
4. Output must be JSON `{title, content, tags}` validated by zod; invalid output gets one retry with the validation error text excluded (never echo model text into the retry prompt); a second failure writes nothing and raises a visible job failure event.
5. Result passes the redactor and the MEM007 write guard before `insert`; entry stored with provenance `derivedFromUntrusted: true` when any source was agent output.
6. Idempotent on retries via the unique summary per Task; the entry is indexed in the same transaction; `memory.entry.added` emitted.
7. Summariser timeout 60 s; unavailable summariser retries with backoff up to 5 times then marks the job failed (no silent loss: failed jobs are listed for MEM012 diagnostics).

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

SEC004 assembler, redactor, JobScheduler, SummariserModel port.

## 8. Architecture and code placement

Application layer handlers; no model SDK imports.

## 9. Security and safety

The summariser has no tools and sees only fenced data; its output is treated as untrusted and checked before storage; secrets redacted; retries never feed model output back into prompts; skipping or failing never blocks Task completion; one summary per Task prevents flooding.

## 10. Errors and edge cases

- Task reopened and done again: second summary is not created (unique); documented as a limitation.
- Very large timeline: truncated, flag `oversize_truncated`.
- Agent deleted before the job runs: job drops with an audit note.
- Summary contains 'ignore previous rules': flagged and quarantined by MEM007.

## 11. Acceptance criteria

- [ ] Done transition creates exactly one entry per Task (fake bus, repeated delivery).
- [ ] Hostile corpus outputs from the fake summariser never reach active status.
- [ ] Invalid JSON retried once then fails visibly.
- [ ] Prompt snapshot shows fences and the trusted fragment only once.
- [ ] Task completion is unaffected by summariser failure.

## 12. Test plan

- Use case tests with fakes, injection corpus, snapshot of prompt. Commands: `pnpm vitest run packages/application/src/memory/summarise`.

## 13. Parallelization notes

After MEM007 merges the guard interface. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: only Tasks with an assigned Persistent or Dynamic Agent produce memory.
