---
id: OVE_RUNUI012
title: "Show Run reproducibility: pinned graph, Agent, Skill, model and CLI versions"
area: RUNUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS013, OVE_DS051, OVE_RUNUI001, OVE_SHELL027, OVE_WFRT006, OVE_WFRT007, OVE_WFRT051]
soft_depends_on: []
provides: ["feature:runs-reproducibility", "lib:runs-pinned-model"]
needs: ["api:runs.get", "contract:NodeExecution", "event:run.versions_pinned", "ui:KeyValueList", "ui:Button", "lib:runs-data-hooks", "lib:app-navigation", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/runs/repro/**", "apps/desktop/src/locales/en/runs-repro.json", "apps/desktop/src/locales/pl/runs-repro.json"]
reads: []
design: design.png
design_source: "Activity#activity/reproducibility (crop 1150,555,280,140; heading plus block)"
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI012: Show Run reproducibility: pinned graph, Agent, Skill, model and CLI versions

## 1. Summary

The 'Odtwarzalność' block (SPEC 15): which Workflow Version, Agent configuration versions, Skill versions, models and CLI versions the Run is pinned to, as selectable mono key-values with links to each Version, and a 'Skopiuj' action.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. Mock lines: 'workflow v7 · przypięta', 'Developer konfig. v3', 'TypeScript v4 · tdd v2', 'claude 2.4.1 · codex 0.61'. Data: `run.versions_pinned` event and `NodeExecution.pinned { agentVersion, skills[{skillId, version}], providerId, modelId }` (WFRT006); CLI versions are recorded from the connection snapshot at Run start (PROV). The same record feeds replay and the exported report.

## 3. Scope (in)

- `pinned-model.ts` (pure): pinned record -> grouped lines.
- `ReproBlock` using `KeyValueList`.
- Links to the Version viewer, Agent profile and Skill version; 'Skopiuj' copies the block as text.

## 4. Out of scope

- Replay (`OVE_RUNUI013`), report (`OVE_RUNUI017`) reuse `pinned-model.ts`.

## 5. Detailed requirements

1. Lines: `workflow v7 · przypięta` (link to the Workflow Version viewer), one line per Agent used: `<Agent> konfig. v3` (link to the Agent profile at that version), `Skille: TypeScript v4 · tdd v2` (union per Agent shown under the Agent line when different), models `Opus 5.5 · Claude Code 2.4.1` per provider, `claude 2.4.1 · codex 0.61` CLI versions, `seed: <id>` only if the Run input recorded one.
2. Group by Agent when pinned Skills differ between Agents; otherwise a single merged line (mock shows merged).
3. Mono 11/12, selectable text, long values wrap anywhere; max 8 lines then '+N' disclosure.
4. 'Skopiuj' button copies the plain text block (exactly what is shown); success toast.
5. Data from `useRun(runId).pinned` (the pinned record on the Run) and the Node executions for per-Agent versions; a Run without a pinned record (should not exist) shows 'Brak zapisu wersji' in amber and logs an error.
6. Replay mode shows the same block unchanged (pinned versions are immutable); a note 'Replay nie uruchamia Agentów ani narzędzi'.
7. Loading skeleton lines; error inline.

## 6. Design notes

`design.png` shows the block as in the mock: heading 'Odtwarzalność' and four mono lines at 11/12. Links use the TextLink style (underline on hover); copy button appears on focus/hover at the right of the heading.

## 7. Reuse

- `ui:KeyValueList` (DS051), `ui:TextLink`, `ui:useToast`.

## 8. Architecture and code placement

`@RU/repro/pinned-model.ts` (pure), `ReproBlock.tsx`.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Versions and ids only; no prompts, Skill instructions or paths are shown.

## 10. Errors and edge cases

- Agent config version deleted by retention: line shows 'v3 (niedostępna)' without a link.
- Skill archived after the Run: still listed with its pinned version.
- CLI version unknown: 'wersja CLI nieznana'.

## 11. Acceptance criteria

- [ ] Given the mock pinned record, then the block equals `design.png`.
- [ ] Given differing Skills per Agent, then lines are grouped by Agent.
- [ ] Given 'Skopiuj', then the clipboard holds exactly the displayed text.
- [ ] Given no pinned record, then the amber notice shows.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

`pinned-model.test.ts` (grouping table), component tests, stories, axe, visual crop.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: the Run record exposes `pinned: { workflowVersionNo, cliVersions, agents[...] }` or it is assembled from `run.versions_pinned`; adapt in `pinned-model.ts`.
