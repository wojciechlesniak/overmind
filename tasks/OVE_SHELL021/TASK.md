---
id: OVE_SHELL021
title: "Implement the version-compatibility mismatch screen"
area: SHELL
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS013, OVE_DS032, OVE_DS051, OVE_ENGINE007, OVE_SHELL020]
soft_depends_on: []
provides: ["ui:VersionMismatchScreen"]
needs: ["lib:compat-handshake", "api:system.version", "ui:EmptyState", "ui:KeyValueList", "ui:Button"]
owns: ["apps/desktop/src/app/engine/version-mismatch-screen.tsx", "apps/desktop/src/app/engine/format-version-details.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 10]
---

# OVE_SHELL021: Implement the version-compatibility mismatch screen

## 1. Summary

Shows a bare, explanatory screen when the handshake says the app and the engine speak different protocols (`engine_older` or `engine_newer`), with the versions, the one safe action for each case and no way to reach views that would misbehave.

## 2. Context

ENGINE007 returns `{ compatible: false, reason: 'engine_older'|'engine_newer', engine, client }` and SHELL004 turns it into the `incompatible` connection state. Typical causes: the app bundle was replaced while an old engine kept running (engine older: the fix is to replace the engine, ENGINE009 step (d) does it), or an old app opened against a newer engine (engine newer: the Owner must update the app; MVP has no updater, SETUP010 req. 11). The wrong action in either case could corrupt expectations (a new UI on an old protocol), so the screen blocks the UI.

## 3. Scope (in)

- `VersionMismatchScreen` for both reasons, used by `EngineStatusGate` (SHELL020).
- Actions: 'Zrestartuj silnik' (engine older; calls `ensureEngine()` which replaces the engine and the connection retries), 'Pobierz nową wersję' (engine newer; opens the releases page through `openExternal` allowlist), 'Skopiuj szczegóły', and 'Zakończ Overmind' (shell quit).
- Version facts block: app version, engine version, protocol numbers, `minClientProtocol` when available.

## 4. Out of scope

- The handshake itself (ENGINE007) and the connection state machine (SHELL004).
- Automatic updates (not in MVP).
- Migration of data when versions differ (ENGINE area).

## 5. Detailed requirements

1. **Inputs.** From `useConnection().detail`: `{ engine: { protocol, appVersion }, client: { protocol } }` and the `reason`. App version from `import.meta.env.VITE_APP_VERSION` (SETUP009).
2. **Engine older.** Title `version.title`; body `version.engineOlder` 'Silnik w tle pochodzi ze starszej wersji Overmind. Zrestartuj go, żeby użyć tej samej wersji co aplikacja. Twoje Runy zostaną zapisane w punkcie kontrolnym.' (EN equivalent). Primary 'Zrestartuj silnik' -> `ensureEngine()`; during the call the screen shows progress (up to 25 s: graceful shutdown up to 10 s plus start). The engine performs the checkpointed shutdown (ENGINE004) so no Run is lost; the screen must say so.
3. **Engine newer.** Body `version.engineNewer` 'Ta aplikacja jest starsza niż silnik. Zainstaluj nowszą wersję Overmind.' Primary 'Pobierz nową wersję' (URL constant `RELEASES_URL`, https host allowlisted in SHELL003). No restart button (restarting would not help and could replace the newer engine with an older one; ensure-running only replaces older engines).
4. **Versions block.** `ui:KeyValueList` with rows 'Aplikacja' / 'App', 'Silnik' / 'Engine', 'Protokół' / 'Protocol' (`{{client}} · silnik {{engine}}`). Numbers are shown with their word labels. Semver is display only.
5. **Support copy.** 'Skopiuj szczegóły' copies `app 0.4.0 · engine 0.3.2 · protocol 2/1 · reason engine_older`; no paths.
6. **Navigation lock.** While the screen is shown no route renders; the app does not call any API except `system.version`, `system.health` and the ensure-engine command (the api-client is restricted by the connection state).
7. **Recovery.** After a successful restart the connection becomes `ready` and the gate renders the app; a toast 'Silnik zaktualizowany' appears.
8. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

No mock exists for this screen (design: none). It is composed only from ui-kit components (`ui:EmptyState`, `ui:Button`, `ui:Card`, `ui:InfoNote`) on the `bg-app` surface with the product tokens; the implementer must not invent new visual styles. DESIGN GAP recorded in section 14.

## 7. Reuse

- `useConnection`, `EngineStatusGate` (SHELL020), `usePlatform` (`ensureEngine`, `openExternal`, `quit`), `ui:EmptyState`, `ui:KeyValueList`, `ui:Button`, strings in `shell-engine` (SHELL019).

## 8. Architecture and code placement

`apps/desktop/src/app/engine/{version-mismatch-screen.tsx,format-version-details.ts}`. UI layer.

## 9. Security and safety

- The download link is a constant on an allowlisted host; nothing comes from the engine response into a URL.
- The screen blocks API use so an incompatible pair never exchanges mutating calls.
- The version block shows strings from typed numeric fields only.
- Never offers a downgrade of the engine.

## 10. Errors and edge cases

- `reason` unknown value: treated as generic mismatch with both actions hidden except 'Skopiuj szczegóły' and 'Zakończ'.
- Restart fails: shows the code (`failed`) and keeps the screen.
- Protocol numbers missing (old engine without `system.version`): body 'Nie można odczytać wersji silnika' and the restart action.
- User on web dev runtime: restart hidden.
- Handshake becomes compatible during the screen (engine restarted elsewhere): the gate unmounts it automatically.

## 11. Acceptance criteria

- [ ] Given `engine_older` then the restart action is primary, versions are listed, and after success the app loads.
- [ ] Given `engine_newer` then only the download action (and copy/quit) is available.
- [ ] Given copy then the clipboard string matches the specified format without paths.
- [ ] Given the screen then no API calls other than version/health are issued (asserted with a spy).
- [ ] PL and EN strings present; axe clean.

## 12. Test plan

- Vitest + Testing Library with fake connection details; spy on the api-client.
- Storybook stories for both reasons and the unknown-reason case.
- Playwright: mock gateway returning protocol 412 -> screen; restart -> normal app.
- Commands: `pnpm --filter @overmind/desktop test engine/version`.

## 13. Parallelization notes

After SHELL020. Independent files. Parallel with SHELL022.

## 14. Open questions and assumptions

- DESIGN GAP: no mock; derived from DS.
- ASSUMPTION: `RELEASES_URL` points to the GitHub Releases page of the project; the maintainers confirm the final host (and add it to the allowlist).
- OPEN: the restart of an older engine interrupts live Runs after checkpointing; confirm with the Owner that no extra confirmation is wanted (current: the text explains it, one click).
