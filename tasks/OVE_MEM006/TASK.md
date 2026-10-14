---
id: OVE_MEM006
title: "Compact and retire old Agent Memory entries on a schedule"
area: MEM
kind: feature
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_ENGINE029, OVE_MEM003, OVE_MEM004, OVE_MEM005, OVE_SEC004]
soft_depends_on: []
provides: ["usecase:memory.compact", "job:memory.compaction", "job:memory.retention"]
needs: ["port:JobScheduler", "port:SummariserModel", "port:AgentMemoryRepository", "port:MemoryIndex", "port:MemoryDeleteGuard", "lib:prompt-assembly"]
owns: ["packages/application/src/memory/compact/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.3"]
adr_refs: [14]
---

# OVE_MEM006: Compact and retire old Agent Memory entries on a schedule

## 1. Summary

Keep memory bounded: when an Agent has more than 40 active entries or 30,000 characters in a Workspace, summarise the oldest 20 into one compaction entry; keep originals as `compacted` for 180 days, then delete them through the typed guard.

## 2. Context

SPEC 10 retrieval-based memory must not grow without limit or flood prompts. ADR 0014: memory stays local. Compaction is another summariser call over agent-derived text, so it inherits all poisoning risks.

## 3. Scope (in)

- Threshold check after each insert, compaction job, retention job.

## 4. Out of scope

- Selection for prompts: MEM008.

## 5. Detailed requirements

1. After every insert, a check enqueues `memory.compaction` for `(agentId, workspaceId)` with dedupe key if thresholds are exceeded.
2. The job selects the oldest 20 `active` task summaries, builds a fenced prompt, parses `{title, content, tags}`, runs the MEM007 guard, inserts a `compaction` entry (sources up to 50 Task ids, provenance origin `compaction`, `derivedFromUntrusted` true if any child was), and marks children `compacted` with `compactedIntoId`, all in one transaction.
3. Failed compaction leaves everything unchanged; retry with backoff; no deletion happens on failure.
4. Quarantined entries are never compacted into others.
5. Retention job (daily): deletes `compacted` entries older than 180 days through the `retention` guard; emits `memory.entries.purged`.
6. Compacted entries are removed from the index; compaction entries are indexed.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

Same summariser seam and guard as MEM005.

## 8. Architecture and code placement

Application handlers.

## 9. Security and safety

Compaction cannot launder quarantined content (excluded), cannot cross Workspaces or Agents (job scope), and cannot delete before the retention window; atomic swap prevents partial loss.

## 10. Errors and edge cases

- Concurrent insert during compaction: selection by id list, new entries unaffected.
- Compaction summary larger than limit: truncated and flagged.
- Agent with 41 tiny entries: threshold by count triggers.

## 11. Acceptance criteria

- [ ] 41 entries trigger one compaction of the oldest 20 (fake clock).
- [ ] Failure leaves entries untouched.
- [ ] Quarantined entries excluded.
- [ ] Retention deletes only compacted entries older than 180 days.
- [ ] Entries from another Agent or Workspace are never touched.

## 12. Test plan

- Use case tests with fake clock and summariser. Commands: `pnpm vitest run packages/application/src/memory/compact`.

## 13. Parallelization notes

Independent of MEM008 and MEM009.

## 14. Open questions and assumptions

- ASSUMPTION: thresholds are constants; configurable later.
