---
id: OVE_ARCH003
title: Define the Result type, AppError and the error code catalogue
area: ARCH
kind: contract
size: M
priority: P0
mvp: true
status: done
depends_on: [OVE_ARCH001, OVE_SETUP002]
soft_depends_on: [OVE_ARCH008]
provides: ["lib:result", "contract:AppError", "contract:ErrorCode", "lib:error-catalogue", "lib:error-mapper"]
needs: []
owns: ["packages/contracts/src/kernel/result.ts", "packages/contracts/src/kernel/app-error.ts", "packages/contracts/src/errors/**", "packages/gateway/src/errors/**", "docs/architecture/errors.md"]
reads: ["docs/architecture/ARCHITECTURE.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 15", "SPECIFICATION 19"]
adr_refs: [6]
---

# OVE_ARCH003: Define the Result type, AppError and the error code catalogue

## 1. Summary

One typed way to fail across layer boundaries: `Result<T, E>`, a serialisable `AppError` with a stable `code`, a per-area error code catalogue with a registration format, and the mapping from errors to gateway responses and to safe user-facing messages (UI, Telegram, notifications) that never leak internals.

## 2. Context

CONVENTIONS section 6: "Errors are typed results across layer boundaries; no exceptions as control flow across packages." Many agents will add error codes in parallel, so the catalogue is one file per area (no shared enum to conflict on). Telegram and the UI show the same errors; neither may reveal paths, stack traces, SQL, tokens or CLI output. Messages are localised through i18n keys (`OVE_ARCH011`, `OVE_ARCH015`).

## 3. Scope (in)

- `Result<T, E>` with helpers, in `packages/contracts/src/kernel/result.ts` (browser and node safe, zero dependencies).
- `AppError` class-free data shape plus factory, in `kernel/app-error.ts`.
- Error code registration helper `defineErrors(area, table)` and the catalogue file convention `packages/contracts/src/errors/<area>.errors.ts`.
- Generated aggregated registry (generator spec delegated to ARCH009; this task writes the runtime lookups).
- Gateway mapping `toErrorResponse(error, ctx)` and HTTP-like status mapping in `packages/gateway/src/errors/`.
- User-message resolution contract: `UserMessage { key, params }`.
- Boundary helper `fromThrown(unknown): AppError` used by adapters and the gateway's last-resort handler.
- Documentation `docs/architecture/errors.md` (format, rules, examples).

## 4. Out of scope

- The actual catalogue entries of each area (each area registers its own codes in its own tasks).
- Logging of errors: `OVE_ARCH004`. Rendering errors in UI components: SHELL/DS tasks. Telegram formatting: TG area (uses the `UserMessage` contract and `OVE_ARCH015`).
- The transport framing of responses: ENGINE.

## 5. Detailed requirements

1. **Result.**
   ```ts
   export type Ok<T> = { readonly ok: true; readonly value: T };
   export type Err<E> = { readonly ok: false; readonly error: E };
   export type Result<T, E = AppError> = Ok<T> | Err<E>;
   export const ok: <T>(value: T) => Ok<T>;           // ok(undefined) allowed; use `okVoid`
   export const err: <E>(error: E) => Err<E>;
   export function map<T,U,E>(r: Result<T,E>, f: (t:T)=>U): Result<U,E>;
   export function mapErr<T,E,F>(r: Result<T,E>, f: (e:E)=>F): Result<T,F>;
   export function andThen<T,U,E>(r: Result<T,E>, f: (t:T)=>Result<U,E>): Result<U,E>;
   export function match<T,E,R>(r: Result<T,E>, h: { ok:(t:T)=>R; err:(e:E)=>R }): R;
   export function unwrapOr<T,E>(r: Result<T,E>, fallback: T): T;
   export function combine<T,E>(rs: readonly Result<T,E>[]): Result<T[],E>;   // first error wins
   export async function tryAsync<T>(fn: () => Promise<T>, map: (u: unknown) => AppError): Promise<Result<T, AppError>>;
   export function assertNever(x: never): never;
   ```
   There is no `unwrap()` that throws in production code (a `unwrapForTest` lives in `packages/testing`). Functions return `Result`; they do not both return `Result` and throw expected errors.
2. **AppError** is plain data so it can cross the wire: `{ code: ErrorCode; message: string; details?: Record<string, JsonValue>; retryable: boolean; correlationId?: string; cause?: unknown }`. `message` is a safe English developer message with no secrets or absolute home paths. `cause` is never serialised; it is kept in memory for logging only (logger redacts it, ARCH004). `details` MUST pass the area's `detailsSchema` (zod) so it can be proven safe; free-form strings from CLI output, file contents or paths are not allowed in `details` unless the schema marks them `sanitised` (length-capped, control chars stripped, path made workspace-relative).
3. **Code format.** `<area>.<snake_reason>` lowercase, e.g. `perm.path_outside_allowed`, `perm.approval_expired`, `provider.login_required`, `gateway.unauthenticated`, `data.not_found`, `internal.unexpected`. Area = the area code lowercased (`perm`, `box`, `prov`, `wfrt`, ...) plus the cross-cutting areas `gateway`, `validation`, `internal`, `data`. Codes are append-only and never reused or renamed (additive-only, ARCH008). A removed behaviour keeps its code with `deprecated: true`.
4. **Registration format.** One file per area `packages/contracts/src/errors/<area>.errors.ts`:
   ```ts
   export const permErrors = defineErrors('perm', {
     path_outside_allowed: { http: 403, severity: 'warn', retryable: false,
       messageKey: 'errors:perm.path_outside_allowed', defaultMessage: 'The path is outside the allowed directories.',
       detailsSchema: z.object({ requestedRelative: z.string().max(200) }).strict(),
       audit: true, telegramSafe: true },
   });
   ```
   Fields: `http` (status class used by the gateway: 400 invalid input, 401 unauthenticated, 403 denied, 404 missing, 409 conflict/state, 412 precondition, 422 semantic, 423 paused/locked, 429 rate/limit, 500 internal, 502 upstream/provider, 503 unavailable), `severity` (`info|warn|error|fatal`), `retryable`, `messageKey` (i18n key in namespace `errors`), `defaultMessage`, `detailsSchema?`, `audit?` (the gateway also writes an audit event when true), `telegramSafe` (false means Telegram receives only the generic message), `deprecated?`.
   `defineErrors` returns typed constructors: `permErrors.path_outside_allowed({ requestedRelative })` returns an `AppError`. Duplicate codes anywhere in the repo fail the build (registry test).
5. **Aggregation.** A generated `errorRegistry` (`packages/contracts/src/errors/index.generated.ts`, produced by the barrel generator of ARCH009) maps `ErrorCode -> definition`. `ErrorCode` is the union of all codes. Unknown codes received by clients (newer engine) are handled via `isKnownCode()` and a generic fallback, never a crash.
6. **Gateway mapping** (`packages/gateway/src/errors/to-error-response.ts`): `toErrorResponse(e: AppError, ctx): { status: number; body: ErrorResponse }` with `ErrorResponse = { ok: false; error: { code; message; details?; retryable; correlationId; userMessage: { key; params } } }`. Rules: (a) status comes from the registry; (b) `message` is `defaultMessage` for `internal.*`, never the thrown message; (c) `details` are validated against `detailsSchema` and dropped (with an `internal` log line) if validation fails; (d) `correlationId` is always set (request id from the logging context); (e) errors with unknown code, thrown exceptions, rejected promises, zod parse errors in handlers are converted by `fromThrown` into `internal.unexpected` (500) or `validation.invalid_input` (400, with `issues[]` limited to `path`, `code`, safe `message`, max 20 issues).
7. **User-facing messages.** `resolveUserMessage(error, channel: 'ui'|'telegram'|'notification')` returns `{ key, params }` (never a rendered string; rendering is done by the i18n layer so locale applies). For channel `telegram` and definitions with `telegramSafe: false`, return the key `errors:generic.try_again_on_desktop`. Params are limited to a whitelist of primitive values defined in `detailsSchema` (no raw path, no command output).
8. **Never leak** (testable): no absolute path under the home directory (`/Users/...`), no stack trace, no SQL fragments (`SELECT`, `INSERT`, table names), no token-like strings (patterns from ARCH004), no child-process stderr in `message`, `details` or `userMessage.params`. A contract test feeds hostile errors (message containing `/Users/x/.ssh/id_rsa`, `sk-ant-...`, a SQLite error text) through `fromThrown` and `toErrorResponse` and asserts none of it appears in the serialised body.
9. `fromThrown(u: unknown, hint?: ErrorCode)`: handles `Error`, strings, objects, `AbortError` (-> `internal.cancelled`, retryable false), `ZodError` (-> `validation.invalid_input`), `SyntaxError` from JSON parse (-> `validation.malformed_json`). Everything else is `internal.unexpected`. The original is stored in `cause` only.
10. Lint-level convention (enforced by an ESLint rule added to the `eslint-rules/` folder owned by ARCH002 via proposal, or by review until then): packages `domain`, `application`, `workflow-runtime` do not `throw` for expected failures; `throw` is allowed for programmer errors (`assertNever`, invariant violations named `InvariantError`).
11. `docs/architecture/errors.md` documents: how to add a code in 5 steps, status table, examples of use case returning `err(...)`, adapter wrapping a foreign error, gateway mapping, UI usage with `resolveUserMessage`, what to put in `details`.

## 6. Design notes

N/A, functionality only. (UI error presentation is specified in UI tasks using `userMessage.key`.)

## 7. Reuse

Every other task uses `Result` and `defineErrors`; none defines its own error base class or status mapping. `OVE_ARCH004` consumes `AppError` for logging; `OVE_ARCH008` includes the error response in the generated schemas; `OVE_ARCH011`/`015` own the `errors` namespace files.

## 8. Architecture and code placement

Layer L0 (`packages/contracts`) so that browser code (desktop, api-client) and engine share one definition without importing `domain`. Gateway mapping lives in `packages/gateway/src/errors/` (adapter-level concern). Dependency direction: gateway -> contracts. Zod is the only dependency. Pure functions, no classes, no inheritance (KISS). New area = new file (OCP).

## 9. Security and safety

Error text is an exfiltration channel (prompt injection can try to get secrets echoed into errors; Telegram is not end-to-end encrypted). Therefore: whitelist `details` through schemas, drop unknown fields, redact by pattern as a second line of defence (call the shared redactor from ARCH004 in `toErrorResponse` when available; until then a local pattern list MUST be used and replaced), never forward third-party stderr. Fail closed: an error that cannot be classified becomes `internal.unexpected` with a generic message. Security-relevant denials (`audit: true`) are audited by the gateway/use case that produced them, not by the mapper itself.

## 10. Errors and edge cases

- `ok(undefined)` for void results: provide `okVoid`; `Result<void>` works.
- Circular `cause` chains: logger depth-limits (ARCH004).
- Two areas registering the same code: registry test fails with both file paths.
- `details` containing `bigint`, `Date`, class instances: rejected by `JsonValue` typing.
- Very large `issues[]` from zod: truncated to 20 with `truncated: true`.
- A code removed in a newer client/engine pair: client falls back to generic message using `retryable` and `http` class from the envelope.

## 11. Acceptance criteria

- [ ] `Result` helpers behave as specified (unit tests for every helper, including `combine` and `tryAsync`).
- [ ] `defineErrors` rejects duplicate codes, non-snake reasons and missing `messageKey`.
- [ ] `toErrorResponse` returns the registry status and a `correlationId` for every code; unknown codes yield 500 `internal.unexpected`.
- [ ] Hostile-error test: no path, token, SQL or stack text appears in any serialised response.
- [ ] `resolveUserMessage` returns the generic key for `telegramSafe: false` on channel `telegram`.
- [ ] `fromThrown` mapping table covered (Error, string, AbortError, ZodError, SyntaxError, object).
- [ ] `docs/architecture/errors.md` explains the 5-step process; an example area file compiles.
- [ ] Packages `contracts` has no new runtime dependency besides zod.

## 12. Test plan

- `packages/contracts/src/kernel/result.test.ts`, `app-error.test.ts`, `errors/define-errors.test.ts`, `errors/registry.test.ts` (scans all `*.errors.ts`).
- `packages/gateway/src/errors/to-error-response.test.ts` with the hostile corpus (fixtures reuse the redaction corpus of `OVE_SEC003` once available; until then an inline list).
- Type tests (`expectTypeOf`) for `Result` narrowing and `defineErrors` constructor typing.
- Commands: `pnpm vitest run packages/contracts packages/gateway`, `pnpm typecheck`.

## 13. Parallelization notes

Blocks every task that returns errors; publish early (a first merge with `Result`, `AppError`, `defineErrors` unblocks others; gateway mapping can follow). Areas add `packages/contracts/src/errors/<area>.errors.ts` files, never edit this task's files. Conflict hotspot: none by design (generated registry).

## 14. Open questions and assumptions

- ASSUMPTION: codes use dotted `area.reason` strings (readable in logs, stable on the wire) rather than numeric codes.
- ASSUMPTION: HTTP-like status classes are used even if ENGINE picks NDJSON framing; the field is then `status` in the envelope.
- Open: whether `AppError.details` should carry a `docsUrl` for troubleshooting; default no.

## Implementation checkpoint (2026-10-17)

- Implemented the pure Result helpers, class-free AppError factory and foreign-error
  boundary, per-area typed catalogues, generated registry seed, safe UserMessage
  contract and gateway mapper. The public root remains browser-safe; existing Zod
  is the only contracts runtime dependency.
- The integrator approved the exact shared package-root, manifest/lockfile,
  dependency-register and contracts scaffold-test edits in
  `tasks/_proposals/OVE_ARCH003-public-exports.md`. No policy or package version
  changes were made. The aggregate regeneration command is documented and was
  compared byte-for-byte with the generated seed.
- Real focused verification: `pnpm exec vitest run packages/contracts packages/gateway`
  passed all 32 tests in 9 files, including a Vite browser build, serialised
  UI/Telegram response validation, hostile error/correlation fixtures, bounded
  detail schemas, reflection failures and type assertions. `pnpm typecheck` and
  `pnpm lint` passed; the latter includes the existing React and Tauri guards.
- The first full `pnpm test:coverage` completed with 336 passed and 4 failed tests.
  Three unchanged tooling integration tests exceeded their existing time budgets
  while other worktrees were running heavy suites. The browser test initially
  rejected Zod's own internal cycle; the focused rerun now permits only pinned-Zod
  internal cycles/PURE warnings and still rejects unresolved/external imports.
  No existing test timeout or security gate was changed.
- Full unit/coverage rerun, dependency/license/audit checks, independent Standards
  and Spec reviews, fresh CI and integration remain pending. The integrator has
  reserved heavy checks serially across worktrees; this checkpoint is not a merge
  approval or completed task. Status remains `in_progress`.
- The normal commit hooks exposed an existing generated-file/ESLint CLI warning
  conflict. The integrator approved the single `--no-warn-ignored` hook flag in
  the same proposal. Its exact command accepts the intentionally ignored
  generated registry and normal source; an unstaged temporary source containing
  an actual `no-explicit-any` violation still failed. Synthetic token strings are
  constructed at runtime with unchanged hostile-value assertions; no secret
  allowlist or existing lint rule was altered.

## Review-fix checkpoint (2026-10-17)

- Rebased the author handoff onto the merged OVE_SETUP013 integration baseline.
  The three independent-review findings are addressed without changing dependencies,
  boundary policy, lint rules or secret scanning.
- Full-response regressions first reproduced nine privacy leaks; the mapper now
  drops sensitive sanitised details and correlation values across UI, Telegram
  and notifications. The transitional pattern list covers the ARCH004 token
  families and Unix paths following diagnostic punctuation, including home paths attached to a prefix.
- A repeated-reference graph first caused 16,384 leaf descriptor reads, and an
  oversized input reached its schema. Global limits now apply during both copies:
  512 expanded values and 16 KiB of UTF-8 JSON, retaining the depth/per-container
  limits and rejecting accessors, symbols, non-JSON values and cycles.
- A virtual added area plus regenerated registry first failed actual TypeScript
  semantic checking with the closed four-code assertion. Open literal/core-code
  assertions now pass that extension. Static generated catalogue metadata plus
  an independent TypeScript AST scan replaces the variable import; duplicate,
  missing and stale catalogue checks remain.
- Focused verification passed 54 tests in the three affected test files. The
  documented bootstrap command regenerates the registry byte-for-byte. Scoped
  formatting and diff whitespace checks passed. Full checks, security gates,
  fresh independent reviews and integration remain pending; status is unchanged.

## Second review-fix checkpoint (2026-10-17)

- Seven embedded-token families first failed complete-response regressions.
  Token guards now reject credentials inside underscore/alphanumeric prefixes
  and suffixes. The corpus covers details, message parameters and correlation
  across UI, Telegram and notifications, with runtime-assembled synthetic values
  and boolean-only failure diagnostics.
- The legitimate-PERM compiler fixture first failed with duplicate imports and
  loss of its existing code (TypeScript 2300/2322). The extension probe now appends
  a unique absent reason to an existing catalogue using its AST, preserving all
  other catalogue files and registry descriptors. It also avoids shadowing an
  existing assertion filename. The PERM-present scenario semantically checks
  both the existing code and the added code.
- The global DAG/value/byte guards and independent source/metadata registry scan
  remain in place. Focused verification passed all 75 tests in the three affected
  files; formatting and diff checks passed. Full checks and fresh independent
  reviews are still required; this checkpoint does not claim completion or merge
  approval.

## Compiler integration checkpoint (2026-10-17)

- The original complete covered run exposed two compiler-test timeouts. Scoped
  passes did not establish acceptance. Facade and shared-builder experiments
  also failed complete runs and were rejected; they are absent from this change.
- The integrator approved classifying real source/TypeScript compiler work as
  Tools integration tests. Contracts retains real Vitest runtime assertions,
  duplicate rejection and native literal/core-code constraints, with no Node I/O.
  Independent source/metadata/code inventory checks and four separate compiler
  scenarios now live in `tools/errors/catalogue-types.int.test.ts`.
- Every scenario still compiles the actual contracts registry test and product
  declarations, collects all pre-emit diagnostics, preserves legitimate PERM
  additions and rejects closed/broad code types. Each normal native child keeps
  its 4000 ms bound within the unchanged 5000 ms test limit. No shared compiler
  state, framework substitute, coverage exception or new dependency remains.
- Required CI now invokes the exact integration command after covered units on
  shard 1. Structural mutations prove that removing/bypassing the step, allowing
  failure or dropping the required job dependency fails its ordinary unit gate.
  Approved additive CODEOWNERS/config-change protection covers `tools/errors/`;
  real Git fixtures prove missing-label denial and approved-label acceptance for
  the compiler and gate validator, without matching a similarly named prefix.
- Real verification on the current `90aad1c` integration base: exact hosted
  integration command 5/5 passed; focused runtime/path/CI/configuration tests
  18/18 passed. Full `pnpm test:coverage` passed 427/427 across 71 files in 33.25 s,
  with statements 94.49%, branches 93.15%, functions 96%, lines 94.58% and unchanged
  package thresholds. Full `pnpm test:int --reporter=verbose` passed 59/59 across
  13 files in 48.35 s under unchanged two-worker contention. The four compilers
  took 1466/1474/1468/1336 ms in that full integration run.
- Full `pnpm typecheck` and `pnpm lint` passed. Direct lint fixes changed only
  optional-chain/callback syntax, an equivalent bounded-read loop and the unique
  fixture nonce representation. The strict test-project check and affected
  protocol/structural-gate tests then passed again (11/11); complete suites were
  not needlessly repeated. Changed-source formatting passed.
- Rebase onto the latest DEVELOP, preservation of later SETUP014/OSS004 guards,
  security checks, fresh independent Standards/Spec reviews and exact-head hosted
  CI remain required before integration. No completion, live ruleset approval or
  merge is claimed by this checkpoint.

## Integration rebase checkpoint (2026-10-17)

- Rebased on DEVELOP `b2354d43a9730c25b521e5b14a7019d4f90962df` after SETUP017 and
  OSS004 integration. Only config-integrity.ts conflicted; its resolution retains
  the exact Markdown configuration check, package-engine protection and all
  existing guards, adding only the approved errors-tooling prefix.
- The first five task patches are unchanged in the range-diff. All other files
  merged automatically. The lockfile differs from the new base only by the
  existing contracts Zod 4.6.6 importer; no hand edit or regeneration occurred.
  Normal frozen install passed 404 supply-chain entries with zero downloads and
  normal prepare hooks.
- Strict test-project typing passed. Actual focused protection/CI regression
  fixtures passed 10 tests, with three unrelated cases filtered out; resolved-file
  format and lint passed. The integrator-approved architecture-index row now
  links the existing errors guide instead of describing it as planned.
- The newly available `pnpm check:docs` passed with zero errors and 40 existing
  legacy/pending-target warnings. It caught a one-space table-alignment drift in
  the approved index row, which was corrected without changing the rule. Metadata
  hash checks after rebase/install/focused Git fixtures confirmed the common Git
  configuration and primary checkout index unchanged.
- Full canonical checks, security gates, new independent reviews and exact-head
  hosted CI on this integration base remain pending. The prior complete-suite
  evidence is historical; this checkpoint does not claim acceptance or merge.

## Public-root integration review fix (2026-10-17)

- Fresh specification review found that the Tools integration imported generated
  metadata and its catalogue type through private contracts modules. It now
  imports all three from the existing public contracts index. No new product
  export, dependency or boundary exception was added; private source inspection
  remains data-only for the independent AST check.
- Strict test-project typing and changed-file formatting passed. The exact five
  compiler integrations passed in 6.10 s; independent child scenarios took
  1470/1363/1336/1396 ms with unchanged 4000 ms child / 5000 ms test deadlines and
  all pre-emit diagnostics. No broad suite was rerun for this focused correction.
- Both reviews must assess the updated head, and complete canonical/security and
  hosted checks on the rebased branch remain pending.


## Inherited documentation integration repair (2026-10-17)

- The original canonical check at c982943dbfd1 passed 500 units, 62 integrations
  and 33 Rust tests before an external pinned-binary download failure. After the
  public installer succeeded, an unchanged retry exceeded the ordinary 5000 ms
  budget in two inherited documentation tests that launch real nested Vitest.
  No Git integrity assertion failed; separate unchanged-source checks passed.
  Status is returned to in_progress until the repaired head passes all gates.
- The integrator approved moving the entire unchanged three-test file to
  tools/docs-check/git-environment.int.test.ts and adding its exact command as a
  mandatory shard-1 step in the existing required CI job. Real fixture callers,
  every assertion, 5000 ms outer / 10000 ms child bounds, worker limits and
  coverage policy remain unchanged.
- The existing protected CI validator now uses one two-step table and one
  schema/validator for both catalogue and documentation integrations. The new
  actual-workflow assertion first failed for the absent documentation step;
  after adding it, all 14 structural checks passed, including wrong-command and
  ordering mutations for each step. The three unchanged real integrations passed
  in 4.09 s, with cases at 1798/1295/844 ms. Strict test-project typing, scoped
  lint, formatting and diff checks passed. Original receipt hashes confirm the
  primary Git index, common configuration and Owner research unchanged. Complete
  canonical/hosted execution and both independent delta reviews remain required;
  this is not merge approval.


## Inherited suppression CLI fixture repair (2026-10-17)

- At the clean repaired checkpoint 8463318, original full typing/lint passed and
  both independent reviews passed. Original full covered execution then passed
  505/506 tests: an inherited mixed ESLint parser/whole-root CLI test exceeded its
  existing 5000 ms budget at 6817 ms. No full integration rerun or merge followed.
- Bounded diagnosis found zero scanner-eligible JS/TS bytes in the named generated
  roots, so no production exclusion change is warranted. The same scanner passed
  the current root in 4137.1 ms and a clean 260-file / 622649-byte tracked-source
  fixture in 3421.7 ms. The unchanged focused test passed once in 4303 ms; this
  does not erase the complete-suite failure.
- The integrator approved preserving all 15 pure assertions in the same 5000 ms
  test and replacing only its redundant whole-root invocation with a unique
  disposable real CLI fixture. A valid string/reasoned-comment fixture must exit
  0; adding an actual missing reason must exit 1 with the expected line-2
  diagnostic. New children are bounded at 3000 ms / 16 KiB, fixture cleanup is
  unconditional and failure assertions avoid printing source or local paths.
- Production scanner scope and the mandatory full pnpm lint scanner remain
  unchanged. This harness change is pending focused and complete verification;
  no fabricated production RED, passed aggregate or merge approval is claimed.

- The first fixture run completed both real status checks in 3143 ms but its
  exact diagnostic comparison detected a temporary-path alias mismatch. Only the
  new fixture root was canonicalised, as approved; no private diagnostic was
  printed. The same existing test then passed in 2742 ms. All seven ESLint tests
  passed once in 65.43 s, with the repaired case at 2709 ms. Strict test-project
  typing and scoped lint passed. Source comparison confirms all 15 pure
  assertions, production scanner and package.json bytes unchanged. Full coverage,
  integration, canonical/security, delta review and hosted gates remain pending.
