---
id: OVE_ARCH001
title: Write the architecture document with packages, layers and dependency matrix
area: ARCH
kind: docs
size: M
priority: P0
mvp: true
status: in_progress
depends_on: [OVE_SETUP001]
soft_depends_on: []
provides: ["doc:architecture", "lib:boundaries-manifest"]
needs: []
owns: ["docs/architecture/ARCHITECTURE.md", "docs/architecture/boundaries.json", "docs/architecture/diagrams/**"]
reads: ["docs/SPECIFICATION.md", "tasks/PLAN.md", "tasks/CONVENTIONS.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 2", "SPECIFICATION 11", "SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [3, 4, 5, 9, 18, 20, 22, 26]
---

# OVE_ARCH001: Write the architecture document with packages, layers and dependency matrix

## 1. Summary

Produce `docs/architecture/ARCHITECTURE.md`, the single authoritative description of how Overmind is split into packages and processes, and `docs/architecture/boundaries.json`, the machine-readable form of the dependency matrix that `OVE_ARCH002` turns into lint rules. Every other task cites this document when it says "respect the layers".

## 2. Context

Overmind is a macOS desktop app (Tauri shell + React UI) talking to a separate background engine process (TypeScript, Node 22, packaged as a standalone executable, ADR 0005/0018). Agents run official CLIs (`claude`, `codex`) inside Apple `container` isolation, with herdr as the terminal layer (ADR 0020/0026). Telegram is a second channel into the same engine (ADR 0006). Dozens of agents will write code in parallel, so layer rules must be explicit, short and machine-checkable. `tasks/CONVENTIONS.md` section 6 gives the summary; this task writes the full text. Terms (Owner, Chief, Workspace, Run, Port, Adapter) follow the glossary.

## 3. Scope (in)

- `docs/architecture/ARCHITECTURE.md` with the exact outline in requirement 1.
- `docs/architecture/boundaries.json`, the dependency matrix as data (schema in requirement 4).
- Mermaid diagrams embedded in the document (source kept in `docs/architecture/diagrams/*.mmd`).
- A short "how to add a package or change a rule" procedure (requires an ADR).

## 4. Out of scope

- Enforcing the matrix in lint and the proving fixtures: `OVE_ARCH002`.
- Error model, logging, config, DI, event bus, i18n details: `OVE_ARCH003`..`OVE_ARCH015` (this document only links to them).
- Creating package folders and `package.json` files: `OVE_SETUP001`, `OVE_SETUP009`, `OVE_SETUP011`.
- The threat model: `OVE_SEC001` (this document only contains the security architecture summary).

## 5. Detailed requirements

1. `ARCHITECTURE.md` MUST contain these top-level sections in this order:
   1. Purpose, audience, how to use this document (one screen).
   2. System context: actors (Owner, Telegram user = Owner on phone), processes (Desktop app = Tauri Rust shell + webview UI; Engine; herdr + CLI agents inside the container runtime; Ollama), and the trust boundaries between them. A Mermaid C4-style container diagram.
   3. Package catalogue: one table row per package: name (`@overmind/<name>`), path, layer, purpose, public entry points (`exports` map), runtime (browser / node / both). Rows for: `contracts`, `domain`, `application`, `workflow-runtime`, `gateway`, `api-client`, `ui-kit`, `adapters/sqlite`, `adapters/herdr`, `adapters/sandbox-macos`, `adapters/providers`, `adapters/telegram`, `adapters/keychain-macos`, `adapters/notifications-macos`, plus the packages introduced by ARCH tasks: `adapters/system` (SystemClock, UlidIdGenerator, AtomicFileWriter, ProcessRunner, PathProbe: ARCH007/013/014/SEC002), `adapters/logging` (ARCH004), `adapters/i18n` (ARCH015), `adapters/service-macos` (ServiceManager, ARCH012), `testing` (TEST002, test-only), plus `apps/desktop`, `apps/desktop/src-tauri`, `apps/engine`, `tools/`, `skills/overmind`.
   4. Dependency matrix (requirement 3) and the rules behind it.
   5. Layer rules: what each layer may contain and must not contain (requirement 5).
   6. Process boundary and the gateway (requirement 6).
   7. Platform abstraction (requirement 7).
   8. Cross-cutting concerns: one paragraph plus link per concern: errors (ARCH003), logging (ARCH004), config and data directory (ARCH005), DI (ARCH006), ids and clock (ARCH007), contracts pipeline (ARCH008), extension points (ARCH009), events (ARCH010), i18n (ARCH011/015), platform ports (ARCH012), atomic files (ARCH013), process execution (ARCH014).
   9. Three worked flows with sequence diagrams: (a) Owner message to Chief in the UI, (b) Agent Access Request approved from Telegram for one Run, (c) engine crash and resume of a Run.
   10. Naming and file conventions (requirement 8).
   11. Testing seams (where fakes plug in; links to TEST001/002/003).
   12. Security architecture summary (deny-by-default, fail closed, gateway as only door, isolation, secrets); links to SEC001.
   13. Evolution: how to change the matrix (ADR + update `boundaries.json` + fixtures in the same PR), how to add a package.
   14. Appendix: glossary of architectural terms (Port, Adapter, Use case, Composition root, Route module, Feature module, Gateway, Channel).
2. **Package roles.** Define layers, from inner to outer: L0 `contracts` (zod schemas, DTOs, error codes, Result and id primitives; zero internal deps); L1 `domain` (pure model and rules); L2 `application` (use cases + ports); L3 `workflow-runtime`, `gateway`, `adapters/*`, `api-client`; L4 `apps/engine` (composition root) and `apps/desktop`. `ui-kit` is outside the layering (no internal deps).
3. **Dependency matrix** (rows import columns; Y = allowed, `ports` = only the subpath `@overmind/application/ports`, `types` = type-only import):

   | importer \ importee | contracts | domain | application | application/ports | workflow-runtime | gateway | api-client | ui-kit | adapters/* | testing |
   |---|---|---|---|---|---|---|---|---|---|---|
   | contracts | - | N | N | N | N | N | N | N | N | N |
   | domain | Y | - | N | N | N | N | N | N | N | N |
   | application | Y | Y | - | Y | N | N | N | N | N | N |
   | workflow-runtime | Y | Y | Y | Y | - | N | N | N | N | N |
   | gateway | Y | N | Y | Y | N | - | N | N | N | N |
   | api-client | Y | N | N | N | N | N | - | N | N | N |
   | ui-kit | N | N | N | N | N | N | N | - | N | N |
   | adapters/* (not telegram) | Y | Y | ports | Y | N | N | N | N | N (never each other) | N |
   | adapters/telegram | Y | N | ports | Y | N | N | Y | N | N | N |
   | apps/engine | Y | Y | Y | Y | Y | Y | N | N | Y | N |
   | apps/desktop | Y | N | N | N | N | N | Y | Y | N | N |
   | tests (`*.test.ts`, `test/**`) | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
   | tools/ | any (never imported by packages) |  |  |  |  |  |  |  |  |  |

   Notes: `testing` may be imported only from test files and from `packages/*/test-support/**`. Nothing imports from `apps/*`. `skills/overmind` contains no importable code (it is Markdown plus scripts calling the HTTP/CLI API).
4. `boundaries.json` MUST be valid JSON with this shape (ARCH002 reads it): `{ "version": 1, "packages": [{ "id": "domain", "path": "packages/domain", "layer": 1, "allowedImports": ["contracts"], "allowedSubpaths": {"application": ["ports"]}, "forbiddenBuiltins": ["node:fs", "node:child_process", ...], "forbiddenGlobals": ["Date.now", "Math.random", "process.env", "fetch", "console"], "forbiddenPackages": ["@tauri-apps/*"] }], "testOnly": ["testing"], "toolsMayImportAny": true }`. Every package in the catalogue has an entry; the matrix table in the Markdown is generated from or checked against the JSON (add a note that ARCH002 includes a consistency test).
5. **Layer rules** (state each as MUST / MUST NOT):
   - `contracts`, `domain`, `application`, `workflow-runtime` contain no I/O: no `node:fs`, `node:net`, `node:http(s)`, `node:child_process`, `node:os`, `node:crypto` randomness, global `fetch`, `process.env`, `console`, `Date.now()`, `new Date()` without argument, `Math.random()`. Time, randomness and ids come from ports (`Clock`, `IdGenerator`).
   - Use cases are classes or factory functions with constructor injection of ports; one file per use case under `packages/application/src/<area>/`; they return `Result` (ARCH003).
   - Adapters implement ports from `application/ports` and translate foreign errors into `AppError`. They hold no business rules.
   - `gateway` translates between transport and use cases, applies authn/authz, validation (zod from contracts) and error mapping; it holds no business rules.
   - `workflow-runtime` is a library: it receives ports, never creates adapters.
   - `ui-kit` has no data fetching and no domain knowledge: props in, events out.
   - `apps/desktop` features follow `components -> hooks -> api-client`; no feature imports another feature (shared things go to `src/shared` or `ui-kit`).
6. **Process boundary.** State precisely: (a) The UI process never opens the database, files outside its own bundle, or CLIs. (b) The gateway is the only door into the engine for the UI, Telegram adapter, future CLI and agents (agents via the "overmind" Skill API with a restricted scope, ADR 0027). (c) Telegram adapter runs inside the engine process but still talks to the engine only through `api-client` over an in-process transport that passes through the same gateway pipeline (authn as channel `telegram`, authz, validation, audit), so it cannot use a code path the UI lacks. (d) The Rust shell: window, tray, starting the engine sidecar, forwarding opaque frames between the webview and the engine socket (if ENGINE chooses IPC forwarding), reading the session token file. It parses no business payloads. (e) Engine process lifetime is independent of the window (ADR 0005). (f) herdr and CLIs live inside the sandbox and are reached only through `adapters/herdr` and `adapters/sandbox-macos`. Include the transport seam `Transport` in `api-client` (unix-socket, IPC-forwarded, in-process, test HTTP).
7. **Platform abstraction (ADR 0009).** macOS-specific code exists only in `packages/adapters/*-macos`, `packages/adapters/service-macos` and `apps/desktop/src-tauri`. Everything else must compile and be unit-testable on Linux CI. Interfaces are listed in `OVE_ARCH012`; this document states the rule and the folder pattern `platform/<os>` for future ports.
8. **Naming and files.** kebab-case folders; `PascalCase.ts` for a file exporting one class/port; `camelCase.ts` for function modules; `*.route.ts`, `*.usecase.ts`, `*.repository.ts`, `*.contract.ts` (contract-test suites) `*.test.ts`, `*.stories.tsx`, `feature.manifest.ts`; no default exports except manifests and route modules; barrels are generated (`index.generated.ts`, ARCH009); path aliases `@overmind/<package>`; every package has `exports` limiting deep imports (`internal/` folders are not exported).
9. Every claim in the document that a later task will enforce MUST name the enforcing task ID. The document MUST end with a "Rules checklist" of at most 20 one-line rules that reviewers can paste into PR reviews.
10. The document is written in English, 400-700 lines, diagrams in Mermaid.

## 6. Design notes

N/A, functionality only (documentation).

## 7. Reuse

Reuses `tasks/CONVENTIONS.md` sections 5-7 and `tasks/PLAN.md` section 1; do not contradict them. If a contradiction is found, record it in section 14 of this task and propose a fix in `tasks/_proposals/OVE_ARCH001-conventions-fix.md`.

## 8. Architecture and code placement

Files: `docs/architecture/ARCHITECTURE.md`, `docs/architecture/boundaries.json`, `docs/architecture/diagrams/*.mmd`. This task writes no code. `boundaries.json` is data owned by this task; ARCH002 and the lint config only read it. KISS: a rule that cannot be checked by a script or a reviewer in under a minute is rewritten or dropped.

## 9. Security and safety

The architecture document is the home of the trust boundaries: Owner, desktop UI, gateway socket, engine, CLI agents in containers, herdr, Telegram, Keychain. Each boundary MUST be named here with the same identifiers `OVE_SEC001` uses (`TB-UI`, `TB-GW`, `TB-ENG`, `TB-SBX`, `TB-HERDR`, `TB-TG`, `TB-KC`, `TB-NET`, `TB-CONTENT`). The document MUST state: deny by default, fail closed, no I/O in domain/application, secrets never cross a port as plain strings except `Keychain.read` results held in memory only, no network listener by default.

## 10. Errors and edge cases

- A package that legitimately needs something the matrix forbids: the document tells the author to write a proposal and an ADR; the matrix is never relaxed silently.
- Shared helper needed by two adapters: it becomes a port + implementation in `adapters/system`, or pure code in `domain`/`contracts`, never an adapter-to-adapter import.
- UI needs a type from `domain`: the type is exposed through `contracts` DTOs instead.
- `ui-kit` needs i18n strings: it receives them as props (no i18n dependency inside ui-kit).

## 11. Acceptance criteria

- [ ] `ARCHITECTURE.md` exists with all 14 sections in the specified order and every package of PLAN section 1 appears in the catalogue.
- [ ] The dependency matrix in the Markdown and `boundaries.json` agree cell by cell (a reviewer can diff them; ARCH002 later automates it).
- [ ] The three sequence diagrams render in a Mermaid preview without errors.
- [ ] Every enforceable rule names the task that enforces it.
- [ ] Trust boundary identifiers (TB-*) are defined and listed.
- [ ] The document contains the "Rules checklist" (at most 20 lines).
- [ ] No statement contradicts CONVENTIONS sections 5-7 (or a proposal file exists).

## 12. Test plan

Documentation task. Checks: (1) `pnpm exec markdownlint docs/architecture` (rules from SETUP003) passes; (2) a small script in `tools/` is NOT written here, but the reviewer validates `boundaries.json` with `node -e "JSON.parse(...)"`; (3) Mermaid blocks validated by `mmdc` or the GitHub preview. Real validation arrives with ARCH002 fixtures.

## 13. Parallelization notes

Blocks ARCH002, ARCH006, ARCH012, SEC001 (soft). Everything else can start in parallel once the matrix section is merged; other ARCH authors read the draft. Conflict hotspot: none (own files). If another task needs a new package row, it files a proposal; only this document's owner edits the matrix.

## 14. Open questions and assumptions

- ASSUMPTION: the Telegram adapter uses the in-process `api-client` transport (same gateway pipeline). If ENGINE prefers a loopback socket, the matrix does not change.
- ASSUMPTION: UI to engine transport is forwarded by the Rust shell (webview cannot open Unix sockets); ENGINE finalises the mechanism, the `Transport` seam in `api-client` stays.
- ASSUMPTION: `application` exposes two entry points, `@overmind/application` and `@overmind/application/ports`, via the `exports` map.
- Open: whether `workflow-runtime` may import `adapters/*` types for checkpoints: default NO, it uses ports only.
