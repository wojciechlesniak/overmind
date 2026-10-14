---
id: OVE_SKUI001
title: "Skill view-model mappers and the skills i18n namespace"
area: SKUI
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_BOARDUI002, OVE_DS040, OVE_SKILL001]
soft_depends_on: []
provides: ["lib:skill-view-models"]
needs: ["contract:Skill", "contract:SkillVersion", "contract:SkillUsage", "contract:SkillScanFinding", "contract:SkillAssignment", "ui:UiDomainTypes", "ui:stateMaps", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/skills/model/**", "apps/desktop/src/locales/en/skills.json", "apps/desktop/src/locales/pl/skills.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 8"]
adr_refs: [12, 28]
---

# OVE_SKUI001: Skill view-model mappers and the skills i18n namespace

## 1. Summary

Pure mappers from the Skill contracts to the ui-kit props (`SkillCard`, `SkillDetail`, `SkillFilterBar`, `ProposalBanner`), the filter and sort helpers and the shared EN/PL strings of the `skills` namespace.

## 2. Context

Contracts (OVE_SKILL001): `Skill {id, name (slug), displayName?, description<=200, source: owner|chief|import, visibility, ownerWorkspaceId?, builtin, currentVersion, latestVersion, ...}`, `SkillVersion {version, instructions, requiredTools, status: accepted|pending_review|rejected, scan?, changeNote?, ...}`, `SkillUsage`. The mock (Skille.dc.html) fixes the copy: `8 zainstalowanych · publiczne działają w każdym Workspace, prywatne tylko w swoim`, source tags `Właściciel`, `Chief`, `import`, system tag `systemowy`, usage `3 agentów · 41 użyć`, `v4 · aktualna`, `źródło: Właściciel`. Skill text is instructions that will later steer an Agent, so it is the most sensitive untrusted text in the product (ADR 0012: Skills from the internet come only from the Owner and are untrusted until accepted). The UI shows it only as plain text (no Markdown-to-HTML, no links made clickable inside the text), never includes it in any prompt or request other than the explicit Owner action, and a Skill chip or `requiredTools` list is metadata, never a permission.

## 3. Scope (in)

- `skillToCard(skill, agents, usage, t)`, `skillToDetail(inspector, t, handlers)`, `skillFilterCounts(list)`, `applySkillFilter(list, filter)`, `scanToFindings(scan)`, `pendingToReviewRow()`, `usageLabel(agentCount, uses, t)`.
- The `skills` namespace (EN source, PL from the mock): words for visibility, source, version, usage plurals, scan severities, errors for `skill.*` codes.

## 4. Out of scope

- Fetching (OVE_SKUI002, 006), rendering (later tasks).

## 5. Detailed requirements

1. Card: `name` = `skill.name` (slug, mono); `version` = `v{currentVersion}`; `visibility` + word `PUBLICZNY|PRYWATNY` (key `skills:visibility.*`); `origin` from `source` (`owner`->`Właściciel`, `chief`->`Chief`, `import`->`import`); `system: true` for `builtin` (origin `systemowy`; the visibility word stays, see Open questions: the `overmind` Skill, mock last card); `description` plain text <=200; `agents` avatar stack from assigned Agents (`hueForAgentId`, initials) and `usageLabel` via plural keys: `1 agent · 18 użyć`, `3 agentów · 41 użyć` (Polish plural rules via ICU; EN `1 agent`, `3 agents`).
2. `skillFilterCounts`: `{ all, public, private, owner, chief, import }` over the library the Owner can see in this Workspace; the builtin `overmind` Skill counts under `all`, `public` and origin `owner` (the mock tags it `Właściciel` and counts 4 Owner Skills including it); counts always appear in the visible chip text (`Publiczne · 6`). Pending-review and rejected versions of NEW Skills are excluded from the library counts (they live in the review strip, OVE_SKUI012).
3. `applySkillFilter`: visibility is one of `all|public|private` (radio semantics), origins are a multi-select OR within the origin group, AND between groups; sort: system last, then name ascending (locale compare).
4. Detail: `versionLabel` = `v{currentVersion} · aktualna`; `sourceLine` = `źródło: Właściciel|Chief|import (host)` where the import host is the host name only (`SkillSource.origin`), never a full URL; `originNote` for import: `Zaimportowany przez Właściciela. Treść nie jest weryfikowana.`; for Chief: `Napisany przez Chief i zaakceptowany przez Ciebie.`.
5. `versions[]`: `v{n} · {date} · {changeNote}`; pending/rejected versions are shown with the words `oczekuje` / `odrzucona` and are not selectable as the current one.
6. `uses[]` (max 5): Run link (`Run #14 · Dostarczanie funkcji`), Agent avatar and `Developer · v4`, relative time (`13:40`, `wczoraj`) from `formatRelative`.
7. `scanToFindings`: severity word (`info|niskie|średnie|wysokie` keys), rule id, `line`, sanitised `excerpt` (plainText, <=120), message; findings sorted high to info; `high` count exposed for the review gate.
8. Unknown enum values map to neutral chips with the raw word; no mapper throws.
9. Namespace keys complete in EN and PL for all of the above plus `errors.*` for `skill.not_found|name_taken|invalid_instructions|too_large|version_conflict|builtin_immutable|visibility_in_use|import_owner_only|import_fetch_failed|import_blocked_host|scan_blocking|not_pending_review|assignment_not_visible|private_requires_workspace`.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

DS040 maps and `hueForAgentId`, `plainText` (OVE_BOARDUI002), `formatRelative` (OVE_ARCH011).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/skills/` (feature `skills`, route `/skills`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `model/{labels.ts,skill-card.ts,skill-detail.ts,filters.ts,scan.ts,usage.ts,index.ts}`; locale files owned here.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Skill with no assigned Agents: footer `nieużywany` instead of a stack.
- Name with 40 chars: ellipsis in the card (ui-kit).
- `latestVersion > currentVersion`: the card gets the word `nowa wersja czeka` (pending version).
- Missing `displayName`: slug only.
- Import origin host with punycode: shown as returned.

## 11. Acceptance criteria

- [ ] Given the eight fixture Skills, Then `skillFilterCounts` equals `Wszystkie 8, Publiczne 6, Prywatne 2, Właściciel 4, Chief 2, import 2`.
- [ ] Given `usageLabel(1, 18)`, Then `1 agent · 18 użyć`.
- [ ] Given an import source with a URL query in a bad fixture, Then the line shows only the host.
- [ ] Given unknown enums, Then no throw.
- [ ] `pnpm i18n:check` passes.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): table tests `skill-card.test.ts`, `filters.test.ts`, `scan.test.ts`, `usage.test.ts`; fixtures typed against contracts. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test skills`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_SKUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_SKUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. Locale files owned here only; later tasks use `skills-<topic>.json`.

## 14. Open questions and assumptions

- GAP (reported to SKILL): the library list needs, per Skill, the assigned Agents (id, name) and the use count for the card footer; `SKILL011` does not list them in the `GET /skills` response. This task assumes `items[].assignedAgents[]` and `items[].usageCount` (from `ListSkillLibrary`/`GetSkillInspector` aggregates).
- GAP (reported to DS071/design): the mock shows `overmind` as a normal PUBLICZNY card with the tag `Właściciel`, while DS071 and the mock states list it as the `system` variant (lock tag `systemowy`, no visibility badge). That would hide the visibility word (ADR 0028); this task shows the visibility word on the system card too and counts it as `Właściciel`; DS071 needs the `system` variant to keep the visibility badge.
