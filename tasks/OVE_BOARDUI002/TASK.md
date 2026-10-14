---
id: OVE_BOARDUI002
title: "Shared untrusted-text, safe link and path display helpers for the desktop UI"
area: BOARDUI
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS022, OVE_DS052, OVE_SEC004]
soft_depends_on: []
provides: ["lib:ui-safe-text", "ui:SafeLink"]
needs: ["lib:sanitizeTerminalText", "lib:untrusted-text", "ui:TextLink"]
owns: ["apps/desktop/src/shared/safe-text/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11"]
adr_refs: [3, 12]
---

# OVE_BOARDUI002: Shared untrusted-text, safe link and path display helpers for the desktop UI

## 1. Summary

Provides the small helpers every feature view uses to show untrusted strings safely: `plainText`, `toSafeHref`, `SafeLink`, `displayPath` and `clampText`. One definition prevents each view from writing its own, subtly different, sanitiser.

## 2. Context

Agents, Chief, imported Skills, repositories and documents produce text shown in the Board (Task titles, doc quotes), Decisions (rationale), Agents (instructions, memory), Skills (Markdown, scan excerpts) and Approvals (commands, justifications). SEC004 defines the policy for prompts on the engine side; the ui-kit components already render text nodes only. What is missing is a shared way to neutralise control and bidi characters in strings that features build themselves (for example `aria-label`, document titles, toasts) and to validate link targets and display paths.

## 3. Scope (in)

- `plainText(input, opts)`: removes control characters except `\n` and `\t`, bidi override characters (U+202A-202E, U+2066-2069), zero-width characters (optionally), normalises to NFC and clamps length.
- `toSafeHref(url)` returning `string | null` (allows `https:` and `http:` only; app routes through `toAppHref`).
- `SafeLink` component (wraps `ui:TextLink`): external links open with `rel="noopener noreferrer"` and `target="_blank"`, unsafe URLs render as inert text.
- `displayPath(path, { home, workspaceRoot })` for `~`-relative display and `isRelativeDocPath(path)` structural check (relative POSIX, no `..`, no NUL, no backslash, <= 300 chars).
- `clampText(text, max)` with an ellipsis and a `fullText` for `title` attributes.

## 4. Out of scope

- Path canonicalisation or symlink checks (engine, OVE_SEC002).
- Markdown rendering (never done in the UI; ui:MarkdownPreview colours by prefix only).
- Terminal output sanitising (`lib:sanitizeTerminalText`, OVE_DS052, reused for the control-character part).

## 5. Detailed requirements

1. `plainText` MUST call `sanitizeTerminalText` from ui-kit for control characters and then additionally strip bidi controls and optionally zero-width characters; default max length 2000, configurable; result is always a string (never throws).
2. `toSafeHref`: parse with `new URL`; accept protocols `https:` and `http:` only; reject credentials in the URL (`user:pass@`), reject `javascript:`, `data:`, `file:`, `vbscript:` and anything unparsable; return the normalised `href`. `mailto:` and custom schemes are NOT accepted (document why: agents must not craft app-launching links).
3. `SafeLink` props `{ href: string; children: ReactNode; external?: boolean }`; when `toSafeHref` returns null render `<span title="link blocked">` with the text (label from props, no hard-coded string); external links set `rel` and `target`.
4. `isRelativeDocPath` mirrors the structural rule of BOARD001 (`docRef.path`): relative POSIX path, no `..` segment, no leading `/`, no backslash, no NUL, 1..300 chars. It is a display-side guard only; the engine is authoritative.
5. `displayPath` returns `~/...` for paths under the Owner's home and the Workspace-relative form for paths under the Workspace root; any other absolute path is shown as given but flagged `outside: true` so the caller can show a warning tone.
6. `clampText(text, max)` returns `{ text, truncated, fullText }` where `fullText` is plain-text sanitised, so `title` attributes never contain control characters.
7. All helpers are pure, synchronous, SSR-safe and have exhaustive tests against the shared corpus `lib:injection-corpus` (OVE_SEC004) when available plus local fixtures (RLO override, zero-width joiner, `javascript:alert(1)`, `jAvA\tscript:`, `data:text/html`, whitespace-padded URLs).

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`sanitizeTerminalText` (OVE_DS052), `ui:TextLink` (OVE_DS022), `lib:injection-corpus` (OVE_SEC004). Creates `ui:SafeLink` and `lib:ui-safe-text` for all feature tasks.

## 8. Architecture and code placement

Layer: UI shared. `apps/desktop/src/shared/safe-text/{plain-text.ts,safe-href.ts,SafeLink.tsx,display-path.ts,clamp-text.ts}`. Pure functions with unit tests; only `SafeLink` touches React. No dependency on features. A barrel is generated.

## 9. Security and safety

Core of the UI-side defence against prompt-injection style content that tries to look like UI (RLO characters to disguise file names, links that launch apps). Deny by default for URL schemes. Sanitising never silently changes the data sent to the engine: it is for display only; values submitted back (for example a doc path) are the Owner's original input. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Empty string: returns empty, `truncated: false`.
- String of 10 000 combining marks: clamped by length before NFC to bound CPU.
- URL with uppercase scheme `HTTPS://...`: accepted, normalised.
- URL `https://example.com@evil.test/`: reject (credentials).
- Relative URL `/x`: `toSafeHref` returns null (use `toAppHref` for in-app routes).
- Path with `..%2f`: not decoded here, treated literally, still rejected by the engine.
- Surrogate pairs and emoji preserved.

## 11. Acceptance criteria

- [ ] Given `javascript:alert(1)` in any case or with tabs, Then `toSafeHref` returns null and `SafeLink` renders inert text.
- [ ] Given a string with U+202E, Then `plainText` removes it.
- [ ] Given `../etc/passwd`, Then `isRelativeDocPath` is false.
- [ ] Given a path under the home directory, Then `displayPath` returns the `~` form.
- [ ] Given an external https link, Then the anchor has `rel="noopener noreferrer"`.

## 12. Test plan

Vitest table tests per helper (`safe-href.test.ts`, `plain-text.test.ts`, `display-path.test.ts`, `clamp-text.test.ts`), a component test for `SafeLink`, property test with random Unicode strings (fast-check is NOT added; use a seeded generator in the test). Command: `pnpm --filter @overmind/desktop test shared/safe-text`.

## 13. Parallelization notes

Independent of OVE_BOARDUI001; both are prerequisites for the other feature tasks. No shared files edited.

## 14. Open questions and assumptions

- ASSUMPTION: only http(s) links are ever shown as links; Documentation paths open in the in-app viewer or the system editor through a later task, not through this helper.
- OPEN: whether `mailto:` is ever needed (default no).
