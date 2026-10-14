---
id: OVE_RUNUI014
title: "Build the replay UI: controls, scrubber, speed, markers and Canvas replay link"
area: RUNUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS013, OVE_DS015, OVE_DS025, OVE_DS028, OVE_DS040, OVE_RUNUI004, OVE_RUNUI006, OVE_RUNUI012, OVE_RUNUI013]
soft_depends_on: []
provides: ["feature:runs-replay"]
needs: ["lib:runs-replay-engine", "ui:IconButton", "ui:Button", "ui:SegmentedControl", "ui:Tooltip", "ui:InfoNote", "lib:runs-pinned-model", "feature:runs-trace", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/runs/replay/ui/**", "apps/desktop/src/locales/en/runs-replay.json", "apps/desktop/src/locales/pl/runs-replay.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 15"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI014: Build the replay UI: controls, scrubber, speed, markers and Canvas replay link

## 1. Summary

'Replay zdarzeń' mode of the Activity view: a replay bar with play/pause, step, speed and a scrubber with markers; while active the Gantt, the events table and the usage-per-Agent show the state at the playhead and an explicit banner says nothing is executed. 'Otwórz replay na Canvas' opens the pinned Version with the overlay at the same position.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. The mock has the button 'Replay zdarzeń' (no replay mode drawn; VIEWS lists 'Replay mode (playhead, speed)' as not shown). The engine (`OVE_RUNUI013`) is pure; this task is the interaction layer and the visible honesty about what replay is: a re-display of recorded events with pinned versions of graph, Agent, Skill and model.

## 3. Scope (in)

- `ReplayBar` (bottom of the main column), `ReplayBanner`, scrubber with markers, keyboard shortcuts.
- Integration: playhead into trace (`playheadMin`), events table (rows up to the playhead), usage per Agent at the playhead.
- Canvas link (`/workflow/:id?run=<id>&replay=<seq>`) consumed by the editor page overlay (reuses the same controller).

## 4. Out of scope

- Engine (`OVE_RUNUI013`).
- Canvas-side replay rendering uses the overlay renderer (`OVE_WFED082`); this task only builds the link and the shared URL contract.

## 5. Detailed requirements

1. Entering replay: header 'Replay zdarzeń' -> loads events with a progress bar ('Wczytywanie zdarzeń 12 000 z 30 000'), then position at the start; live updates for this view stop (`OVE_RUNUI009` suspended) and a banner appears: 'Replay: oglądasz zapis zdarzeń Runu #14 z wersjami przypiętymi (workflow v7, Developer konfig. v3). Nic nie jest uruchamiane ponownie.' with 'Zakończ replay'.
2. Replay bar: play/pause (Space), step back/forward one event (`,` / `.`), previous/next marker (`[` / `]`), speed segmented 0,5x / 1x / 2x / 4x / 8x / max, time label '14:12:03 (08:21 z 18:00)', scrubber slider (role=slider, arrows seek 1 event, PageUp/Down 10%) with colour-and-glyph markers (✗ failure, ◆ approval wait, ⟳ iteration).
3. The scrubber shows the compressed-wait markers as small breaks with titles ('pominięto 3 min oczekiwania').
4. Gantt at the playhead: rows for executions started by then, running bars extended to the playhead, `playheadMin` marker; events table shows only entries with time <= playhead (client-side window over the already loaded feed pages, loading more pages when needed); usage per Agent computed from executions up to the playhead.
5. Clicking a trace row or table row while paused moves the playhead to that event's time (seek).
6. Failure markers jump: 'Przejdź do błędu' button.
7. Replay is available for finished Runs and for live Runs (up to the last known event with 'Wróć do bieżącego stanu').
8. Too-large Run: message 'Run zbyt duży do replay w aplikacji. Pobierz raport.' with a button to the export dialog.
9. Reduced motion: playback still advances but UI transitions are instant; auto-follow of the table disabled.
10. Announcements: on pause/seek the live region says the time and the last event text; during playback no per-event announcements (too noisy), only markers when paused on them.
11. The controller instance is created per selected Run; selecting another Run ends replay without confirmation.

## 6. Design notes

Not in the mock. Replay bar: 56 px high card above the page bottom of the main column (`ui:Card` r16 padding 12 16), play button as `IconButton` primary, scrubber 6px track with marker glyphs above, speed `SegmentedControl` compact. Banner uses `ui:InfoNote` (violet-neutral, not magenta).

## 7. Reuse

- `ui:IconButton`, `ui:SegmentedControl`, `ui:InfoNote`, `ui:Tooltip`; engine `OVE_RUNUI013`; pinned model `OVE_RUNUI012`.

## 8. Architecture and code placement

`@RU/replay/ui/` (`ReplayBar.tsx`, `Scrubber.tsx`, `ReplayBanner.tsx`, `use-replay.ts` (React binding of the controller), `replay-url.ts` pure).

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Replay performs only reads. The banner states plainly that nothing is executed so the Owner cannot mistake replay for a rerun. No 'Uruchom ponownie' button exists in this task (a re-run is a new Run from the Canvas).

## 10. Errors and edge cases

- Events still loading when the Owner presses play: play disabled until the first page is ready (progressive loading is not supported to keep determinism).
- Run finishes while in replay: stays on the loaded snapshot; banner offers 'Odśwież'.
- Playback at max speed on 100k events: frame-capped at 60 events/s per frame batch.
- Scrub beyond loaded feed pages: table loads pages until covered.

## 11. Acceptance criteria

- [ ] Given a finished Run, when play at 1x, then the playhead advances with gaps compressed and the Gantt follows.
- [ ] Given a seek back, then the Gantt, table and usage show the earlier state.
- [ ] Given the banner, then it states that nothing is re-executed.
- [ ] Given a marker, then `]` jumps to it and its text is announced.
- [ ] Given a too-large Run, then replay is refused with the export suggestion.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

Component tests with the engine on fixtures and fake raf; stories (`Loading`, `Playing`, `Paused`, `TooLarge`, `Ended`); keyboard tests; axe; e2e in `OVE_RUNUI023`.

## 13. Parallelization notes

Needs the editor overlay reducer (`OVE_WFED080`) through the engine. Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: Canvas replay uses the URL contract `?run=<id>&replay=<seq>`; the editor page (`OVE_WFED085`) must read it (flagged: small addition on the WFED side through `use-page-mode`).
- ASSUMPTION: replay of a live Run stops following new events.
