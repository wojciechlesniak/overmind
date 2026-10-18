# OVE_SETUP023 generator integration scope

The integrator approved the task's section 8 placement on 2026-10-18: the thin
`tools/tasks/gen-index.ts` CLI and `tools/tasks/render/{index,dependencies,blocks,generate}.ts`,
plus this task's tests and fixture goldens. The front matter omits the render
directory even though section 8 explicitly assigns it to this task. Generated
`tasks/INDEX.md` and `tasks/DEPENDENCIES.md` are written only through the generator.
No normal task PR runs `--write-blocks` over the backlog.

The shared strict model previously rejected generated `blocks`, as proven by the
public `parseTask` regression before implementation. The integrator approved only
`tools/tasks/lib/model.ts` and its own `model.test.ts` to accept optional generated
`blocks` through the same metadata-ID schema; unrelated fields stay forbidden.
The integrator also approved `tools/tasks/lib/index.ts` re-exports of existing
`areaCodes`, `nodeFiles`, `confinedPath`, `createRunner`, and `TaskToolError`; their implementations
are unchanged. These keep the generator on the public task-library seam.

OVE_SETUP022 is unimplemented at this base. The generator reuses the current
public `topologicalLayers` unknown-dependency and cycle diagnostics, without a
second YAML parser or graph-validation algorithm. This does not claim task lint
has run or passed. No dependencies, CI policy or hook policy are changed.

The integrator additionally approved the existing `tools/tasks/lib/files.ts` and
its own `files.test.ts` for strict fatal UTF-8 decoding after the real public
reader and CLI regressions demonstrated lossy acceptance. Existing read bounds
and API are preserved. The generator denies malformed bytes before any writes.

The integrator approved exactly `tools/ci/architecture.ts` for the conditional
`pnpm gen:task-index --check` call required by task section 5.4. An isolated real
architecture-to-generator integration test verifies correct and stale output.
The existing registry and strict-missing behavior are preserved. No workflow is
changed. This fixture proves wiring only, not the full hosted pipeline.

The integrator approved `tools/tasks/render/blocks.parse-boundary.ts` after the
real CLI regression demonstrated that inserting after a plain line corrupts
valid unindented ADR sequences. It uses the pinned YAML AST source ranges and
the existing task schema only, then validates the edited metadata before writes.
It preserves source text/comments instead of serializing the document.

The integrator approved a deterministic fixture-only Git observer to demonstrate
a task-source lost update. The observer delegated every call to actual absolute
Git after changing a valid task body once. The failing CLI overwrote newer bytes;
the fix preserves them through expected-original checks at preflight, before
temporary-file creation and before rename. It adds no production injection API.

Verification history is retained honestly: the initial parallel focused run
passed 38/40 tests and failed two unchanged five-second CLI budgets beside the
heavy CI gate suite. A subsequent partial run was interrupted with exit 130 after
the integrator required serialization. The final single-worker run preserved both
original cases and every assertion, including the actual `--check` after editing
unindented ADR sequences; only unnecessary fixture commit history was removed.
It passed 41/41 focused tests and the real architecture integration. No timeout,
retry, threshold, assertion or repository testing policy was weakened. Native
typecheck, lint, formatting and actual generated-output hash comparison passed.
Full suites/security/independent review/hosted CI are still required before merge.

Independent review rejected candidate `78de095` with three P2 findings. Each
received an actual CLI red-to-green regression: Git's effective canonical
worktree must match the task root before the dirty-tree decision; zero-length
unified diff ranges use the preceding line count and apply through real Git;
and an existing blocks field is always moved immediately after ADR metadata.
The canonical-worktree regression also proves a valid `core.worktree` remains
accepted. Existing timeout budgets and every earlier assertion are preserved.

The root-coordinated full-gate run for `78de095` was interrupted with exit 130
after installation, formatting, lint, typecheck and 533 covered unit tests in
95 files passed; integration was in progress. This is incomplete evidence, not
a complete full-gate pass. A new candidate requires fresh full gates and reviews.

The revised author checkpoint passed native typecheck, lint, formatting and the
actual generated-output check. The unchanged-budget single-worker affected suite
passed 45/45 tests, including 24 actual CLI cases; the real architecture
integration passed 1/1. This does not replace fresh independent review, normal
pre-push hooks or a complete full-gate run on the new candidate.
