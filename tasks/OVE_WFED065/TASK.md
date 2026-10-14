---
id: OVE_WFED065
title: "Add the Agent visibility switch to the Inspector with the in-use blocking report"
area: WFED
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT006, OVE_DS025, OVE_DS036, OVE_SHELL027, OVE_VIS005, OVE_VIS006, OVE_VIS008, OVE_WFED063]
soft_depends_on: []
provides: ["feature:wfed-visibility-switch"]
needs: ["ui:RadioCardGroup", "ui:Dialog", "api:agents.visibility", "api:visibility.impact", "contract:UsageReport", "contract:VisibilityBlockedBody", "lib:api-client-visibility", "ui:ConfirmDialog", "lib:app-navigation"]
owns: ["apps/desktop/src/features/workflow-editor/inspector/sections/visibility.section.tsx", "apps/desktop/src/features/workflow-editor/inspector/sections/visibility-model.ts", "apps/desktop/src/features/workflow-editor/inspector/BlockedReport.tsx"]
reads: []
design: design.png
design_source: "Main#canvas/inspector-visibility (crop 1160,355,270,135)"
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED065: Add the Agent visibility switch to the Inspector with the in-use blocking report

## 1. Summary

The 'WIDOCZNOŚĆ AGENTA' control: two radio cards (PUBLICZNY, PRYWATNY) with helper text, and a change flow that first asks the engine for the impact report. Making an Agent private while another Workspace uses it is blocked, and the Owner sees exactly where it is used.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). ADR 0028: only the Owner changes visibility; a visibility change creates a new Agent config Version; Runs keep the pinned Version; making a used element private is blocked until it is removed elsewhere; in an isolated Workspace everything is private and cannot change; a dynamic Agent is private until accepted. VIS005/006/008: `GET /v1/visibility/agent/{id}/impact?to=private` returns `{ allowed, reasons[], blockers: UsageReport }`; mutation `api:agents.visibility` returns `409 vis.used_elsewhere`. Mock: selected 'PRYWATNY — tylko tutaj', helper 'W tym Workflow działa jako TOR · Build: każde Zadanie przechodzi przez niego na Tablicy.'

## 3. Scope (in)

- `VisibilitySection` binding `RadioCardGroup` to the Agent.
- Impact pre-check, confirmation dialog, blocked report dialog (`BlockedReport`) listing Workspaces and Workflows/Agents that use the element.
- Result handling: toast 'Agent jest teraz prywatny. Nowa wersja konfiguracji v4.' and refreshed Inspector.
- Helper text and lane badge.

## 4. Out of scope

- Agent list visibility (AGUI).
- Chief proposals for visibility (VIS007).

## 5. Detailed requirements

1. Radio cards: `PUBLICZNY` + 'we wszystkich Workspace'ach' (blue), `PRYWATNY` + 'tylko tutaj' (violet); selected card border in its own colour; visibility always a word.
2. Changing the selection does not immediately mutate: (1) call `visibility.impact` with `to`; (2) if `allowed`, show the confirm dialog with consequence text: to public: 'Agent będzie widoczny w każdym Workspace. Jego Pamięć agenta nadal jest osobna dla każdego Workspace.'; to private: 'Agent zniknie z innych Workspace'ów. Działające Runy zachowują przypiętą wersję.'; (3) on confirm call `api:agents.visibility` with `expectedVersion` (the Agent's configVersion).
3. Blocked (`allowed:false` with `blockers`): open `BlockedReport`: title 'Nie można uprywatnić: Agent jest używany w innych Workspace'ach', list rows 'Workspace <name> · Workflow <name>' (names are Owner-facing; truncated at 200 with '+N'), each row has 'Otwórz' that navigates to that Workspace's Workflow (via `lib:app-navigation`, switches Workspace after Owner confirmation). The radio snaps back to the previous value.
4. Other reasons (`reasons[]`): `isolated_workspace` -> control disabled with 'Workspace izolowany: wszystko jest prywatne'; `dynamic_agent` -> 'Agent dynamiczny jest prywatny do czasu akceptacji' with a link to Agenci; `private_skills_on_public_agent` when going public with private Skills assigned: the report explains that those Skills keep working only in their Workspace (not blocked) and asks to confirm.
5. 409 from the mutation (race): same report with the server's body, radio snaps back.
6. `view` mode: radios `aria-disabled`, helper still shown.
7. Helper line: 'W tym Workflow działa jako <TOR · Build>' only when the Node has a lane (from `lane` in config) with the lane name in lane-green; keys `wfed.inspector.visibility.helper_lane`.
8. During Global Pause the change is allowed (no work starts), but the success toast is not suppressed.

## 6. Design notes

`design.png` shows two compact cards side by side (grid 1fr 1fr gap 8, radius 12, padding 10): selected card has 1.5px violet border; text 'PRYWATNY' mono 11 and 'tylko tutaj'. Blocked report dialog and confirm dialog are not in the mock: use `ui:Dialog` (confirm variant 480 / report variant 560) with list rows `ui:ListRow`.

## 7. Reuse

- `ui:RadioCardGroup`, `ui:Dialog`, `ui:ConfirmDialog`, `ui:ListRow`; `lib:api-client-visibility`; `toBlockedResponse` body type from VIS.

## 8. Architecture and code placement

`visibility-model.ts` (pure: decide dialogs from impact result), section component, `BlockedReport.tsx`. Depends on api-client and ui-kit.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. The report lists Workspace and referrer names only for the Owner; the UI never constructs these from other sources. The change is Owner-desktop only; the request carries `expectedVersion`. Private Agents of other Workspaces never appear because the query scope excludes them.

## 10. Errors and edge cases

- Impact says allowed but the mutation returns 409 (someone used it in between): report shown, no change.
- Agent has private Skills and goes public: confirm with explanation (Skills do not become public).
- Network failure on pre-check: control stays on previous value, inline retry.
- Report with 0 rows but `allowed:false` (reason only): show the reason text.

## 11. Acceptance criteria

- [ ] Given an Agent used in another Workspace, when PRYWATNY is chosen, then the blocked report lists those places and the radio returns to PUBLICZNY.
- [ ] Given an allowed change, then nothing changes until the confirm dialog is accepted and exactly one mutation call with `expectedVersion` is made.
- [ ] Given an isolated Workspace, then the control is disabled with the explanation.
- [ ] Given the mock data, then the section equals `design.png`.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

`visibility-model.test.ts` (impact -> dialog table), component tests for the flows with fake gateway, stories for confirm/blocked/disabled, axe, visual crop.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: the impact route accepts `kind=agent`; Workflow visibility uses the same pattern in WSPACE.
- ASSUMPTION: navigating to another Workspace's Workflow from the report switches the active Workspace after the Owner confirms.
