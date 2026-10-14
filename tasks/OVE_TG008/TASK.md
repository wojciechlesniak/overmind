---
id: OVE_TG008
title: "Answer /status with one sentence per active Workspace, safe for Telegram"
area: TG
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH015, OVE_PAUSE007, OVE_TG007, OVE_TG009]
soft_depends_on: []
provides: ["lib:telegram-status-command"]
needs: ["api:chief.workspace-summaries", "api:pause.state", "port:Translator", "lib:telegram-formatter"]
owns: ["packages/adapters/telegram/src/status-command/**"]
reads: []
design: design.png
design_source: "Telegram#tg/bubble-owner + tg/bubble-chief (crop 0,95,390,215)"
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 5", "SPECIFICATION 16"]
adr_refs: [6, 23, 28]
---

# OVE_TG008: Answer /status with one sentence per active Workspace, safe for Telegram

## 1. Summary

Implements the deterministic `/status` command: one sentence per active Workspace (as the Chief would say it), built from gateway read routes without starting a model turn, so it also works during Global Pause. Natural-language questions such as 'Jak idą testy?' go to the Chief (TG007).

## 2. Context

SPEC 3 (Telegram scenario): 'Jak idą testy?' reaches the Chief who answers in one sentence about each active Workspace. SPEC 4: on a general progress question the Chief answers one sentence per Workspace. SPEC 16.13: Telegram and desktop show the same state. The mock reply: 'Aplikacja rezerwacji: iteracja 2 z 5, 2 testy padają na kodzie rabatowym.' / 'Strona fundacji: 7 z 9 Zadań gotowe.' / 'Research rynku: wstrzymany.'.

## 3. Scope (in)

- `/status` handler producing the reply parts.
- Channel-filtering of the summaries (no absolute paths, no isolated Workspace names).
- Paused and empty cases.

## 4. Out of scope

- Generating the summary sentences: CHIEF (provides `api:chief.workspace-summaries`). Free-text status questions: Chief via TG007. Escaping and sending: TG009/TG013.

## 5. Detailed requirements

1. Data: `GET chief/workspace-summaries?channel=telegram` returns `[{ workspaceId, name, state: 'working'|'idle'|'paused'|'done', sentence, isolated }]` where `sentence` is the Chief's one-sentence status already composed by the CHIEF area (deterministic template from Run, Board and Quality Gate data; no model call). Pause state from `api:pause.state`.
2. **Filtering (T13):** isolated Workspaces are NOT listed by name (their existence would leak over a non-E2E channel): they contribute one trailing line 'Workspace'y izolowane: {{count}} (szczegóły przy komputerze).' only when count > 0. Sentences containing absolute paths are passed through `assertTelegramSafe`-style replacement (`<ścieżka>`); names and sentences are capped (name 40, sentence 160 chars).
3. **Active** means: a Run is running or waiting, or Approvals/Access Requests are open, or the Workspace is paused. Others are omitted. At most 8 lines, then 'i jeszcze {{n}} Workspace'ów'.
4. **Reply layout:** first line bold 'Chief' (sender label like the mock), then one line per Workspace `<name>: <sentence>`, a blank-free list. When Global Pause is active the first content line is 'Wszystko wstrzymane (Global Pause).'; a Workspace-only pause appears as '<name>: wstrzymany.' (mock: 'Research rynku: wstrzymany.').
5. No active Workspace: 'Brak aktywnych Workspace'ów. Wszystko spokojne.'.
6. The command works while Global Pause is active (read only, T10) and never calls a model.

## 6. Design notes

`design.png` shows the Owner bubble 'Jak idą testy?' (14:02) and the Chief bubble: bold pink-ish sender label 'Chief', then three lines: 'Aplikacja rezerwacji: iteracja 2 z 5, 2 testy padają na kodzie rabatowym.', 'Strona fundacji: 7 z 9 Zadań gotowe.', 'Research rynku: wstrzymany.', timestamp 14:02. In real Telegram the bubble look is Telegram's own; Overmind controls only the text: label line in bold, plain lines below. States not in the mock: global pause line, empty, isolated line, overflow line.

## 7. Reuse

- Formatter (TG009: `bold`, `plain`, `render`), Translator keys `telegram:status.*`, `api-client` read routes, `assertTelegramSafe` (ARCH015).

## 8. Architecture and code placement

`packages/adapters/telegram/src/status-command/{status-command.ts,filter.ts}` registered in the router's command registry (TG007); no other file edited.

## 9. Security and safety

- Channel filtering: no isolated Workspace names, no absolute paths, no Owner-only data (T13).
- Read-only: the command never changes state.
- Sentences are produced by the CHIEF area from structured data, so injected repository text cannot reach this reply except as capped parameters.

## 10. Errors and edge cases

- Gateway timeout: 'Nie mogę teraz odczytać statusu. Spróbuj przy komputerze.'.
- Workspace name with Markdown or HTML characters: escaped by the formatter.
- Very long summaries: truncated with '…'.
- Paused Workspace that also has open Approvals: sentence from the Chief plus nothing added here.

## 11. Acceptance criteria

- [ ] Given the three mock Workspaces, Then the reply equals the three mock lines under the 'Chief' label.
- [ ] Given one isolated Workspace, Then its name is absent and the isolated-count line appears.
- [ ] Given Global Pause, Then the first line says everything is paused and `/status` still works.
- [ ] Given no active Workspaces, Then the empty message.
- [ ] A sentence with '/Users/x/secret' is sanitised.

## 12. Test plan

Unit tests with fake api-client and the real formatter: `status-command.test.ts` (golden Polish and English), `filter.test.ts`, `paused-status.test.ts`. Command: `pnpm vitest run packages/adapters/telegram/src/status-command`.

## 13. Parallelization notes

Parallel with TG009 and TG010 after TG007 (registry extension point).

## 14. Open questions and assumptions

- Needs `api:chief.workspace-summaries` from CHIEF (one deterministic sentence per Workspace); if CHIEF composes it with a model, `/status` would stop working during pause. DEFAULT: deterministic template.
