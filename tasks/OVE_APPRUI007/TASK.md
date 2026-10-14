---
id: OVE_APPRUI007
title: "Change previews by action class: commits, diff, domain, delete list and key facts"
area: APPRUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_APPRUI001, OVE_APPRUI003, OVE_APPRUI006, OVE_BOARDUI002, OVE_DATA019, OVE_DS051, OVE_DS052]
soft_depends_on: []
provides: ["lib:approval-previews"]
needs: ["ui:DiffView", "ui:KeyValueList", "ui:TerminalBlock", "ui:SafeLink", "lib:parseUnifiedDiff", "lib:ui-safe-text", "api:artifacts.content", "lib:approvals-route"]
owns: ["apps/desktop/src/features/approvals/regions/preview.region.tsx", "apps/desktop/src/features/approvals/components/previews/**", "apps/desktop/src/locales/en/approvals-preview.json", "apps/desktop/src/locales/pl/approvals-preview.json"]
reads: []
design: design.png
design_source: "Zgody#appr/diff-preview (crop 452,328,968,196 CSS px) (crop 452,328,968,196 CSS px)"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 14"]
adr_refs: [3, 21]
---

# OVE_APPRUI007: Change previews by action class: commits, diff, domain, delete list and key facts

## 1. Summary

Renders `PODGLĄD ZMIANY` for each action class: the unified diff when the engine provides one (mock git push), the commit list, the new-domain command block, the delete path list with `+N więcej`, and key-value previews for publish, message, payment and budget.

## 2. Context

PERM013 previews are engine-built and bounded: `delete_files {paths[] max 20, totalCount}`, `git_push {remote, branch, commits[{sha7, subject}] max 10, forcePush}`, `publish`, `external_message`, `payment`, `new_domain {host}`, `budget_overrun`. Untrusted text (commit subjects, message body excerpts) is marked `untrusted: true`. The mock shows a unified diff for git push (`@@ src/cart/discount.ts`, `- return price - code.amount`, `+ ...`) in `DiffView` mono 12/1.7 with add/del/context lines.

## 3. Scope (in)

- `preview.region.tsx` (slot `approval-preview`) selecting a renderer by class; one small component per class in `components/previews/`.
- Diff loading from an artifact reference when the preview has one.

## 4. Out of scope

- The facts row (OVE_APPRUI006).

## 5. Detailed requirements

1. `git_push`: when the preview has `diffArtifactId` the diff text is fetched (`GET /v1/artifacts/{id}/content`, cap 200 KiB, plain text) and rendered with `DiffView` after `parseUnifiedDiff` (OVE_DS051); otherwise a list `sha7  subject` (up to 10) under the label `Commity do wysłania`; `forcePush` shows a red word `WYMUSZONY PUSH` badge (word plus icon).
2. `new_domain`: `TerminalBlock` with the engine command context and the host in mono; text `Agent prosi o dostęp do tego hosta. Szczegóły sieci sprawdzisz w Uprawnieniach Workspace'u.`
3. `delete_files`: scrollable list of display paths in a terminal-tone error-tinted card (max 20 as given, then `+N więcej` from `totalCount - paths.length`), with the explicit count.
4. `publish`, `external_message`, `payment`, `budget_overrun`: `KeyValueList` rows with labels from the namespace; message body excerpt (<=500) as plain preformatted text; recipients as given (engine-redacted).
5. All preview text goes through `plainText`; no link is created from preview content; the host in `new_domain` is plain mono text, not a link.
6. Diff loading: skeleton; failure shows `Nie udało się wczytać podglądu zmian` and the decision stays AVAILABLE only if the structured facts are present (the Owner can still decide from `summary` and facts); an absent preview of a destructive class (`delete_files`, `payment`) disables the approve button (fail closed) with the reason text.
7. Large diff: virtual scroll or capped to 2000 lines with `… N więcej linii`.
8. The region is keyboard-focusable when scrollable (`tabindex=0`, `role=region`, `aria-label`).

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:DiffView`, `ui:KeyValueList`, `ui:TerminalBlock`; `parseUnifiedDiff` (OVE_DS051).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/approvals/` (feature `approvals`, route `/approvals`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only cross-feature use is the public export named in `needs` (`useLocalApproval` from `@features/local-approval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `regions/preview.region.tsx`, `components/previews/{GitPushPreview,NewDomainPreview,DeleteFilesPreview,KeyValuePreview}.tsx`.

## 9. Security and safety

This view is the Owner's security gate (ADR 0003, ADR 0021). Rules enforced here and tested in OVE_APPRUI015: (1) an Approval decided here is bound to its `actionHash` and permits exactly ONE execution of exactly the displayed action (`scope: once`); the decision body has no scope field; (2) the UI never broadens an approval: a permanent effect (lifting an Approval requirement, a permanent directory grant, adding a host to the network allow-list) is a SEPARATE explicit action with its own confirmation and a Local Approval (`useLocalApproval`, bound to the exact arguments, single use, desktop only); no button combines `once` and `permanent`, and no default selects permanent; (3) Telegram can only approve for the current Run; this view therefore labels decisions that came from Telegram and never offers to upgrade them; (4) every text from an Agent (justification, commit subjects, message bodies, paths typed by the Agent) is untrusted and rendered only as plain text, labelled as the Agent's claim, never as HTML or a link made from it; (5) the displayed summary and preview are produced by the engine from structured data, so the UI shows `summary` and structured fields, not text that the Agent supplied; (6) fail closed: if the detail cannot be loaded or has expired, no decision control is rendered. The diff is Agent-produced content: it is rendered by `DiffView` as text only; control and bidi characters are neutralised by the ui-kit sanitiser. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Binary file in the diff: `plik binarny` line.
- Diff with 100 000 lines: capped.
- Preview of a class unknown to the UI: generic `KeyValueList` of engine fields; no permanent option.
- Commit subject with RLO characters: neutralised.

## 11. Acceptance criteria

- [ ] Given the git push fixture with a diff, Then the preview matches `design.png` within tolerance.
- [ ] Given no diff but commits, Then the commit list is shown.
- [ ] Given `delete_files` with `totalCount` 340 and 20 paths, Then `+320 więcej` is shown.
- [ ] Given a delete preview that fails to load, Then the approve button is disabled with the reason.
- [ ] Given a subject `<img onerror=...>`, Then it is displayed as text.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `previews.test.tsx` (per class, caps, fail-closed, untrusted text). Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test approvals`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_APPRUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_APPRUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- GAP: see OVE_APPRUI001 (diff artifact reference and stats missing in the `git_push` preview).
- ASSUMPTION: artifact content route `api:artifacts.content` serves the diff text and honours Workspace scope.
