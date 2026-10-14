---
id: OVE_ARCH003
title: Define the Result type, AppError and the error code catalogue
area: ARCH
kind: contract
size: M
priority: P0
mvp: true
status: todo
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
