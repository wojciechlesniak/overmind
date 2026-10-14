---
id: OVE_WFED003
title: "Implement deterministic key, id, label and slug generators (IdSource)"
area: WFED
kind: feature
size: XS
priority: P0
mvp: true
status: todo
depends_on: ["OVE_WFED002"]
soft_depends_on: []
provides: ["lib:editor-ids"]
needs: ["lib:editor-document-model"]
owns: ["apps/desktop/src/features/workflow-editor/document/ids.ts", "apps/desktop/src/features/workflow-editor/document/slug.ts", "apps/desktop/src/features/workflow-editor/document/ids.test.ts", "apps/desktop/src/features/workflow-editor/document/slug.test.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED003: Implement deterministic key, id, label and slug generators (IdSource)

## 1. Summary

Pure generators for node keys, edge ids, group ids, lane keys and default labels that satisfy the persisted regexes, are unique inside a document and are reproducible in tests (no `Math.random`, no clock). Commands carry their ids in the payload, so redo recreates exactly the same elements.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. WFRT003 fixes the formats: `NodeKey ^[a-z][a-z0-9-]{0,47}$`, `EdgeId ^e-[a-z0-9-]{1,60}$`, `PortName ^[a-z][a-z0-9_]{0,31}$`, lane key `^[a-z][a-z0-9_]{0,31}$` (BOARD001). The mock uses human names (Product Owner, Developer); keys are technical and stable, labels are human.

## 3. Scope (in)

- `IdSource` interface and the default implementation `createIdSource(doc)`.
- `slugify` with Polish transliteration.
- Label generator for new nodes ("Agent", "Agent 2").

## 4. Out of scope

- Command builders that call the IdSource (WFED009..WFED012).
- Random ULIDs for server entities (the editor never creates server ids).

## 5. Detailed requirements

1. ```ts
export interface IdSource {
  nodeKey(type: string, preferred?: string): NodeKey;      // "agent-1", "agent-2"; from a label: "product-owner"
  edgeId(from: PortRef, to: PortRef): EdgeId;              // "e-po-result-join-in", collision suffix -2, -3
  groupId(kind: string): GroupId;                          // "grp-1", "grp-2"
  laneKey(name: string): LaneKey;                          // "build", "qa", "review", collision build_2
  nodeLabel(type: string, displayName: string): string;    // "Agent", "Agent 2"
}
export function createIdSource(doc: EditorDocument, extraTaken?: ReadonlySet<string>): IdSource
```
2. Every returned value is unique against the document AND against values already handed out by the same `IdSource` instance (so a batch of five new nodes gets five distinct keys before any command is applied).
3. `slugify(input, {maxLen, allowUnderscore})`: NFKD normalisation, explicit map for `ł->l`, `Ł->l`, `ß->ss`, `đ->d`, `ø->o`, strip combining marks, lowercase, runs of non `[a-z0-9]` become one `-` (or `_` for lane keys), trim `-`, ensure the first char is a letter (prefix `n` for nodes, `l` for lanes), truncate to `maxLen`; empty result falls back to the type name.
4. Edge id: `e-` + `<from.node>-<from.port>-<to.node>-<to.port>` slugged with `_` -> `-`; if longer than 63 chars, truncate and append `-` + a 4-char FNV-1a hex of the full string (pure hash, no crypto); collision: append `-2`, `-3`, ...; the result MUST match the regex (test with 10 000 random inputs).
5. Node key: `slug(preferred ?? type)` then smallest free numeric suffix: `agent`, `agent-2`, `agent-3` (the first is `agent-1` when `preferred` is absent: choose and document ONE rule: first node of a type is `<type>-1`; a `preferred` slug is used as is when free, else suffixed). Underscores in type names (`quality_gate`) become `-` in keys (`quality-gate-1`).
6. Default label: the localised display name passed by the caller (`displayName`) and a numeric suffix for duplicates among existing labels (`Agent`, `Agent 2`). Labels are trimmed to 60 chars.
7. Pure and deterministic: same document and same call order give the same ids. No global counters.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `slug`-like helpers must not be copied from other features; this file becomes the only slug helper of the editor (DRY).

## 8. Architecture and code placement

Layer: pure helper in `document/`. Used by command builders and the clipboard remapper; not exposed to React.

## 9. Security and safety

Keys and ids are written into the persisted draft and later into events and the Board lane keys; the regexes prevent injection of path separators, markup or control characters. Labels are NOT used as keys without slugging.

## 10. Errors and edge cases

- Label made only of emoji or Chinese characters: slug empty, falls back to the type name.
- Label longer than 48 chars: truncated before suffixing so the suffix is never cut.
- Preferred key equal to an existing key of a deleted node: free again (uniqueness is against the current document).
- More than 99 duplicates: suffix grows (`-100`) until the length cap, then truncates the base.

## 11. Acceptance criteria

- [ ] Given empty document, `nodeKey("agent")` returns `agent-1`; calling it again on the same source returns `agent-2`.
- [ ] Given label "Łukasz — Żółw", `slugify` returns `lukasz-zolw`.
- [ ] Given 10 000 random (from, to) pairs, every `edgeId` matches `^e-[a-z0-9-]{1,60}$`... within the 63-char total and is unique.
- [ ] `laneKey("Build")` returns `build`; second call `build_2`.

## 12. Test plan

Unit tests with table fixtures and a seeded randomised regex test. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/document/ids src/features/workflow-editor/document/slug`.

## 13. Parallelization notes

Parallel with WFED004 and WFED005 once WFED002 is merged.

## 14. Open questions and assumptions

- ASSUMPTION: groups get ids `grp-N` (WFRT003 leaves the group id format open).
