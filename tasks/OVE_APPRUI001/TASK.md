---
id: OVE_APPRUI001
title: "Approvals view-model mappers and the approvals i18n namespace"
area: APPRUI
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT001, OVE_ARCH011, OVE_BOARDUI002, OVE_CHIEF001, OVE_DS040, OVE_DS051, OVE_PERM006, OVE_PERM013, OVE_PERM015]
soft_depends_on: []
provides: ["lib:approval-view-models"]
needs: ["contract:ApprovalRequest", "contract:AccessRequest", "contract:ActionClass", "contract:ApprovalPreview", "contract:Escalation", "contract:AgentRef", "ui:UiDomainTypes", "ui:stateMaps", "lib:parseUnifiedDiff", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/approvals/model/**", "apps/desktop/src/locales/en/approvals.json", "apps/desktop/src/locales/pl/approvals.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 14"]
adr_refs: [3, 21, 23]
---

# OVE_APPRUI001: Approvals view-model mappers and the approvals i18n namespace

## 1. Summary

Pure mappers from Approvals, Access Requests and Escalations to the ui-kit props (`ApprovalListEntry`, `ResolvedEntry`, `ApprovalDetail` facts and previews, `AccessRequestForm`, `EscalationReport`) and the shared EN/PL strings of the `approvals` namespace.

## 2. Context

The Owner inbox mixes three kinds: Approval (`ZGODA · GIT PUSH`, `ZGODA · NOWA DOMENA`), Access Request (`PROŚBA O DOSTĘP`) and Escalation (`ESKALACJA · LIMIT PĘTLI`). Contracts: `ApprovalRequest {id, workspaceId, runId, agentId, action{class, summary, structured, actionHash}, preview, status, requestedAt, expiresAt, decidedAt?, decision?{by:'owner_desktop'|'owner_telegram', scope:'once', note?}}`, `AccessRequest {id, runId, agentId, requested{rawPathDisplay, canonicalPath, rights, justification}, status: pending|granted_run|granted_permanent|denied|expired|cancelled, decision?{by, grantedRights?}}`, Escalation (CHIEF015: reason, summary, options, runId?, taskId?, raisedAt). Mock copy (Zgody.dc.html): `Zgody i Prośby`, `Agent czeka, reszta pracuje dalej.`, `OCZEKUJĄ · 3`, `ESKALACJE`, `ROZSTRZYGNIĘTE DZIŚ`, `POLECENIE`, `ZMIANY`, `DOWODY`, `PODGLĄD ZMIANY`. This view is the Owner's security gate (ADR 0003, ADR 0021). Rules enforced here and tested in OVE_APPRUI015: (1) an Approval decided here is bound to its `actionHash` and permits exactly ONE execution of exactly the displayed action (`scope: once`); the decision body has no scope field; (2) the UI never broadens an approval: a permanent effect (lifting an Approval requirement, a permanent directory grant, adding a host to the network allow-list) is a SEPARATE explicit action with its own confirmation and a Local Approval (`useLocalApproval`, bound to the exact arguments, single use, desktop only); no button combines `once` and `permanent`, and no default selects permanent; (3) Telegram can only approve for the current Run; this view therefore labels decisions that came from Telegram and never offers to upgrade them; (4) every text from an Agent (justification, commit subjects, message bodies, paths typed by the Agent) is untrusted and rendered only as plain text, labelled as the Agent's claim, never as HTML or a link made from it; (5) the displayed summary and preview are produced by the engine from structured data, so the UI shows `summary` and structured fields, not text that the Agent supplied; (6) fail closed: if the detail cannot be loaded or has expired, no decision control is rendered.

## 3. Scope (in)

- `pendingToListEntry`, `escalationToListEntry`, `resolvedToEntry`, `approvalToDetail`, `accessRequestToDetail`, `escalationToDetail`, `previewToNode` descriptors per `ActionClass`, `kindLabel(kind, cls)`, `ageLabel(run, requestedAt)`, `expiryLabel`, `resultLine`.
- The `approvals` namespace (EN source, PL from the mock): kind words, class words, facts labels, previews, errors for `perm.*` codes.

## 4. Out of scope

- Fetching (OVE_APPRUI002, 005), rendering (later tasks).

## 5. Detailed requirements

1. List entry: `kindLabel` = `ZGODA · GIT PUSH` | `ZGODA · NOWA DOMENA` | `ZGODA · USUNIĘCIE PLIKÓW` | `ZGODA · PUBLIKACJA` | `ZGODA · WIADOMOŚĆ` | `ZGODA · PŁATNOŚĆ` | `ZGODA · LIMIT BUDŻETU` | `PROŚBA O DOSTĘP` | `ESKALACJA · {REASON}` (reason words: `LIMIT PĘTLI` for `loop_exhausted`, `BUDŻET`, `CZAS`, `PONOWIENIA`, `SPÓR`, `NIEDOSTĘPNY DOSTAWCA`, `WYRAŹNA`); `ageLabel` = `Run #14 · 3 min` (Run number from the Run summary, minutes from `requestedAt`; older than 1 h shows hours, older than 24 h `wczoraj`); title = engine `action.summary` (Approval), `Odczyt ~/Projects/shared-ui` built from `canonicalPath` display form and rights words (Access Request), Escalation `summary` plain text; agent chip from `AgentRef` (`hueForAgentId`, initials), Chief/system as `C`/`Chief`.
2. Kind tone/marker: approval amber square, access request magenta square, escalation error square (DS056); a kind is also always a WORD in the label (never colour alone).
3. `expiryLabel` = `wygasa za 25 min` from `expiresAt` (amber mono) for pending items; once past, the entry maps to state `expired` and is moved to resolved on the next refetch.
4. Resolved today: `✓ git push dev/login · Developer · z desktopu`, `✓ Prośba: ~/Downloads/brief.pdf · tylko Run #13 · z Telegrama`, `✗ usunięcie tests/legacy/ · QA`; verdict `allowed` for approved/consumed/granted_*, `denied` for denied; `origin` from `decision.by` (`z desktopu` / `z Telegrama`); `expired` and `cancelled` are shown as `✗ ... · wygasła|anulowana` with the word; only items decided or ended since local midnight.
5. Facts per class (KeyValue `grid3`): git_push -> `POLECENIE` (`git push {remote} {branch}`, mono; `--force` shown with the word `wymuszony`), `ZMIANY` (`{n} commity`; `+14 −3` only when the engine supplies diff stats, see Open questions), `DOWODY` (omitted when absent, never a placeholder claim); new_domain -> `DOMENA` (host, mono, wraps), `AGENT/POWÓD` (labelled `deklaracja Agenta`), `ZAKRES` `tylko ten Run`; delete_files -> `LICZBA PLIKÓW`, `ŚCIEŻKI`; publish -> `CEL`, `ARTEFAKT`, `WERSJA`; external_message -> `KANAŁ`, `ODBIORCA` (redacted form from the engine), `TEMAT`; payment -> `KWOTA`, `ODBIORCA`; budget_overrun -> `LIMIT`, `PROGNOZA`. Run link text: `Dostarczanie funkcji v7 · węzeł Developer`.
6. Preview descriptors (`previewToNode`): git_push -> commit list (`sha7 subject`, subjects untrusted); delete_files -> path list (first 20 + `+N więcej` from `totalCount`), error-tinted; new_domain -> command-block with host; publish/external_message/payment/budget_overrun -> `KeyValueList` rows; all text plain.
7. Hash: `actionHash` first 8 chars exposed as `shortHash` for the detail footer and audit tooltips.
8. Unknown classes or kinds map to a neutral generic row (`ZGODA · {class}`) with the engine `summary` and NO permanent option (unknown class fails closed, PERM006).
9. Namespace keys complete in EN and PL for everything above plus `errors.*` for `perm.approval_not_pending|approval_expired|approval_mismatch|owner_required|local_approval_required|channel_not_permitted|paused|access_request_not_pending|access_request_limit|protected_location|not_found|override_not_allowed|audit_unavailable` and `chief.*` escalation errors.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

DS040 maps, `hueForAgentId`, `plainText`/`displayPath` (OVE_BOARDUI002), `parseUnifiedDiff` (OVE_DS051), formatting helpers.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/approvals/` (feature `approvals`, route `/approvals`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only cross-feature use is the public export named in `needs` (`useLocalApproval` from `@features/local-approval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `model/{labels.ts,list-entry.ts,resolved.ts,detail.ts,facts.ts,previews.ts,access-request.ts,escalation.ts,index.ts}`; locale files owned here.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Run number unavailable: `Run` label shows the short id.
- Agent deleted: chip with `—` and the name from the snapshot if provided.
- Path outside the Workspace and outside `~`: display form from the engine only (never the raw agent text).
- Time zone: ages are relative; absolute times in the Owner's locale.
- Negative age (clock skew): `przed chwilą`.

## 11. Acceptance criteria

- [ ] Given the mock fixtures, Then list entries equal the mock strings (`ZGODA · GIT PUSH`, `Run #14 · 3 min`, `Wypchnięcie gałęzi dev/cart-discounts`).
- [ ] Given an unknown class, Then no permanent option descriptor is produced.
- [ ] Given a Telegram-decided Access Request, Then the resolved row says `z Telegrama`.
- [ ] Given a git_push without diff stats, Then `ZMIANY` shows only the commit count.
- [ ] `pnpm i18n:check` passes.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): table tests `list-entry.test.ts`, `facts.test.ts`, `previews.test.ts`, `resolved.test.ts`; fixtures typed against contracts. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test approvals`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_APPRUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_APPRUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. Locale files owned here only; later tasks use `approvals-<topic>.json`.

## 14. Open questions and assumptions

- GAP (reported to PERM): the `git_push` preview carries commits (`sha7`, `subject`) but no diff text, no `+14 −3` stats and no test evidence, while the mock shows a unified diff, `ZMIANY` and `DOWODY testy 112 z 112`. Proposal: an additive optional `diffStat` and `evidence[]` (engine-derived, from the Run's artifacts), and a `diff` artifact reference that the UI can fetch through `api:artifacts.content`. Until then the preview is the commit list.
- GAP (reported to CHIEF): the `Escalation` contract shape (`options[]`, `reason`, loop counters, last Quality Gate lines) is described only as stored columns in CHIEF015; this task codes against `contract:Escalation` with `options: {key,title,description,destructive?}[]`.
- ASSUMPTION: Run numbers come from `lib:use-run-summary`/`GetRunSummary` (AGENT018 `RunSummaryLite`).
