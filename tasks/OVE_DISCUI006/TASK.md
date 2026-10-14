---
id: OVE_DISCUI006
title: "Build the Discussion header region: title, live pill, round bar, Run state (static)"
area: DISCUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DISCUI002, OVE_DS013, OVE_DS017, OVE_DS040, OVE_DS083]
soft_depends_on: []
provides: ["ui:DiscussionHeaderView"]
needs: ["ui:DiscussionHeader", "ui:RoundBar", "ui:Pill", "ui:Button", "ui:RunLink"]
owns: ["apps/desktop/src/features/discussions/header/view/**", "apps/desktop/src/locales/en/discussions-006.json", "apps/desktop/src/locales/pl/discussions-006.json"]
reads: []
design: design.png
design_source: "Dyskusja#disc/header (crop 332,117,798,129)"
spec_refs: ["SPECIFICATION 6"]
adr_refs: [15]
---

# OVE_DISCUI006: Build the Discussion header region: title, live pill, round bar, Run state (static)

## 1. Summary

Composes the header of the live Discussion from the kit `DiscussionHeader`: title `Płatności: Stripe czy Przelewy24?`, live pill `na żywo`, `Wstrzymaj`, agenda, the four-segment round bar `Runda 2 z 4` and the Run branch note. Static with all statuses derived.

## 2. Context

The live Discussion view (`Dyskusja`, reached from the Chief conversation list, rail item `Chief`) lets the Owner watch a moderated, multi-Agent Discussion with an agenda and a round limit, see each participant's stance and the Skills they used (name and version, ADR 0008), speak in it, cast the deciding vote, approve or end the result, and see how a deadlock was resolved. Discussions start from a Workflow Node or by Chief (the Owner has no create action, ADR 0015, DISC014). Backend: DISC area (`contract:Discussion`, `contract:DiscussionMessage`, `contract:Stance`, `contract:DiscussionOutcome`, `contract:DiscussionSummary`, routes `/api/v1/workspaces/:wid/discussions/...`, events `discussion.*`), PAUSE (`lib:use-pause-guard`), PERM, CHIEF (Escalations). The UI area DISCUI composes `packages/ui-kit` components and shares the chat building blocks (`features/chat/markdown`, `safe`, `thread/virtual`) through their public entry files; it never re-implements a bubble, pill, card or list. Glossary: Discussion, Owner, Chief, Agent, Skill, Decision, Task, Escalation, Run, Workspace.

## 3. Scope (in)

- `DiscussionHeaderView`.
- Fixtures for running, paused, waiting for approval, no agreement, escalated, finished, cancelled, failed.
- Region attributes.

## 4. Out of scope

- Control behaviour (DISCUI011).

## 5. Detailed requirements

1. Props: `{ title, status, statusLabel, agenda, round:{current,total,label}, segments:('done'|'current'|'todo')[], runState?:{label; onOpenRun?}, actions:{ pause?: ControlSpec; resume?: ControlSpec; concludeNow?: ControlSpec; cancel?: ControlSpec }, pausedReason?: string }`.
2. Pill by status: running magenta `na żywo`; paused neutral `wstrzymana`; awaiting approval violet `czeka na Twoje zatwierdzenie`; deadlocked amber `brak zgody`; escalated amber `przekazana Tobie`; concluded mint `zakończona`; cancelled and failed neutral/error words. Colour never the only signal (word + dot/icon).
3. Round bar via `RoundBar`; `aria-label` `Runda 2 z 4`; meta row mono 12 muted: `Agenda: <text>` · bar + `Runda 2 z 4` · `Run #14 wstrzymany w gałęzi „Płatności”, reszta pracuje` (link to the Run when `onOpenRun`).
4. `Wstrzymaj` (secondary, md) only when `actions.pause`; when paused the same slot shows `Wznów`.
5. Secondary actions `Zakończ teraz` and `Anuluj Dyskusję` live in the result panel and a header overflow menu respectively (`ui:Menu`): `Anuluj Dyskusję` is rare and destructive, hidden in a menu with a confirmation (DISCUI011).
6. Region `data-region='disc/header'`, round bar `disc/round-progress`.

## 6. Design notes

`design.png` shows title 22/700, magenta `na żywo` pill, secondary `Wstrzymaj` at the right, and the meta row `Agenda: wybór bramki płatności dla MVP · [4 segments] Runda 2 z 4 · Run #14 wstrzymany w gałęzi „Płatności”, reszta pracuje`. Geometry DS083. Not in the mock: all other statuses, paused, overflow menu, loading, narrow layout.

## 7. Reuse

- `ui:DiscussionHeader`, `ui:RoundBar` (OVE_DS083), `ui:Menu` (OVE_DS029), `ui:RunLink` (OVE_DS040).

## 8. Architecture and code placement

`features/discussions/header/view/`. **i18n namespace:** this task writes its strings into its own namespace `discussions-006` (files `locales/en|pl/discussions-006.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `discussions-006`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Presentational only: no data access, no network, no storage. All text arrives as props and is rendered as React text; fixtures contain only synthetic data (no realistic secrets). Disabled states carry a reason text, never a silent disabled control.

## 10. Errors and edge cases

- Agenda 2000 chars: clamp to 2 lines with title attribute.
- No Run (Node-less Chief discussion): meta without Run text.

## 11. Acceptance criteria

- [ ] `Default` story matches `design.png`.
- [ ] Storybook stories exist for every state listed here (including those not in the mock), i18n keys have EN and PL entries and `pnpm i18n:check` passes, axe is clean, the component is keyboard operable with a visible focus ring.
- [ ] Every status story shows a worded pill.

## 12. Test plan

- Storybook for each status; Testing Library for menu and button callbacks; visual comparison.
- Command: `pnpm --filter @overmind/desktop test features/discussions/header/view`.

## 13. Parallelization notes

No hotspot. Other DISCUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- Missing kit piece: header overflow menu is not in DS083; compose with `ui:Menu` here.
