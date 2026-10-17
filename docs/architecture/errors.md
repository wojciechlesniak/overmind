# Typed errors and Result

`@overmind/contracts` is the browser-safe source of Result, AppError, the catalogue
and user-message contracts. Gateway imports only that public root. Expected
failures return `Result<T, AppError>`; programmer invariants may throw an error
named `InvariantError`. CONVENTIONS and independent review enforce this rule;
there is no claim that an expected-failure ESLint rule already exists.

## Add a code in five steps

1. Create one `packages/contracts/src/errors/<area>.errors.ts` file, exporting one
   `defineErrors(area, table)` catalogue. Use a PLAN area in lowercase or the
   cross-cutting `gateway`, `validation`, `internal`, `data` areas. The task's
   `provider` example is also supported; new provider work should use `prov`.
2. Choose an additive `area.snake_reason` code and a matching
   `errors:area.snake_reason` message key. Never reuse or rename a code. Retain
   obsolete definitions with `deprecated: true`. Supply static, safe English
   `defaultMessage`, status, severity, retryability and Telegram safety.
3. Use a strict object `detailsSchema` with fixed keys. Numbers must be finite;
   literal/enum strings are explicit whitelists. Free-form strings require
   `sanitisedText` or `sanitisedRelativePath`, which cap length at 200, strip
   controls and carry `sanitised: true` metadata. Do not mark raw CLI output safe.
4. Regenerate the aggregate and run the Tools catalogue integration test below.
   Its independent TypeScript AST scan checks every area file against static
   generated catalogue metadata and the runtime registry. Duplicate areas
   or codes fail with both repository-relative source names. Generated task
   indexes are unrelated and must not be edited. Add the corresponding locale
   keys through ARCH011/015 when those owning features are implemented.
5. Test the constructor, actual gateway envelope and denied/malformed cases.
   Run typecheck, lint, tests and applicable security checks. ARCH008 owns schema
   generation and additive compatibility; ARCH009 owns the permanent barrel
   generator. Until then use the deterministic seed command below.

```ts
import { defineErrors, sanitisedRelativePath } from "@overmind/contracts";
import { z } from "zod";

export const permErrors = defineErrors("perm", {
  denied: {
    http: 403, severity: "warn", retryable: false,
    messageKey: "errors:perm.denied", defaultMessage: "Access was denied.",
    detailsSchema: z.strictObject({ requestedRelative: sanitisedRelativePath }),
    audit: true, telegramSafe: true,
  },
});
```

That example is not a product PERM catalogue: its owning area supplies real
entries. A catalogue inside contracts uses a relative import of `define-errors`
and `safe-details` instead of importing its own root.

## Status and classification

| Status | Meaning |
| --- | --- |
| 400 | Invalid input or malformed JSON |
| 401 | Unauthenticated |
| 403 | Denied |
| 404 | Missing |
| 409 | Conflict or incompatible state |
| 412 | Precondition |
| 422 | Semantic failure |
| 423 | Paused or locked |
| 429 | Rate or resource limit |
| 500 | Internal failure |
| 502 | Upstream/provider failure |
| 503 | Unavailable |

`fromThrown` classifies actual Zod errors as `validation.invalid_input`, JSON
`SyntaxError` as `validation.malformed_json`, and an Error named `AbortError` as
`internal.cancelled` (not retryable). Other foreign values become
`internal.unexpected`; a trusted adapter may supply a known code hint. Foreign
objects/reflection failures fail closed. Original messages, stderr and stacks
are never copied; the original value is a non-enumerable in-memory `cause`.
ARCH004 may inspect it only through its redacting logger. JSON serialization of
an AppError omits cause, including circular causes.

Validation details contain at most 20 issues and `truncated`. Each issue has only
`path`, `code`, `message`. Arbitrary path strings become `field` placeholders and
safe nonnegative numeric positions remain; original field names may themselves
contain sensitive input. Messages and codes are generic safe constants. No input,
expected value, schema error message, private table or filesystem path is echoed.

## Boundaries and usage

```ts
import { err, ok, tryAsync, fromThrown, resolveUserMessage } from "@overmind/contracts";

// Pure use case: dependencies are passed by its application owner.
const decide = (allowed: boolean) => allowed ? ok(undefined) : err(permErrors.denied({ requestedRelative: "src/file.ts" }));

// Adapter boundary: wrap foreign rejection before returning across packages.
const load = () => tryAsync(() => foreignPort.read(), fromThrown);

// UI/Telegram/notification rendering belongs to their i18n owner.
const message = resolveUserMessage(error, "ui");
// translator.t(message.key, message.params)
```

`toErrorResponse(error, { correlationId, channel?, registry?, logger? })` lives in
`packages/gateway/src/errors/to-error-response.ts`. Transport framing remains
ENGINE's responsibility. The mapper uses registered defaults for **every** code,
ignores supplied message/retryability/correlation fields, revalidates details,
and maps unknown codes or thrown values to the built-in safe fallback. Its
optional logger receives only a static invalid-details diagnostic plus registered
codes. Auditing `audit: true` denials belongs to the gateway/use case, not the mapper.

The request pipeline supplies correlation IDs. Only bounded safe identifier text
is echoed; malformed/missing runtime values become `unavailable`. No clock or
randomness is hidden in contracts. Telegram-unsafe definitions and unknown codes
resolve to `errors:generic.try_again_on_desktop`. Params contain only validated,
whitelisted top-level primitives, never nested data or rendered text. Clients
use `isKnownCode` for newer engine codes and keep their generic fallback.

Details are copied before schema parsing without invoking property getters.
Dates, instances, bigint, nonfinite numbers, cycles, prototype keys and oversized
objects are rejected. Limits are depth 8, 100 entries per container, 512 values across the whole copied tree, and
16 KiB of serialized UTF-8 JSON. Global value and byte budgets apply during
each copy, before allocation of further descendants and before schema parsing;
repeated references spend the budget on each expansion. Shared acyclic input is
accepted only while its expanded JSON stays within these limits. Unsupported schema projections fail closed;
recursive references and dynamic record keys are not permission to echo text.
Relative-path sanitization checks representation only; SEC002 still owns real
canonical-path, mount and symlink authorization.

The local pattern defence rejects common token, SQL, stack, absolute-path and
control patterns after schema validation, including Unix paths after diagnostic
punctuation, AWS keys, Telegram bot/API tokens, Overmind session/agent tokens,
Keychain references and OAuth codes. The same text guard protects correlation
identifiers. Token patterns also match inside diagnostic identifiers; added
letters, underscores or suffixes never make credentials safe to echo. It is
transitional until ARCH004's shared pure redaction seam exists; do not introduce an adapter import into L0.
Pattern matching does not make arbitrary CLI/file contents an approved detail.

## Reproduce the initial aggregate

Run from the task worktree. This reads source declarations as data and writes only
the task-owned generated registry. ARCH009 will replace this bootstrap command.

```sh
python3 - <<'PY'
from pathlib import Path
import re
root = Path('packages/contracts/src/errors')
rows = []
areas = set()
for path in sorted(root.glob('*.errors.ts')):
    found = re.findall(r'export const (\w+) = defineErrors\("([a-z]+)",', path.read_text())
    if len(found) != 1 or found[0][1] != path.name.removesuffix('.errors.ts'):
        raise SystemExit('Expected one named catalogue matching its area file')
    name, area = found[0]
    if area in areas:
        raise SystemExit('Duplicate area')
    areas.add(area)
    rows.append((path.name, name))
lines = ['// Generated catalogue seed; regenerate using docs/architecture/errors.md.',
         'import { createErrorRegistry } from "./registry.ts";']
lines += [f'import {{ {name} }} from "./{file}";' for file, name in rows]
lines += ['', 'export const catalogueModules = [']
lines += [f'  {{ source: "{file}", errors: {name} }},' for file, name in rows]
lines += ['] as const;',
          'export const errorRegistry = createErrorRegistry(catalogueModules);',
          'export type ErrorCode = keyof typeof errorRegistry;',
          'export function isKnownCode(code: string): code is ErrorCode {',
          '  return Object.hasOwn(errorRegistry, code);', '}']
(root / 'index.generated.ts').write_text('\n'.join(lines) + '\n')
PY
pnpm exec prettier --write packages/contracts/src/errors/index.generated.ts
pnpm exec vitest run packages/contracts packages/gateway
pnpm exec vitest run --config vitest.int.config.ts tools/errors/catalogue-types.int.test.ts
pnpm typecheck
```

The Tools integration command checks the real source inventory and compiles the
actual contracts registry test against additive/PERM and invalid closed/broad
code types. Each compiler subprocess is bounded to 4 seconds within the unchanged
5-second test deadline. The required CI test matrix runs this exact command on
shard 1 after covered units; a structural mutation test detects a removed or
bypassed integration step. Contracts runtime tests contain no Node I/O.

The actual browser test bundles the contracts root with existing Vite/Rollup,
rejects external dependencies and executes no input as code. It tolerates only
misplaced PURE annotation warnings and cycles entirely inside the pinned Zod
4.6.6 package; unresolved imports and builtin externalization remain failures.
