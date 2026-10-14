---
id: OVE_RUNUI015
title: "Map the tool call log: redacted calls, decisions and result summaries (pure)"
area: RUNUI
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS040, OVE_PERM007, OVE_RUNUI001, OVE_WFRT057]
soft_depends_on: []
provides: ["lib:runs-toolcalls-model"]
needs: ["contract:ToolCallRecord", "contract:AccessDecision", "ui:UiDomainTypes"]
owns: ["apps/desktop/src/features/runs/toolcalls/model/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 15", "SPECIFICATION 11"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI015: Map the tool call log: redacted calls, decisions and result summaries (pure)

## 1. Summary

Pure mapping from `ToolCallRecord` entries (tool, redacted arguments, decision, redacted result summary, duration, Approval link) to display rows and detail views, with strict rules about what is ever shown.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. SPEC 15: 'jakie Narzędzie wywołał, z jakim wynikiem i błędem' and 'redakcja sekretów i danych osobowych w logach'. Tool calls pass the Tool broker (permission check, isolation): a call can be allowed, blocked by isolation or policy, or wait for an Approval. The record is stored redacted by the engine (SEC003 redaction); the UI adds a second line of defence and shows a result summary, never the raw output.

## 3. Scope (in)

- `toToolCallRow`, `toToolCallDetail`.
- Decision/result labels and tones.
- Argument/result display rules (allow-listed fields, bounds).

## 4. Out of scope

- Rendering (`OVE_RUNUI016`).

## 5. Detailed requirements

1. `ToolCallRecord` fields used: `id, at, agentId, runId, nodeExecutionKey, tool ('terminal'|'file.read'|'file.write'|'network'|'git'|'mcp'|...), argsRedacted (object of allow-listed display fields), decision ('allowed'|'blocked_isolation'|'blocked_policy'|'needs_approval'|'approved'|'denied'), reasonCode?, approvalId?, resultRedacted?: { kind, summary, sizeBytes, truncated, redactions: number }, error?: { code, safeMessage }, durationMs`.
2. Row text: `terminal: npx playwright test cart/` (command truncated 200 chars), `sieć: registry.npmjs.org`, `odczyt ~/.ssh/config`, `zapis src/cart.ts`, `git commit w worktree dev/cart-discounts`; format by tool with a per-tool formatter registry (OCP): `registerToolFormatter(tool, fn)` default shows `tool: <first allow-listed arg>`.
3. Decision labels (PL): allowed 'ok', blocked_isolation 'zablokowane · izolacja', blocked_policy 'zablokowane · polityka', needs_approval 'czeka na Zgodę', approved 'ok · za Zgodą', denied 'odrzucone · Zgoda'.
4. Detail: shows args (allow-listed keys only), result summary text (bounded 500 chars), `sizeBytes` ('1,2 KB'), `redactions: 3` as 'ukryto 3 wartości', duration, error code word; never a raw output field.
5. The model drops any field not on the per-tool allow-list and any value matching secret-like patterns (`/(?:token|secret|password|authorization|api[_-]?key)\s*[:=]/i`) replacing it with `[ukryto]` (defence in depth; the engine already redacts).
6. Command strings are shown as text; no linkification; control characters are replaced by `�`.
7. Sorting by time asc within an execution; filters by Agent, decision category (only blocked), tool.
8. Unknown tool: generic formatter.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Result categories shared with `OVE_RUNUI007` (`result-map.ts` import for the decision mapping).

## 8. Architecture and code placement

Pure TS `@RU/toolcalls/model/` (`formatters/`, `decision-map.ts`, `sanitize.ts`).

## 9. Security and safety

This model is a safety layer: allow-lists per tool, secret-like pattern masking and control-character stripping. A hostile Agent that prints a token into a command line cannot make the UI display it if the pattern matches; the engine redaction remains the primary control (SEC003).

## 10. Errors and edge cases

- Argument object with 1 MB string: bounded to 200 chars.
- Unknown decision: shown as 'nieznana decyzja' (neutral).
- Missing result (call blocked): detail says 'Brak wyniku: akcja nie została wykonana'.
- Nested objects in args: flattened to depth 1 with '…'.

## 11. Acceptance criteria

- [ ] Mock commands map to the exact copy.
- [ ] A secret-like value in args is masked in output (corpus from `lib:injection-corpus`/`lib:audit-no-secrets-test`).
- [ ] Fields outside the allow-list are never present in output.
- [ ] Every decision value has a label and tone (exhaustive test).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` and the boundary check pass; the module imports nothing from React, `api-client` or the DOM (pure logic) unless the task says otherwise.

## 12. Test plan

`formatters.test.ts`, `sanitize.test.ts` (secret corpus), `decision-map.test.ts`. `pnpm --filter desktop vitest run src/features/runs/toolcalls/model`.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: `ToolCallRecord` contract is produced by the tool broker area (BOX/PERM); no owner task yet (flagged).
