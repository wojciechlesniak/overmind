---
id: OVE_SHELL022
title: "Wire toasts: the app toast service and the event-to-toast rule registry"
area: SHELL
kind: feature
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_DATA009, OVE_DS037, OVE_PAUSE001, OVE_PERM013, OVE_PERM015, OVE_PROV014, OVE_PROV018, OVE_SHELL006, OVE_SHELL008, OVE_SHELL010]
soft_depends_on: []
provides: ["lib:use-app-toast", "lib:toast-rule-registry"]
needs: ["ui:useToast", "ui:ToastProvider", "event:approval.requested", "event:access_request.requested", "event:provider.limit_reached", "event:provider.login_needed", "event:pause.changed", "event:workspace.deleted", "lib:extension-generators"]
owns: ["apps/desktop/src/app/notify/use-app-toast.ts", "apps/desktop/src/app/notify/toast-rules-host.tsx", "apps/desktop/src/app/notify/toast-rule.ts", "apps/desktop/src/app/notify/suppression.ts", "apps/desktop/src/app/notify/toast-rules/**", "apps/desktop/src/locales/en/shell-notify.json", "apps/desktop/src/locales/pl/shell-notify.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 9]
---

# OVE_SHELL022: Wire toasts: the app toast service and the event-to-toast rule registry

## 1. Summary

Provides `useAppToast()` (typed helpers over `ui:useToast`) and an extensible registry of event-to-toast rules, so that live engine events the Owner should notice while using the window (a new Approval, a limit reached, a login needed, a pause started from Telegram) appear as non-blocking toasts, deduplicated and suppressed where they would be noise.

## 2. Context

The DS provides `Toast`, `ToastProvider`, `useToast` (DS037). SHELL010 mounts the provider; this task decides what becomes a toast. Persistent notifications live in the Notification Center (NOTIF area) and native banners are shown when the app is in the background (SHELL023); toasts are the in-window layer. Many features need 'saved' or 'failed' toasts after mutations; they must use one helper so wording, duration and accessibility are uniform. Rules must be extensible without editing a shared file (CONVENTIONS section 5).

## 3. Scope (in)

- `useAppToast()`: `success(key, params?)`, `info`, `warning`, `error(uiError)`, `withUndo(key, onUndo)` - keys are i18n keys in the calling namespace.
- Rule registry: files `apps/desktop/src/app/notify/toast-rules/*.rule.ts` auto-discovered by a generator glob; each exports `{ id, events: string[], build(envelope, ctx): ToastSpec | null }`.
- `ToastRulesHost` mounted inside the providers: subscribes through `useEvent`, applies dedupe, caps and suppression, and renders through `ui:useToast`.
- First rule set: approval requested, access request filed, escalation raised, provider login needed/restored, provider limit reached, model switched, pause changed by another principal, workspace deleted, engine recovered.
- Suppression policy (pure function, tested).

## 4. Out of scope

- The Notification Center list and unread badge (NOTIF/DISC areas).
- Native notifications (SHELL023).
- Per-event copy owned by other areas beyond the first rule set; they add rule files.

## 5. Detailed requirements

1. **Helper.** `useAppToast()` wraps `useToast()`; `error(uiError)` renders `toUiError(...)` title key and, when `retryable`, a 'Spróbuj ponownie' action supplied by the caller; the correlation id is available through 'Skopiuj numer'. Default durations: success 4 s, info 6 s, warning 8 s, error until dismissed; `role="status"` for success/info, `role="alert"` for error (DS037 handles roles).
2. **Rule shape.** `ToastRule = { id: string; events: readonly EventType[]; build(e: EventEnvelope, ctx: RuleContext): ToastSpec | null }` with `ToastSpec = { key: string; tone: 'info'|'success'|'warning'|'error'; titleKey: string; params?: Record<string, string|number>; action?: { labelKey: string; route?: string; }; dedupeKey: string; priority: 0|1|2 }`. `route` must satisfy `isKnownRoute` (SHELL010) and the regex `^/[a-z0-9/_\-?=&#.]*$`.
3. **Params are plain text.** Only ids, counts and names from the envelope typed fields are placed in params (Agent name, Workspace name, CLI label); no free text from agents, CLIs or Telegram is ever interpolated (prompt-injection hygiene); names are truncated to 40 chars.
4. **Suppression.** (1) The event was caused by this window (`envelope.origin.clientId === ownClientId`): no toast (the caller shows its own result). (2) The Owner is already looking at the target: current route equals the rule's route and the window is focused. (3) The window is not focused (`useWindowActivity`, SHELL008): skip, the native bridge covers it. (4) Global Pause active and the rule is flagged `silentWhilePaused` (e.g. new Run started). (5) Same `dedupeKey` within 30 s: replaced, not stacked.
5. **Caps.** At most 3 visible toasts; priority 2 (Approval and Access Request, limit reached) are never dropped and push out priority 0; overflow of priority 0 collapses to one 'Jeszcze {{count}} zdarzeń' toast linking to the Notification Center route when present.
6. **First rules (EN | PL):** `approval.requested` -> 'New Approval waiting' | 'Nowa Zgoda czeka' + 'Zobacz' action to `/approvals`; `access_request.requested` -> 'An Agent asks for access' | 'Agent prosi o dostęp'; `escalation.raised` (via `provider.escalation` or `escalation.created`) -> 'Chief needs your decision' | 'Chief potrzebuje Twojej decyzji'; `provider.login_needed` -> 'Login needed in {{cli}}' | 'Wymagane logowanie w {{cli}}' action to connections; `provider.limit_reached` -> '{{cli}} limit reached' | 'Limit {{cli}} wyczerpany'; `provider.model_switched` -> 'Agent {{agent}} switched to {{model}}' | 'Agent {{agent}} przełączył się na {{model}}'; `pause.changed` by non-UI principal -> 'Global Pause turned on from Telegram' | 'Global Pause włączony z Telegrama'; `workspace.deleted` -> 'Workspace deleted' | 'Workspace usunięty'.
7. **Accessibility.** Toasts in an `aria-live` region per DS; keyboard: `F6`-style region jump not required; Esc dismisses the focused toast; focus never moves automatically except for toasts with an action when triggered by the Owner's own click.
8. **Registry generator.** `pnpm gen:toast-rules` writes `app/notify/toast-rules/index.generated.ts` (a list of imports); CI check that the generated file is up to date (ARCH009 pattern). Duplicate rule ids fail the build.
9. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

N/A, functionality only (no mock region); behaviour is defined by the requirements above.

## 7. Reuse

- `ui:useToast`, `ui:ToastProvider` (DS037), `useEvent` (SHELL006), `useWindowActivity` (SHELL008), `isKnownRoute` (SHELL010), `toUiError` (SHELL004), generator conventions (ARCH009).

## 8. Architecture and code placement

`apps/desktop/src/app/notify/{use-app-toast.ts,toast-rules-host.tsx,toast-rule.ts,suppression.ts,toast-rules/*.rule.ts,toast-rules/index.generated.ts}`, locale file `apps/desktop/src/locales/{en,pl}/shell-notify.json`. UI application layer.

## 9. Security and safety

- Event text is never interpolated except typed names (truncated, plain text), so a hostile Agent name or CLI text cannot inject markup or phishing text beyond its own label.
- Toast actions navigate only to known app routes; no URL, no command, never approve or decide anything (decisions happen in the Approvals view, local proof where needed).
- Telegram-origin events produce toasts that name the channel, so the Owner sees where an action came from.

## 10. Errors and edge cases

- Event burst (50 `approval.requested`): caps and dedupe keep at most 3 visible and one summary.
- Event with missing optional fields: rule returns null (no toast).
- Hub resync replays old events: replayed events (older than session start) are ignored by the host.
- Unknown event type: ignored.
- Locale missing key: falls back to EN, never shows the key.

## 11. Acceptance criteria

- [ ] Given an `approval.requested` while the window is focused elsewhere then a toast with 'Zobacz' appears.
- [ ] Given the same event from this window then no toast.
- [ ] Given 10 identical events within 30 s then one toast.
- [ ] Given a hostile agent name with markup then the toast shows it as text (truncated).
- [ ] Given the window unfocused then no toast is shown.

## 12. Test plan

- Vitest: suppression table, caps, dedupe, replay filter, rule contract test (every rule has EN and PL keys, route valid).
- Storybook: toast stack states.
- Commands: `pnpm --filter @overmind/desktop test notify`.

## 13. Parallelization notes

After SHELL006 and SHELL010. Other areas add `*.rule.ts` files only. Parallel with SHELL023.

## 14. Open questions and assumptions

- ASSUMPTION: event envelopes carry `origin.clientId`; if not, rule (1) uses `correlationId` of mutations issued by this window (SHELL005 keeps a recent list).
- OPEN: relation to NOTIF005 mapping; toasts here are UI-local and do not create notifications.
- OPEN: namespace `shell-notify` allow-listing (SHELL007 proposal).
