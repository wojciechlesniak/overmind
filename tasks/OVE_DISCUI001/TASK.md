---
id: OVE_DISCUI001
title: "Create the discussions feature skeleton: manifest, route, region slugs and shared words"
area: DISCUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_ARCH011, OVE_DS038, OVE_SHELL027]
soft_depends_on: []
provides: ["lib:discussions-feature-skeleton", "lib:discussions-regions"]
needs: ["lib:feature-manifest", "lib:i18n-ui", "lib:shell-navigation", "ui:UiLabelsProvider"]
owns: ["apps/desktop/src/features/discussions/feature.manifest.ts", "apps/desktop/src/features/discussions/shared/**", "apps/desktop/src/locales/en/discussions.json", "apps/desktop/src/locales/pl/discussions.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 5"]
adr_refs: [15, 23, 28]
---

# OVE_DISCUI001: Create the discussions feature skeleton: manifest, route, region slugs and shared words

## 1. Summary

Creates the empty `features/discussions` feature: manifest with the Discussion route, the `data-region` slug constants from VIEWS.md section 8, the shared `discussions` i18n namespace (round and participant plurals, status words, stance words) and the UI labels bundle. Later DISCUI tasks fill it.

## 2. Context

The live Discussion view (`Dyskusja`, reached from the Chief conversation list, rail item `Chief`) lets the Owner watch a moderated, multi-Agent Discussion with an agenda and a round limit, see each participant's stance and the Skills they used (name and version, ADR 0008), speak in it, cast the deciding vote, approve or end the result, and see how a deadlock was resolved. Discussions start from a Workflow Node or by Chief (the Owner has no create action, ADR 0015, DISC014). Backend: DISC area (`contract:Discussion`, `contract:DiscussionMessage`, `contract:Stance`, `contract:DiscussionOutcome`, `contract:DiscussionSummary`, routes `/api/v1/workspaces/:wid/discussions/...`, events `discussion.*`), PAUSE (`lib:use-pause-guard`), PERM, CHIEF (Escalations). The UI area DISCUI composes `packages/ui-kit` components and shares the chat building blocks (`features/chat/markdown`, `safe`, `thread/virtual`) through their public entry files; it never re-implements a bubble, pill, card or list. Glossary: Discussion, Owner, Chief, Agent, Skill, Decision, Task, Escalation, Run, Workspace. ARCH009 defines `defineFeature`; SHELL collects manifests by glob. The Discussion route belongs to the Chief rail item (the list lives in the Chief conversation list); this feature registers the route `/chief/discussion/:discussionId` only.

## 3. Scope (in)

- `feature.manifest.ts` (id `discussions`, route, no rail item of its own).
- `shared/regions.ts`, `shared/labels.ts`.
- `discussions.json` EN and PL shared words.
- Route placeholder.

## 4. Out of scope

- Route content (DISCUI017).
- Other strings: each DISCUI task owns its own `discussions-<NNN>` namespace.

## 5. Detailed requirements

1. Manifest: `defineFeature({ id:'discussions', titleKey:'discussions:nav.title', namespaces: discussionsNamespaces() /* glob of locales/en/discussions*.json */, routes:[{ path:'/chief/discussion/:discussionId', element:()=>import('./routes/DiscussionRoute'), meta:{ activeNav:'chief' } }], requiresCapabilities:['api:discussion.list','api:discussion.get','api:discussion.messages'] })`; no `nav` entry (reached from the conversation list).
2. `DISCUSSION_REGIONS` constants: `list:'disc/list'`, `header:'disc/header'`, `roundProgress:'disc/round-progress'`, `thread:'disc/thread'`, `noticeChiefInitiated:'disc/notice-chief-initiated'`, `composer:'disc/composer'`, `positionsPanel:'disc/positions-panel'`, `outcomeDraft:'disc/outcome-draft'`, `tiebreakNote:'disc/tiebreak-note'`, `outcomeActions:'disc/outcome-actions'`; a test checks them against `tasks/_design/VIEWS.md`.
3. Shared words in `discussions.json` (EN / PL): `status.running` live / na żywo, `status.paused` paused / wstrzymana, `status.awaitingApproval` waiting for your approval / czeka na Twoje zatwierdzenie, `status.deadlocked` no agreement / brak zgody, `status.escalated` escalated / przekazana Tobie, `status.concluded` finished / zakończona, `status.cancelled` cancelled / anulowana, `status.failed` failed / nieudana, `stance.agree` for / za, `stance.noPreference` no preference / bez preferencji, `stance.conditional` conditional / warunkowo, `stance.disagree` against / przeciw, `round.label` Round {{current}} of {{total}} / Runda {{current}} z {{total}}, `count.participants_*` (PL one/few/many/other: uczestnik, uczestników...), `count.decisions_*`, `count.tasks_*`, `resolution.consensus|owner_vote|owner_decided|chief_decided|escalated` ('uzgodnili', 'Twój głos', 'zdecydowałeś Ty', 'rozstrzygnął Chief', 'przekazana Tobie'), `list.live` TRWAJĄ / RUNNING, `list.done` ZAKOŃCZONE / FINISHED, `list.heading` Dyskusje / Discussions.
4. `labels.ts`: `useDiscussionUiLabels()` for kit accessible names (thread, composer, round progress, stance).
5. Placeholder route renders `EmptyState`.
6. No import of api-client.

## 6. Design notes

N/A, functionality only. Words copied from `tasks/_design/VIEWS.md` section 8 copy list.

## 7. Reuse

- `defineFeature` (OVE_ARCH009), `useT` (OVE_ARCH011), `UiLabelsProvider` (OVE_DS038).

## 8. Architecture and code placement

`features/discussions/`: folder map fixed here: `model/` (002, 003), `data/` (003, 004), `list/` (005, 010), `header/` (006, 011), `thread/` (007, 012, 015), `composer/` (008, 013), `result/` (009, 014), `routes/` (017), `e2e/` (018, 019). i18n rule: `discussions.json` holds shared words only; every other task writes its own `discussions-<NNN>.json`.

## 9. Security and safety

Manifest declares required capabilities so the shell hides the route if the engine lacks Discussion routes. No I/O.

## 10. Errors and edge cases

- Capability missing: route hidden; direct URL shows the placeholder error.
- Duplicate route path: manifest collection fails at build.

## 11. Acceptance criteria

- [ ] `collectFeatures` accepts the manifest.
- [ ] Region constants equal VIEWS.md slugs (test).
- [ ] `pnpm i18n:check` passes with complete PL plural forms for `count.*`.
- [ ] No api-client import in the folder (lint).

## 12. Test plan

- Vitest: manifest zod validation, region test against VIEWS.md, labels render.
- Command: `pnpm --filter @overmind/desktop test features/discussions/shared`.

## 13. Parallelization notes

Hot spot: manifest and `discussions.json` (owned here only). Other DISCUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: the i18n lint accepts `discussions-<NNN>` sub-namespaces (same as CHATUI).
- ASSUMPTION: `meta.activeNav` keeps the Chief rail item active; else a proposal to SHELL.
