---
id: OVE_PROV023
title: Verify provider terms periodically and gate providers whose rules changed
area: PROV
kind: feature
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH010, OVE_DATA001, OVE_DATA003, OVE_DATA007, OVE_ENGINE016, OVE_ENGINE029, OVE_NOTIF004, OVE_PERM009, OVE_PROV001, OVE_PROV019, OVE_PROV020]
soft_depends_on: [OVE_PROV003, OVE_PROV025]
provides: ["usecase:RunProviderTermsCheck", "usecase:AcknowledgeProviderTerms", "usecase:SetProviderTermsStatus", "port:TermsStateRepository", "table:prov_terms_state", "lib:terms-sources", "event:provider.terms_changed"]
needs: ["usecase:CreateNotification", "usecase:ResolveNotificationsBySubject", "port:JobScheduler", "port:Clock", "port:EventBus", "port:AuditSink", "port:SqliteDatabase", "lib:repository-base", "lib:migration-runner", "lib:define-event", "usecase:RequireLocalProof", "contract:ProvConfig"]
owns:
  - packages/application/src/prov/terms/**
  - packages/application/src/ports/TermsStateRepository.ts
  - packages/application/src/ports/TermsPageFetcher.ts
  - packages/contracts/src/provider/terms-sources.ts
  - packages/contracts/src/events/provider.terms_changed.event.ts
  - packages/adapters/providers/src/terms/**
  - packages/adapters/sqlite/src/prov/terms/**
  - packages/adapters/sqlite/migrations/V202610150130__OVE_PROV023__prov_terms_state.sql
  - docs/providers/terms-verification.md
reads: ["docs/SPECIFICATION.md", "docs/adr/0022-oficjalne-cli-jak-herdr.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 17", "SPECIFICATION 18", "SPECIFICATION 20"]
adr_refs: [7, 22]
---

# OVE_PROV023: Verify provider terms periodically and gate providers whose rules changed

## 1. Summary

Driving `claude` and `codex` automatically is a grey area where providers may change their rules (Spec 9, Spec 17). This task adds the periodic verification the spec asks for: a weekly job compares the reference pages with a stored baseline, tells the Owner when something changed, and lets the Owner mark a provider as `ok`, `review_needed` or `blocked`; a blocked provider stops accepting work (`provider.terms_blocked`). Overmind never interprets the pages itself.

## 2. Context

Spec 17: Anthropic does not allow external products to offer claude.ai login or subscription limits; mitigation includes "periodic verification of the rules" and possibly asking the providers for permission (Spec 18: timing and form of contact is an open Owner decision). Reference sources are listed in Spec 20: Claude Agent SDK authentication rules (`https://code.claude.com/docs/en/agent-sdk/overview`) and Codex with a ChatGPT plan (`https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan`). Page text is untrusted content: it is hashed and compared, never parsed for instructions and never shown as authoritative. The error `provider.terms_blocked` already exists (PROV001).

## 3. Scope (in)

- Compiled list of terms sources per provider (`lib:terms-sources`).
- Safe page fetcher adapter and weekly job.
- Baseline storage, change detection, Owner notification, acknowledgement and status gate.
- Maintainers' documentation and checklist.

## 4. Out of scope

- Legal review and contacting providers (Owner decision, Spec 18), UI for acknowledgement (CONNUI; use cases only here), automatic interpretation of terms, model selection integration details (PROV003/PROV025 read the status through `TermsStateRepository`).

## 5. Detailed requirements

1. **Sources:** `TERMS_SOURCES: Record<ProviderId, { id: string; url: string; label: string }[]>` compiled in `packages/contracts/src/provider/terms-sources.ts`; URLs are `https` only on fixed hosts (`code.claude.com`, `help.openai.com`, plus any host a reviewed PR adds). The list cannot be changed at runtime, by Agents, Skills, documents or the Owner via the API (a PR changes it).
2. **Fetcher (`TermsPageFetcher` port, adapter in `packages/adapters/providers/src/terms/`):** HTTPS GET with no cookies, no auth headers, a fixed `User-Agent: Overmind-terms-check/<version>`, 10 s timeout, 1 MiB response cap, **no redirects** (a redirect result is recorded as `redirected` and treated as "changed, review"), TLS verification on, DNS result checked against private/loopback/link-local ranges using `node:net` `BlockList` (reject if any resolved address is non-public), port 443 only. Text extraction: strip scripts/styles/markup with a tiny deterministic tag stripper, collapse whitespace, then `sha256` of the normalised text; only the hash, size and `fetchedAt` are stored, plus the HTTP status and `etag`/`last-modified` when present. The page text itself is not stored or logged.
3. **State (`prov_terms_state`, migration `V202610150130__OVE_PROV023__prov_terms_state.sql`):** `(provider_id, source_id) PK, baseline_hash TEXT NULL, last_hash TEXT NULL, last_checked_at, last_status TEXT ('unchanged'|'changed'|'unreachable'|'redirected'|'first_seen'), status TEXT ('ok'|'review_needed'|'blocked') NOT NULL DEFAULT 'ok', acknowledged_at TEXT NULL, acknowledged_note TEXT NULL (<=500 chars, Owner text, redacted)`.
4. **`RunProviderTermsCheck`:** for each source: fetch, compare with `baseline_hash`. First run stores the baseline (`first_seen`, no alert). `changed` or `redirected` -> status `review_needed`, event `provider.terms_changed { providerId, sourceId, label, at }` (persisted), ONE notification per provider (dedupe key `provider.terms_changed:<providerId>`, urgency normal, key `notif.terms_changed`, text names the provider and says to review the published rules; no excerpt of the page). `unreachable` -> keep status, record, no alert unless unreachable for 3 consecutive checks (then an informational notification once). Single flight; skipped under Global Pause? No: it is read-only network and runs regardless of Pause.
5. **Schedule:** `ProvConfig.termsCheckIntervalDays` default 7 (1..30) via `JobScheduler`; first run 10 minutes after engine start if never run; manual trigger by `RunProviderTermsCheck` use case for CONNUI. Jitter of up to 1 h to avoid synchronised load.
6. **`AcknowledgeProviderTerms({ providerId, note? })` (Owner desktop, local proof):** sets baseline to the last hash, status `ok`, resolves the notification (`ResolveNotificationsBySubject`), audit `provider.terms_acknowledged`. **`SetProviderTermsStatus({ providerId, status: 'ok'|'blocked', note? })` (Owner desktop, local proof):** `blocked` makes model resolution return `provider.terms_blocked` for that provider (PROV003/PROV025 read `TermsStateRepository`); active sessions are not killed, but no new session or send starts (the guard consults the status, hook in PROV025's health view). `review_needed` does NOT block by default (the Owner is informed, work continues) because a changed page is not necessarily a prohibition; `ProvConfig.blockOnTermsChange` default false (ASSUMPTION) can make `review_needed` block.
7. **Telegram and Agents:** neither can acknowledge or change status (local-only operations, ADR 0006 spirit); Telegram may receive the notification text without links.
8. **Documentation (`docs/providers/terms-verification.md`):** what is checked and why, the manual checklist for maintainers (read the pages, record the date and decision in the Decision Register or ADR, contact providers if needed per Spec 18), how to add a source by PR, and a statement that Overmind does not log in to the providers' services and does not present subscription limits as its own (ADR 0022).
9. **Audit and events:** all state changes audited with ids only; no page content.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`JobScheduler`, `Clock`, notification use cases (NOTIF004), local proof (PERM009), repository base and migrations (DATA), `ProvConfig` (PROV019), `defineEvent`. DNS/range check is a 15-line helper local to the adapter (a shared network guard library may replace it later; noted in the code header).

## 8. Architecture and code placement

Use cases in `packages/application/src/prov/terms/{run-check.ts,acknowledge.ts,set-status.ts,compare.ts}`; ports `TermsStateRepository` and `TermsPageFetcher`; fetcher adapter `packages/adapters/providers/src/terms/{https-fetcher.ts,tag-stripper.ts,ip-guard.ts}`; SQLite adapter and migration as listed. Application depends on ports only.

## 9. Security and safety

The fetcher is the only component in this area that the engine process itself uses to fetch third-party web content, so it is locked down: fixed HTTPS sources compiled in, no redirects, public addresses only, size and time caps, no cookies or credentials, content hashed and discarded. Page content is untrusted and never reaches prompts, logs or the UI. The status gate is Owner-controlled with local proof; neither a page, an Agent, a Skill nor Telegram can change it. A compromised terms page cannot cause code execution or permission changes: the worst effect is a notification. Failure of the check never blocks work by itself (fail open for availability, but fail closed on explicit Owner `blocked`).

## 10. Errors and edge cases

- Provider page restructured often (hash changes without legal change): the Owner acknowledges; documented as expected noise.
- Network offline: `unreachable`, no alert until 3 consecutive failures.
- Page behind a bot wall returning 403: `unreachable`.
- Redirect to a login page: `redirected`, review needed (safe).
- Clock changes: intervals use the injected `Clock`.
- Owner blocks a provider while Agents are working: sessions continue until they finish; new starts and sends are refused with `provider.terms_blocked`; fallback (PROV018) may route to another provider.

## 11. Acceptance criteria

- [ ] First run stores baselines silently; an unchanged second run changes nothing; a changed hash sets `review_needed`, publishes the event and creates exactly one notification per provider.
- [ ] A redirect response, a non-public resolved address, a response over 1 MiB and a non-HTTPS URL are all rejected by the fetcher tests.
- [ ] `AcknowledgeProviderTerms` and `SetProviderTermsStatus` fail without local proof and for Agent/Telegram callers.
- [ ] With status `blocked`, model resolution returns `provider.terms_blocked` and no session starts; `review_needed` does not block unless configured.
- [ ] No log, event or database column contains page text (only hashes and metadata).
- [ ] The job honours `termsCheckIntervalDays` and single flight.

## 12. Test plan

Fetcher tests against a local HTTPS test server with scripted responses (redirect, large body, slow); use case tests with fakes and `FakeClock`; repository tests on SQLite; authorization tests. Commands: `pnpm vitest run packages/application/src/prov/terms packages/adapters/providers/src/terms packages/adapters/sqlite/src/prov/terms`.

## 13. Parallelization notes

Independent of the herdr/session tasks. PROV003/PROV025 consume the status through the repository port (additive read). Migration name unique.

## 14. Open questions and assumptions

- ASSUMPTION: change detection by page hash is acceptable as "periodic verification"; the actual reading and decision is human.
- ASSUMPTION: `review_needed` does not block (informational), `blocked` is an explicit Owner decision.
- Open (Spec 18): when and how to contact Anthropic and OpenAI about automation of the CLIs; this task provides the process and reminders, not the contact.
