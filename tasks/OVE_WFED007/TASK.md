---
id: OVE_WFED007
title: "Build the command engine: command contract, registry, batch, errors and messages"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH011, OVE_WFED002, OVE_WFED003, OVE_WFED005, OVE_WFED006]
soft_depends_on: []
provides: ["lib:editor-commands"]
needs: ["lib:editor-document-model", "lib:editor-ids", "lib:editor-connection-rules", "lib:editor-node-catalog", "lib:result", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/commands/types.ts", "apps/desktop/src/features/workflow-editor/commands/engine.ts", "apps/desktop/src/features/workflow-editor/commands/registry.ts", "apps/desktop/src/features/workflow-editor/commands/errors.ts", "apps/desktop/src/features/workflow-editor/commands/batch.handler.ts", "apps/desktop/src/features/workflow-editor/commands/handlers/handlers.generated.ts", "apps/desktop/src/features/workflow-editor/commands/*.test.ts", "apps/desktop/src/locales/en/wfc-core.json", "apps/desktop/src/locales/pl/wfc-core.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED007: Build the command engine: command contract, registry, batch, errors and messages

## 1. Summary

Defines the command pattern of the editor: every change of the document is a serialisable command that a registered handler executes into a new document plus an exact inverse command. This is the contract for undo/redo, autosave, paste, tests and PART 2 (the Inspector changes the document only through commands).

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The document is immutable plain data (WFED002). Commands, not React state setters, are the only writers. Handlers are registered one file per command (OCP, CONVENTIONS 5): new behaviour = new file in `commands/handlers/`. The inverse is a command too (so history stores small data, not 200-node snapshots) and every command carries all generated ids so a redo recreates identical elements (WFED003).

## 3. Scope (in)

- `Command`, `CommandHandler`, `CommandOutcome`, `CommandError` types.
- `createCommandEngine(deps)` with `execute`, `executeAll`, `parse`.
- Registry with auto-discovery of `*.handler.ts`.
- The `batch` command and `noop` detection.
- The shared catalogue of command types (table below) and the message keys of `wfc-core`.

## 4. Out of scope

- The concrete handlers of nodes, edges, groups, lanes and fragments (WFED009..WFED012).
- History (WFED008) and the session store (WFED019).
- Network saving (WFED022).

## 5. Detailed requirements

1. ```ts
export type CommandData = { readonly type: string } & Readonly<Record<string, unknown>>;   // plain JSON, validated per type
export interface CommandDeps { ids: IdSource; catalog: CatalogQueries; limits: EditorLimits; mode: "edit" }
export interface CommandEffects { readonly touchedNodes: readonly NodeKey[]; readonly touchedEdges: readonly EdgeId[]; readonly selection?: { nodes: readonly NodeKey[]; edges: readonly EdgeId[] }; readonly announce?: MessageRef; readonly warnings?: readonly MessageRef[] }
export interface CommandOutcome { readonly doc: EditorDocument; readonly inverse: CommandData; readonly effects: CommandEffects }
export interface CommandHandler<C extends CommandData> {
  readonly type: C["type"]; readonly schema: ZodType<C>;
  label(c: C): MessageRef;                         // "Przesunięto 3 Węzły"
  execute(doc: EditorDocument, c: C, deps: CommandDeps): Result<CommandOutcome, CommandError>;
  coalesceKey?(c: C): string | undefined;      // history merges same-key commands within the window
  merge?(previous: C, next: C): C;
}
export interface CommandEngine { execute(doc, cmd: CommandData): Result<CommandOutcome, CommandError>; parse(raw: unknown): Result<CommandData, CommandError> }
```
2. Execution pipeline: (1) `parse` looks up the handler by `type` (unknown type -> `unknown_command`), validates the payload with the handler zod schema (strict; unknown keys rejected; strings bounded) -> `invalid_payload`; (2) calls `execute`; (3) asserts `assertDocumentInvariants` in dev and test builds (and a cheap subset in production: key sets match order arrays); (4) if the resulting document is deeply equal to the input (`isSameDocument`, identity first) returns `{ unchanged: true }` so history records nothing; (5) returns the outcome. The engine never throws: handler exceptions become `internal_error` with the command type only (no payload in logs).
3. `CommandError { code: "unknown_command" | "invalid_payload" | "node_not_found" | "edge_not_found" | "group_not_found" | "lane_not_found" | "duplicate_key" | "limit_exceeded" | "illegal_connection" | "type_limit" | "unknown_type_readonly" | "unsupported_target" | "config_too_large" | "read_only" | "internal_error"; messageKey: `wfc-core:error.${code}`; params }`. `illegal_connection` embeds the `ConnectionVerdict` refusal (WFED006).
4. THE COMMAND CATALOGUE (contract for PART 2; each type is owned by the task named, payload field lists are in that task): `node.add`, `node.remove`, `node.restore`, `node.move`, `node.setLabel`, `node.setConfig`, `node.setUi`, `meta.set` (WFED009); `edge.add`, `edge.remove`, `edge.restore`, `edge.update` (WFED010); `group.create`, `group.remove`, `group.restore`, `group.update`, `group.setMembers`, `lane.add`, `lane.update`, `lane.remove`, `lane.restore`, `lane.bind` (WFED011); `fragment.insert` (WFED012); `batch` (this task: `{ type: "batch", label: MessageRef, commands: CommandData[] }`, the inverse is a batch of the inverses in reverse order; nested batches are flattened; max 500 commands; a failing member aborts the whole batch and the document stays unchanged: atomic).
5. Builders live next to the handlers: `commands/builders/<area>.ts` export pure functions `buildX(doc, deps, input): Result<CommandData, CommandError>` that generate ids through `IdSource`, clamp positions and validate preconditions. UI code calls builders, then `engine.execute`. Handlers themselves never generate ids (determinism of redo).
6. `registry.ts`: `registerHandler(h)` (duplicate type fails at boot with `command_type_duplicate`), `handlers.generated.ts` imports every `commands/handlers/*.handler.ts` (generated, ARCH009). Handlers from PART 2 (for example Inspector-specific ones) MAY be added under `commands/handlers/` only by proposal, or PART 2 composes existing commands (preferred: `node.setConfig` plus builders).
7. Messages: `wfc-core` has `command.<type>` labels with ICU plural where needed (`{count, plural, one {Przesunięto # Węzeł} few {Przesunięto # Węzły} many {Przesunięto # Węzłów} other {...}}`), `error.<code>` and `announce.<type>`; EN default and PL.
8. Purity: handlers are pure functions of `(doc, command, deps)`; no clock, no randomness, no I/O; the engine is constructed with `deps` (DIP).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `Result`, `MessageRef` (ARCH003, ARCH011), `IdSource` (WFED003), `CatalogQueries` (WFED005), `checkConnection` (WFED006, used by WFED010), document helpers (WFED002).

## 8. Architecture and code placement

Layer: pure `commands/`. Depends on `document/`, `catalog/`, `rules/`. Used by `history/`, `session/`, canvas wiring and PART 2. The engine knows nothing about React or the network.

## 9. Security and safety

Commands are an input boundary: they can come from the clipboard (untrusted text), tests and, later, Chief-drafted changes. Strict per-type zod schemas, bounded strings, prototype-key rejection (I7) and the invariant check make a malformed command fail closed without touching the document. Command payloads are never logged; only type, counts and error code (secrets and content never appear). Handlers cannot write permission fields because `node.setConfig` is the only config writer and it applies the same size and key rules as the document (the server rejects permission-widening configs, WFRT014).

## 10. Errors and edge cases

- Unknown type or extra field: `invalid_payload`/`unknown_command`, document unchanged.
- Batch of 3 where the 2nd fails: nothing applied, error names the member index.
- Command that changes nothing (move to the same position): `unchanged`.
- Redo after the document changed in a way that makes the command invalid (cannot happen with linear history; if it does, `execute` returns the error and the history is cleared with a toast).
- Handler throws: `internal_error`, logged with type only.

## 11. Acceptance criteria

- [ ] Given any registered handler and a valid document, When `execute` then `execute(inverse)` run, Then the result deep-equals the original (round trip), for every command type (contract test over the catalogue).
- [ ] Given a batch with one invalid member, Then the document is unchanged and the error carries the member index.
- [ ] Given two handlers registering the same type, Then boot fails with `command_type_duplicate`.
- [ ] Given `unchanged`, Then no history entry would be created (verified in WFED008 tests).
- [ ] PL and EN message keys exist for every command type and error code (key lint passes).

## 12. Test plan

Contract test iterating `registry.all()` with sample payloads from each handler `examples` export (each handler MUST export `examples: C[]` used here), engine unit tests, key-lint for `wfc-core`. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/commands`.

## 13. Parallelization notes

Parallel with WFED008 (history) after WFED006. Blocks WFED009..WFED012. Hotspot: `handlers.generated.ts` is generated, not hand-edited.

## 14. Open questions and assumptions

- ASSUMPTION: commands are plain objects, not classes, so they serialise and compare easily.
- OPEN: whether Chief-authored workflow changes (SPEC 3) will be expressed as these commands; the format is designed to allow it (serialisable, validated).
