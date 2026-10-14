# Overmind backlog: plan, areas and reserved foundation IDs

Read `CONVENTIONS.md` first. This file fixes the area codes and the IDs of foundation tasks so that task authors working in parallel can reference each other without waiting.

## 1. Target repository layout (described by tasks, not created yet)

```
/                       pnpm workspace root (Node 22 LTS, TypeScript strict)
apps/desktop/           Tauri shell + React UI (src/app, src/features/<feature>, src/shared)
apps/desktop/src-tauri/ minimal Rust shell: window, tray, engine sidecar. NO business logic
apps/engine/            engine process entry = composition root, packaged as a standalone executable
packages/contracts/     zod schemas -> types, JSON Schema, API/event contracts (one folder per entity)
packages/domain/        pure domain model and rules (no I/O)
packages/application/   use cases + port interfaces (one file per port)
packages/workflow-runtime/  workflow validation + execution engine
packages/gateway/       local API server (authenticated, owner-only Unix socket), route modules
packages/api-client/    typed client used by desktop, Telegram adapter, future CLI
packages/ui-kit/        design system: tokens, primitives, composites, canvas kit, Storybook
packages/adapters/{sqlite,herdr,sandbox-macos,providers,telegram,keychain-macos,notifications-macos}/
skills/overmind/        the "overmind" Skill installed into agent CLIs (ADR 0027)
tools/                  dev scripts (schema generation, checks)
docs/                   project documentation, architecture, ADRs
```

Dependency rule: `contracts <- domain <- application <- {workflow-runtime, gateway, adapters/*} <- apps/engine`. `ui-kit` has no internal dependencies. `apps/desktop` imports only `ui-kit`, `api-client`, `contracts`.

## 2. Area codes

| Area | Scope | Wave |
|---|---|---|
| SETUP | monorepo, toolchain, CI, dependency policy, scaffolds, packaging (described, not executed) | 1 |
| OSS | license, CONTRIBUTING, issue/PR gate (ADR 0025), docs translation | 1 |
| ARCH | layering, boundaries, error model, logging, config, DI, contract pipeline, extension points, i18n infra | 1 |
| SEC | threat model, path canonicalisation, secrets, untrusted content policy, security review | 1 |
| TEST | test strategy, harnesses, fakes, visual regression, escape-test harness | 1 |
| DS | `packages/ui-kit` design system from the 18 views | 1 |
| DATA | entities, SQLite schema, migrations, event log, repositories, backup | 1 |
| ENGINE | engine process, gateway API, authn, service lifecycle, api-client | 1 |
| PERM | permission policies, effective permissions, approvals, access requests, audit | 1 |
| VIS | Public/Private visibility rules (ADR 0028) across entities | 1 |
| BOX | isolation: Apple `container` adapter, mounts, volumes, escape tests | 1 |
| PROV | model providers: herdr adapter, claude/codex CLI, Ollama, limits, fallback | 1 |
| WFRT | workflow validation and runtime, node types, quality gate, safe evaluator | 1 |
| CHIEF | Chief behaviour: planning, delegation, autonomy, rules, documentation refs | 1 |
| AGENT | Agent entity and lifecycle, dynamic agents, direct chats, agent messages | 1 |
| CHAT | conversations and channels backend (Chief and Agent chats, mentions) | 1 |
| SKILL | Skill library backend, versions, assignment, overmind Skill | 1 |
| BOARD | Task Board backend: lanes, tasks, documentation links | 1 |
| DISC | Discussion engine | 1 |
| DEC | Decision Register and outcomes | 1 |
| MEM | Agent Memory, Shared Memory, search, scopes | 1 |
| TG | Telegram adapter, pairing, formatting, approvals | 1 |
| NOTIF | notifications, sound signal, notification center backend | 1 |
| PAUSE | Global Pause end-to-end (engine, gateway, UI, tray, Telegram) | 1 |
| BACKUP | daily backup and export | 1 |
| SHELL | app shell: rail, top bar, routing, layout, status items | 2 |
| TRAY | menu-bar menu | 2 |
| ONB | first-run wizard (4 steps) | 2 |
| WSPACE | Workspaces dashboard and Workspace settings | 2 |
| CHATUI | Chief and agent chat views | 2 |
| DISCUI | live Discussion view | 2 |
| WFED | workflow canvas editor | 2 |
| RUNUI | Runs and Activity view | 2 |
| BOARDUI | Task Board view | 2 |
| DECUI | Decision Register view | 2 |
| AGUI | Agents view | 2 |
| SKUI | Skill library view | 2 |
| APPRUI | Approvals and Access Requests view | 2 |
| CONNUI | Connections and models view | 2 |
| SETUI | App settings view | 2 |

## 3. Reserved foundation IDs (titles are fixed; owners write the full tasks)

### SETUP
- OVE_SETUP001 Initialise the pnpm monorepo skeleton and root files
- OVE_SETUP002 Base TypeScript configuration with project references (pin a TypeScript version compatible with typescript-eslint)
- OVE_SETUP003 ESLint flat config and Prettier
- OVE_SETUP004 Unit test runner (Vitest) workspace configuration and coverage thresholds
- OVE_SETUP005 Git hooks and commit conventions
- OVE_SETUP006 CI pipeline on GitHub Actions (lint, typecheck, test, build, boundaries, license, audit)
- OVE_SETUP007 Secret scanning and SBOM in CI
- OVE_SETUP008 Dependency policy, version pins, compatibility matrix and `docs/dependencies.md`
- OVE_SETUP009 `apps/desktop` Vite + React scaffold
- OVE_SETUP010 `apps/desktop/src-tauri` minimal shell (capabilities, CSP, sidecar declaration)
- OVE_SETUP011 `apps/engine` scaffold and standalone executable packaging (spike with decision)
- OVE_SETUP012 Local development scripts: `pnpm dev`, isolated dev data directory, mock gateway
- OVE_SETUP013 Parallel-agent tooling: worktree and claim scripts, task linter
- OVE_SETUP014 macOS build, code signing and notarization pipeline
- OVE_SETUP015 Bundling pinned herdr and the container CLI check into the app

### OSS
- OVE_OSS001 Apache-2.0 LICENSE, NOTICE and per-file header policy
- OVE_OSS002 CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md
- OVE_OSS003 Issue and PR templates, trusted-contributors file, PR gate workflow (ADR 0025)
- OVE_OSS004 English README and docs structure
- OVE_OSS005 Translate project documentation to English and make the glossary bilingual (ADR 0017)
- OVE_OSS006 ADR index and ADR template

### ARCH
- OVE_ARCH001 Architecture document: packages, layers, dependency rules
- OVE_ARCH002 Boundary enforcement in lint with proving fixtures
- OVE_ARCH003 Error model and `Result` type
- OVE_ARCH004 Structured logging with secret redaction and correlation ids
- OVE_ARCH005 Configuration and data-directory layout
- OVE_ARCH006 Ports, adapters and composition-root conventions (dependency injection)
- OVE_ARCH007 Id and clock utilities (ULID, Clock port)
- OVE_ARCH008 Contract-first pipeline (zod -> types -> JSON Schema -> client) with additive-only check
- OVE_ARCH009 Extension-point conventions and generators (manifests, route modules, barrels, migrations naming)
- OVE_ARCH010 In-process event bus and domain event envelope
- OVE_ARCH011 i18n infrastructure (namespaces per feature, EN default, PL, key lint)
- OVE_ARCH012 Platform abstraction interfaces (Keychain, Sandbox, Tray, Service manager, Notifier, File dialog)

### SEC
- OVE_SEC001 Threat model and security requirements
- OVE_SEC002 Path canonicalisation and symlink/mount checking library
- OVE_SEC003 Secret handling policy and redaction test suite
- OVE_SEC004 Untrusted-content policy (prompt injection) and prompt-assembly rules
- OVE_SEC005 Gateway authentication threat tests
- OVE_SEC006 Supply-chain and dependency security checklist
- OVE_SEC007 Security review checklist used as part of every task's Definition of Done

### TEST
- OVE_TEST001 Test strategy and conventions
- OVE_TEST002 Test utilities: fake clock, in-memory ports, builders
- OVE_TEST003 Shared contract-test suites for ports
- OVE_TEST004 Playwright harness for the desktop UI against a mock gateway
- OVE_TEST005 Visual regression harness against design crops
- OVE_TEST006 Fake CLI provider simulator ("fake-claude", "fake-codex")
- OVE_TEST007 Isolation escape-test harness (CI gate, SPEC 16.8)

### DS
Assigned by the DS authors from `_design/COMPONENT-INVENTORY.md` section D. Capability names follow `ui:<ComponentName>` (for example `ui:Button`, `ui:NodeTile`, `ui:AppRail`).

## 4. Capability naming (`provides` / `needs`)

`api:<resource>.<action>` (gateway endpoints), `port:<PortName>`, `contract:<EntityName>`, `ui:<ComponentName>`, `usecase:<Name>`, `event:<name>`, `table:<name>`, `lib:<name>`. A `needs` entry must resolve to exactly one `provides` somewhere in the backlog; the linker (final step) converts them into `depends_on` and reports unresolved or duplicated ones.

## 5. Order of writing

1. Wave 1: foundation, design system and all backend areas (in parallel).
2. Wave 2: UI view areas (need the DS and gateway capability names).
3. Linker and validator: resolve `needs`, check cycles, ownership overlaps, missing images, front matter.
4. Review pass: coverage against `SPECIFICATION` sections 1-19, every ADR and the 15 acceptance criteria of section 16; gaps become new tasks.

## 6. Ownership map (prevents overlap between areas)

Every area writes only inside its own subfolders. Tasks must use these prefixes in `owns`.

| Layer | Path pattern | Owner |
|---|---|---|
| contracts | `packages/contracts/src/<entity>/` | the area that owns the entity (below) |
| domain | `packages/domain/src/<area-lowercase>/` | that area |
| use cases | `packages/application/src/<area-lowercase>/` | that area |
| ports | `packages/application/src/ports/<PortName>.ts` | the area that defines the port |
| SQLite repos | `packages/adapters/sqlite/src/<area-lowercase>/` | that area (infrastructure in `src/core/` = DATA) |
| migrations | `packages/adapters/sqlite/migrations/V<ts>__<TASKID>__<name>.sql` | the task that needs the tables |
| gateway routes | `packages/gateway/src/routes/<area-lowercase>/*.route.ts` | that area (gateway infrastructure = ENGINE) |
| api-client | `packages/api-client/src/<area-lowercase>/` | that area (infrastructure = ENGINE) |
| desktop feature | `apps/desktop/src/features/<feature>/` | the UI area (SHELL owns `src/app/`) |
| ui-kit | `packages/ui-kit/src/<group>/<Component>/` | DS |
| i18n | `apps/desktop/src/locales/<lang>/<feature>.json`, engine strings in `packages/*/locales` | the feature |
| docs | `docs/<topic>/...` | the task that introduces it |

Entity ownership: DATA = Workspace, OwnerRule, ProjectDocRef, Artifact. PERM = PermissionPolicy, PermissionProfile, AllowedDirectory, ApprovalRequest, AccessRequest, AuditEvent, default-approvals list. VIS = Visibility contract and rules. AGENT = Agent, AgentMessage. CHAT = Conversation, ChatMessage, Channel. SKILL = Skill, SkillVersion, SkillAssignment. WFRT = Workflow, WorkflowVersion, WorkflowRun, NodeExecution. BOARD = Board, Lane, Task. DISC = Discussion. DEC = Decision. MEM = AgentMemory. PROV = Connection, ModelUsage, provider capabilities. TG = TelegramPairing. NOTIF = Notification. PAUSE = PauseState.

Cross-area use of an entity goes through its contract and use cases, never through another area's tables.
