---
id: OVE_TG015
title: "Provide the Workspace cascade participant and the post-restore sanitiser for Telegram"
area: TG
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH012, OVE_BACKUP008, OVE_DATA012, OVE_TG004]
soft_depends_on: ["OVE_DATA012"]
provides: ["lib:telegram-cascade", "lib:telegram-restore-sanitizer"]
needs: ["port:WorkspaceCascadeParticipant", "port:RestoreSanitizerStep", "port:Keychain"]
owns: ["packages/adapters/sqlite/src/cascade/telegram.participant.ts", "apps/engine/src/composition/modules/telegram-cascade.module.ts", "packages/adapters/telegram/src/sanitize/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 16"]
adr_refs: [8, 25]
---

# OVE_TG015: Provide the Workspace cascade participant and the post-restore sanitiser for Telegram

## 1. Summary

Deletes `telegram_callbacks` rows of a deleted Workspace through the DATA012 extension point and registers a restore step that revokes pairing after a database restore.

## 2. Context

`telegram_callbacks` is the only Workspace-scoped Telegram table (its migration starts with `-- workspace-scoped: yes`). Global tables (pairing, state, codes) are not scoped. A restored backup must not revive an old pairing: the Owner re-pairs (SEC008 T1, T9).

## 3. Scope (in)

- `WorkspaceCascadeParticipant` for `telegram_callbacks`.
- `RestoreSanitizerStep` that clears pairing, active codes and callbacks and resets the offset.

## 4. Out of scope

- Backup and restore flow: BACKUP008.

## 5. Detailed requirements

1. `preview(workspaceId)` returns `{ telegram_callbacks: n }`; `deleteFor(tx, workspaceId)` deletes by workspace in the cascade transaction; `order` 600; no external artefacts.
2. After the cascade commits pending bubbles for that Workspace are left in chat but their buttons already fail with the stale toast (no network call from the cascade).
3. **Sanitiser:** registered as a multi-token step; on restore it runs `pairing.clear()`, deletes codes and callbacks, sets offset to null so no stale update replays, sets the status to `unpaired`; it keeps the bot token reference (Keychain is not part of backup) and logs an audit entry.
4. Sanitiser is idempotent and safe when tables are empty.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- DATA012 participant contract; repositories from TG004.

## 8. Architecture and code placement

Participant in sqlite adapter cascade folder; sanitiser in the telegram adapter, registered by the cascade module file.

## 9. Security and safety

- Restore never leaves an active pairing from the backup: an old snapshot could pair a phone the Owner has since removed.

## 10. Errors and edge cases

- Restore with no Telegram data: no-op.
- Deleting a Workspace with unused callbacks: rows removed, taps become stale.

## 11. Acceptance criteria

- [ ] Deleting a Workspace removes only its callbacks (test with two Workspaces).
- [ ] After sanitiser the repository reports unpaired with no codes.
- [ ] Running it twice changes nothing.

## 12. Test plan

Integration: `telegram-cascade.test.ts`, `restore-sanitizer.test.ts`. Command: `pnpm vitest run packages/adapters/sqlite/src/cascade/telegram.participant.test.ts packages/adapters/telegram/src/sanitize`.

## 13. Parallelization notes

Parallel with TG011-TG014.

## 14. Open questions and assumptions

- None.
