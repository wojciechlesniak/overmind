---
id: OVE_WFED068
title: "Show per-node permissions (narrow-only) and the 'Open chat' button in the Inspector"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS013, OVE_DS022, OVE_DS040, OVE_PERM005, OVE_PERM026, OVE_SHELL027, OVE_WFED063]
soft_depends_on: []
provides: ["feature:wfed-inspector-permissions", "feature:wfed-open-agent-chat"]
needs: ["api:perm.effective", "contract:EffectivePermissions", "ui:PathText", "ui:Button", "ui:InfoNote", "lib:app-navigation", "lib:api-client-perm"]
owns: ["apps/desktop/src/features/workflow-editor/inspector/sections/permissions.section.tsx", "apps/desktop/src/features/workflow-editor/inspector/sections/permissions-model.ts", "apps/desktop/src/features/workflow-editor/inspector/sections/open-chat.section.tsx"]
reads: []
design: design.png
design_source: "Main#canvas/inspector-permissions (crop 1160,680,270,65)"
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED068: Show per-node permissions (narrow-only) and the 'Open chat' button in the Inspector

## 1. Summary

The 'UPRAWNIENIA W TYM WĘŹLE' summary (writable paths, terminal, network, git push) computed by the engine as the intersection of policies, plus the pinned 'Otwórz czat z Developerem' button. The section is read-only: permissions can only be narrowed through policies elsewhere, and an Agent can only file an Access Request.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). ADR 0003 and SPEC 11: effective permissions are the intersection of Owner, Workspace, Agent, Workflow and Tool policies; delegation only narrows; visibility does not change permissions. A Node can override model, prompt and Skills but not permissions (ADR 0007). `api:perm.effective` resolves the five layers (PERM005/026). Mock text: 'Zapis: src/, tests/ · Terminal: tak', 'Sieć: nie · git push: wymaga Zgody'.

## 3. Scope (in)

- Section that requests effective permissions for (workspaceId, agentId, workflowId, nodeKey) and renders a compact list.
- Mapping `EffectivePermissions` -> display lines with Approval markers.
- Footnote and link to the Workspace permissions (Zgody / Workspace settings).
- 'Otwórz czat z <Agent>' button navigating to the Agent chat.

## 4. Out of scope

- Editing policies (WSPACE, PERM UI).
- Access Request handling (APPRUI).

## 5. Detailed requirements

1. Request `perm.effective` with `{workspaceId, agentId, workflowId, nodeKey}`; the server computes the intersection; the UI never intersects itself (single source of truth, DRY).
2. Lines: 'Zapis:' + `ui:PathText` chips for directories with write right (relative to the Workspace root, max 4 then '+N'); 'Odczyt:' only when it differs from write; '· Terminal: tak|nie'; 'Sieć: nie|<n domen>'; 'git push: wymaga Zgody' (amber word) or 'git push: nie'; 'MCP: tak|nie'. 'wymaga Zgody' comes from the default Approval list (ADR 0021) merged with Owner overrides, as returned by the server.
3. Values 'nie' are muted, 'tak' normal, 'wymaga Zgody' amber with a `◆` glyph (never colour alone).
4. Footnote: 'Prośba o więcej: Agent może poprosić o dostęp (Zgoda).' (copy from mock inventory) and a text link 'Zobacz politykę Workspace' to the Workspace settings.
5. Paths are shown as returned (canonical, display-shortened with `title` full); symlink targets are never resolved in the UI.
6. Loading skeleton; error: 'Nie udało się policzyć uprawnień' + retry; never show a fallback guess (fail closed: unknown = hidden with error).
7. Recompute on `policy.changed` and `override.changed` events.
8. Open chat button: `Otwórz czat z Developerem` (`secondary lg`, full width, `chat` icon, pinned bottom) navigates to the Agent chat route with the Agent id (`lib:app-navigation`); disabled with a reason for an Agent that is archived; label uses the Agent name (truncated with title).
9. No control in this section changes permissions; the only write-like affordance is the link to the Workspace settings.

## 6. Design notes

`design.png` shows heading 'UPRAWNIENIA W TYM WĘŹLE' mono 11 and 14/1.6 lines with mono path chips `src/` `tests/`; `design-open-chat.png` shows the bottom button (radius 14, violet-tinted border, chat icon). Loading and error states are derived from `ui:Skeleton` and inline error pattern.

## 7. Reuse

- `ui:PathText`, `ui:Button`, `ui:InfoNote`, `ui:Skeleton`; `lib:api-client-perm`; `lib:app-navigation`.

## 8. Architecture and code placement

`permissions-model.ts` (pure formatter), two sections registered in the Inspector registry.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. This section is the visible proof that the UI does not widen permissions: it is read-only, the numbers come from the engine, and an error hides the data instead of guessing. Paths are text only.

## 10. Errors and edge cases

- Agent has no policy (default deny): shows 'Zapis: brak · Terminal: nie · Sieć: nie'.
- More than 4 directories: '+N' with popover list.
- Workspace paused or isolation unavailable: the server may mark everything blocked; the section shows 'Izolacja niedostępna: akcje zablokowane' from the response.
- Agent not in this Workspace (private elsewhere): section not rendered.

## 11. Acceptance criteria

- [ ] Given the mock effective permissions, then the section equals `design.png`.
- [ ] Given an engine error, then no permission values are shown and a retry is offered.
- [ ] Given 'git push' in the Approval list, then it shows 'wymaga Zgody' with the glyph.
- [ ] Given a click on the chat button, then navigation targets the Agent chat of that Agent.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

`permissions-model.test.ts` (table), component tests, stories, axe, visual crop for both images.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: `perm.effective` accepts `nodeKey` for the node-level view; if only (agent, workflow) is supported the node-level equals the workflow-level intersection.
