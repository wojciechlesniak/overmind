---
id: OVE_WFED066
title: "Add the model picker with fallback to the Inspector (per Agent or per Node)"
area: WFED
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_DS025, OVE_DS028, OVE_DS030, OVE_DS080, OVE_PROV002, OVE_PROV018, OVE_WFED007, OVE_WFED063]
soft_depends_on: []
provides: ["feature:wfed-model-picker"]
needs: ["ui:ModelPicker", "ui:Popover", "ui:RadioCardGroup", "api:connections.list", "api:agents.update", "usecase:ListFallbackCandidates", "lib:api-client-agents", "lib:editor-commands", "ui:FallbackOrder"]
owns: ["apps/desktop/src/features/workflow-editor/inspector/sections/model.section.tsx", "apps/desktop/src/features/workflow-editor/inspector/sections/model-model.ts"]
reads: []
design: design.png
design_source: "Main#canvas/inspector-model (crop 1160,480,270,115)"
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED066: Add the model picker with fallback to the Inspector (per Agent or per Node)

## 1. Summary

The 'MODEL' section: shows the effective model for the Node ('Claude Code · Opus 5.5') and the fallback ('Zapasowy: Codex CLI · gpt-5.5'), and lets the Owner change it either for this Node only (a Node override in the Draft) or as the Agent default (a new Agent config Version).

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). ADR 0007: model is chosen per Agent and per Node; a Node can override model, prompt and Skills but never permissions. PROV003 resolves Node override > Agent default. SPEC 9: only models of connected CLIs (Claude Code, Codex CLI) and Ollama as fallback; limits are shown as the CLI reports them. The picker lists models from `api:connections.list`.

## 3. Scope (in)

- `ModelSection` with the current model row, fallback line and 'Zmień' picker.
- Scope chooser: 'Tylko w tym Węźle' (writes `overrides.model` into the Node config through part 1 commands) vs 'Domyślnie dla Agenta' (calls `api:agents.update`, new config Version).
- Fallback selection (from `ListFallbackCandidates`) and ordering display.
- Availability markers: connection status, 'wymaga zalogowania', 'limit wg CLI 62%'.

## 4. Out of scope

- Connections and models settings (CONNUI).
- Model switching on limit exhaustion (PROV018).

## 5. Detailed requirements

1. Current model: if the Node has `overrides.model` show it with a 'nadpisanie w tym Węźle' tag, else the Agent's `providerId/modelId` ('domyślny Agenta').
2. Picker (`ui:ModelPicker`): groups by connection ('Claude Code', 'Codex CLI', 'Ollama · lokalnie'); each option shows model name, status (word + glyph), and the limit as `62% · reset 3 h · wg CLI` when known; unavailable connections are listed disabled with the reason (not hidden).
3. Scope chooser appears as the first step in a Popover with two radio cards; default is 'Tylko w tym Węźle' because it does not change the Agent elsewhere (and the Agent may be used in other Workflows).
4. Node scope: dispatch editor command `setNodeModelOverride(nodeKey, {providerId, modelId, fallback?})`; 'Wyczyść nadpisanie' removes it. Agent scope: confirm dialog 'Zmienić model Agenta w całej aplikacji? Powstanie nowa wersja konfiguracji. Działające Runy zachowują poprzednią.' then `agents.update` with `expectedVersion`; the Draft is not changed.
5. Fallback: `Zapasowy: Codex CLI · gpt-5.5` from `overrides.model.fallback` or the Agent's fallback; 'Brak modelu zapasowego — przy limicie nastąpi Eskalacja' in amber when none (SPEC 9).
6. Capability mismatch: when the selected provider lacks a capability the Node needs (for example JSON output for a Node with `outputSchema`), the section shows an amber note 'Ten model nie obsługuje ustrukturyzowanego wyniku' (data from `ProviderCapabilities` in the connections response) and the validator remains authoritative.
7. `view` mode: row is read-only.
8. The chevron is `chevron-down` (inventory E4), keyboard: Enter/Space opens the picker, Esc closes.

## 6. Design notes

`design.png`: row card (padding 12 14, radius 14, bg `#140F20`, 1px line) with 'Claude Code · Opus 5.5' 15/600 and chevron, below it 'Zapasowy: Codex CLI · gpt-5.5' 13px secondary. The picker popover, scope chooser and unavailable options are not in the mock: derive from `ui:ModelPicker` and `ui:Popover`.

## 7. Reuse

- `ui:ModelPicker`, `ui:Popover`, `ui:RadioCardGroup`, `ui:FallbackOrder` (read-only display), part 1 `lib:editor-commands`.

## 8. Architecture and code placement

`model-model.ts` (pure: connection list + selection -> option groups, availability), section component; two write paths isolated in `write-node-override.ts` and `write-agent-default.ts`.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Model ids come from the connections response, never from free text. The section cannot set permissions or secrets; a Node override carries no credentials. Provider terms gating (`provider.terms_changed`) disables the affected connection with its reason.

## 10. Errors and edge cases

- Selected model's connection removed: row shows 'Model niedostępny' in error tone; validator error appears.
- Login expired: option disabled 'wymaga zalogowania' with link to Połączenia.
- Agent update conflict (config version changed): refetch and keep the picker open with a notice.
- No connections at all: empty state 'Brak podłączonych CLI' with link to Połączenia.

## 11. Acceptance criteria

- [ ] Given the default scope, when a model is chosen, then only the Draft gets `overrides.model` and no Agent update is sent.
- [ ] Given 'Domyślnie dla Agenta', then a confirm dialog precedes exactly one `agents.update` with `expectedVersion`.
- [ ] Given no fallback, then the amber escalation note shows.
- [ ] Given the mock data, then the section equals `design.png`.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

`model-model.test.ts`, section tests with fake connections, stories (`NodeOverride`, `AgentDefault`, `NoFallback`, `Unavailable`, `LoginNeeded`), axe, visual crop.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: `api:connections.list` includes per-model capability and reported limit; if the limit field is missing the line is omitted.
