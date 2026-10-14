---
id: OVE_SEC003
title: Define the secret handling policy and build the redaction test suite
area: SEC
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_SEC001]
soft_depends_on: [OVE_ARCH015]
provides: ["lib:redaction-corpus", "doc:secrets-policy", "lib:no-secrets-assert"]
needs: []
owns: ["docs/security/secrets-policy.md", "packages/testing/src/security/redaction-corpus/**", "packages/application/src/logging/redaction/vectors.ts", "tools/security/scan-snapshots.ts"]
reads: ["packages/application/src/logging/redaction/patterns.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 11", "SPECIFICATION 15"]
adr_refs: [3, 4, 6, 22]
---

# OVE_SEC003: Define the secret handling policy and build the redaction test suite

## 1. Summary

State, in one policy, what a secret is in Overmind, where secrets may live (Keychain only), how they are referenced, and where they must never appear (logs, prompts, errors, DB, snapshots, tasks, chat, Telegram). Deliver the redaction test corpus (positive and negative vectors, real-looking but fake secrets), a reusable "no secrets" assertion, and a scanner that proves test snapshots and fixtures are clean.

## 2. Context

CONVENTIONS section 7: secrets live only in the macOS Keychain, referenced by id; redaction applies at the logging layer. ADR 0006: Telegram is not end-to-end encrypted, so no secrets travel over it. ADR 0022: Overmind never sees CLI login credentials; the login code flow must not touch Overmind logs. `OVE_ARCH004` implements the redaction engine and pattern table; this task owns the policy and the corpus that proves it.

## 3. Scope (in)

- `docs/security/secrets-policy.md`.
- Corpus of fake secrets and benign look-alikes (JSON files with metadata) in `packages/testing/src/security/redaction-corpus/`.
- Test vectors file `vectors.ts` consumed by ARCH004's pattern tests.
- `expectNoSecrets(value | string | records)` assertion helper usable by every test.
- `tools/security/scan-snapshots.ts`: scans test snapshots, fixtures, task files and docs for token patterns (CI step, pre-commit friendly).
- Cross-channel redaction contract tests (logger, error mapper, Telegram helper, notifier input, event payload helper).

## 4. Out of scope

- Redaction engine and patterns: `OVE_ARCH004`. Keychain adapter: `adapters/keychain-macos`. Repository secret scanning in CI (gitleaks etc.): `OVE_SETUP007`. Login flow: `OVE_SEC009`.

## 5. Detailed requirements

1. **Definition.** A secret is any value that grants access or authority: provider API keys, Telegram bot token, gateway session/agent tokens, OAuth/refresh tokens and login codes of CLIs, SSH/PGP private keys, passwords, cookies, signing keys, Keychain item contents, `.env` values, backup passphrases (if added later). Not secrets: ids, Keychain *references* (but they are redacted in logs to avoid disclosing inventory), Telegram chat ids (personal data: handled as PII, redacted from exported reports), file paths (home prefix scrubbed).
2. **Policy statements (MUST)** in `secrets-policy.md`, each with an SR id link (SR-06, SR-07, SR-21):
   - P1 Storage: only Keychain (via `Keychain` port, ARCH012); never DB, config, event store, artifacts, backups, env files, test fixtures, task files or docs.
   - P2 Reference: stored as `SecretRef`; the DB holds refs (e.g. `Connection.secretRef`).
   - P3 In memory: held as `Secret` (never `string`) from read to use; `reveal()` only at the final call site; not stored in long-lived objects; best-effort dispose.
   - P4 Transport: passed to subprocesses only through `ProcessRunner.env` (never argv), to HTTP only via headers at the adapter edge.
   - P5 Output: never in prompts, agent environment, CLI arguments, logs, errors, events, notifications, Telegram messages, UI state, clipboard (except explicit Owner copy of a pairing code, which is not a long-lived secret), crash reports, test snapshots.
   - P6 Agents: the sandbox environment contains no Overmind secrets; provider credentials live in the per-CLI credential volume managed by the CLI itself; the Telegram bot token is never inside the sandbox.
   - P7 Telegram: no secret is ever sent or accepted via Telegram (if the Owner pastes one, the message is deleted if possible, ignored, and a warning suggests rotating it).
   - P8 Rotation and incident response: how to rotate the Telegram token and gateway token; what to do if a secret appears in a log (rotate, purge logs).
   - P9 Telemetry/export: exports and diagnostic bundles pass through the redactor and a final scan.
   - P10 Developer rules: fake secrets in tests come only from the corpus (never real), prefixed so scanners can allow them: all fake tokens contain the marker `FAKE` or the reserved prefix `ovmfake`.
3. **Corpus** (`redaction-corpus/*.json`, typed, each vector `{ id, kind, text, secretSubstrings: string[], benign: boolean, notes }`): at least 60 positive vectors and 60 benign look-alikes covering: Anthropic and OpenAI keys (`sk-ant-...`, `sk-proj-...`), Telegram bot tokens (valid shape `1234567890:AA...` 35 chars) in plain text, in URLs (`https://api.telegram.org/bot<token>/sendMessage`), in JSON and in stack traces; GitHub PAT variants; AWS key ids and secrets; JWTs; Bearer headers; Basic auth in URLs; PEM private keys (RSA/EC/OpenSSH, multi-line); OAuth callback URLs with `code=`/`state=` (Codex `http://127.0.0.1:1455/auth/callback?code=...`), refresh tokens in JSON; Overmind gateway tokens `ovm_st_...`, agent tokens `ovm_at_...`; `Authorization`/`Cookie` headers in dumps; `.env` lines (`ANTHROPIC_API_KEY=...`); Keychain refs (`keychain:app.overmind.telegram-bot-token/main`); home paths (`/Users/alice/...`, `file:///Users/alice/...`); secrets split across a line break or JSON string escapes (`\\u0073k-ant`), base64 of a secret (documented as NOT detectable, test marks `knownGap: true`), secrets inside nested objects/arrays/Maps/Errors/cause chains, inside long strings (1 MiB) and near ReDoS shapes.
   Benign vectors (must NOT be redacted or corrupted): UUIDs, ULIDs (`run_01J...`), git SHAs (40 hex), SHA-256 hashes, normal prose with `sk-` fragments (`task-list`, `desk-chair`), `bot` in words, Telegram-like `12:34` times, version strings, base64 image data headers, file names with `token` in them, words `passwordless`, UI strings "Telegram token" (label text), `Bearer` in prose, `keychain` in prose.
4. **Metrics:** recall on positive vectors 100% for known patterns (`knownGap` excluded and listed), precision: benign vectors unchanged 100%. Any new pattern added to ARCH004 must come with vectors (rule enforced by a test that every pattern id has >= 3 positive and 3 benign vectors).
5. **`expectNoSecrets(subject, opts?)`** (in `packages/testing/src/security/`): accepts string, object, log records, serialised events; fails with the offending pattern id and a masked excerpt (never prints the secret in the failure message). Includes the corpus secrets themselves as a literal deny-list, so any test that accidentally outputs a corpus secret fails.
6. **Cross-channel contract tests** (`secrets.cross-channel.test.ts`, run in CI): for each corpus secret, push it through every outbound channel's pure formatting path with fakes: Logger (MemoryLogger), error mapper (`toErrorResponse`), `Translator` params + `assertTelegramSafe`, Notifier input guard, event `expectEventSafe`, prompt assembler (`SEC004`), diagnostic export (when exists). Assert `expectNoSecrets` on every output. Channels not yet implemented are listed with `todo` markers that fail CI once the owning port exists (the test discovers ports through the registry).
7. **Snapshot scanner** `pnpm security:scan-snapshots`: scans `**/__snapshots__/**`, `**/*.snap`, `**/__fixtures__/**`, `tasks/**`, `docs/**`, `.github/**` for token patterns (the ARCH004 table plus entropy heuristic for 40+ char base64/hex strings in key-like contexts) except corpus files and lines tagged `// allow-fake-secret: <reason>`; exit 1 with file:line (masked).
8. **Keychain hygiene checks** (documented, tested where possible with the fake): Keychain items created with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`-equivalent; no `security -w` with secret in argv (argv leak via `ps`); listing returns refs only.
9. **Handling of secrets entering by accident:** if the Telegram adapter or chat receives text matching a secret pattern, it is not stored in plain in `ChatMessage` (stored redacted with a flag `containsSecret`), and a warning is shown to the Owner (behaviour spec for CHAT/TG; test hook defined here).
10. **PII note:** chat ids, usernames, home directory names are treated as sensitive in exports and shared reports (redacted unless the Owner chooses otherwise).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

ARCH004 redactor and patterns (single source), ARCH003 error mapper, ARCH015 `assertTelegramSafe`, ARCH012 `Secret`. The corpus is consumed by TEST002 `MemoryLogger` assertions and by SEC004/SEC008 tests; other tasks must import `expectNoSecrets`, not write their own regexes.

## 8. Architecture and code placement

Docs: `docs/security/secrets-policy.md`. Test support: `packages/testing/src/security/{expect-no-secrets.ts,redaction-corpus/*.json,corpus.ts}`. Vectors for the engine: `packages/application/src/logging/redaction/vectors.ts` (re-exports the subset used by ARCH004 tests; the corpus is the source). Tooling: `tools/security/scan-snapshots.ts`. Production packages never import `testing` (boundary lint).

## 9. Security and safety

The corpus contains FAKE secrets only; they are generated to match patterns but marked (`FAKE` markers and the reserved prefix) so they can never authenticate anywhere. The corpus must not be derived from real leaked credentials. The scanner output masks matches. The assertion helper never prints full secrets. Policy fails closed: unknown value kinds in `LogFields` that look like secrets are redacted.

## 10. Errors and edge cases

- A benign string matches a pattern (false positive): add a benign vector and refine the pattern in ARCH004 (via proposal); never add allowlists in code.
- Secret split across chunks of streamed output (CLI terminal reads): streaming redactor must buffer a sliding window (>= 128 chars); the corpus includes chunked vectors; adapters reading terminals MUST use the windowed redactor (policy statement P5).
- Encoded secrets (base64, URL-encoding, hex): partially covered (`%2D`-style URL-encoded tokens decoded for matching); full encodings documented as known gaps.
- Test authors needing realistic secrets: use `corpus.fake('anthropic')`.
- Extremely long lines: truncated before regex (ARCH004).

## 11. Acceptance criteria

- [ ] `secrets-policy.md` states P1-P10 and links to SR-06, SR-07, SR-21.
- [ ] Corpus has >= 60 positive and >= 60 benign vectors across all listed families; each vector is typed and validated by a schema test.
- [ ] ARCH004 redactor achieves 100% recall on non-`knownGap` positive vectors and 0 changes on benign vectors (test lives here but runs against the ARCH004 implementation once merged).
- [ ] `expectNoSecrets` fails on every corpus secret and passes on benign vectors; failure messages do not contain the secret.
- [ ] Cross-channel test covers Logger, error mapper, Telegram safety, event safety (others as `todo` markers that auto-activate).
- [ ] `pnpm security:scan-snapshots` finds a planted token in a fixture repo and passes on the clean repo.
- [ ] Chunked/streamed secret vectors are detected by the windowed redactor.
- [ ] Known gaps (base64 etc.) are listed in the policy.

## 12. Test plan

- `corpus.schema.test.ts`, `expect-no-secrets.test.ts`, `redaction.vectors.test.ts` (against ARCH004), `secrets.cross-channel.test.ts`, `scan-snapshots.test.ts` (temp repo fixtures).
- Property test: random concatenation of benign and positive vectors with random whitespace keeps recall/precision.
- Commands: `pnpm vitest run packages/testing/src/security packages/application/src/logging`, `pnpm security:scan-snapshots`.

## 13. Parallelization notes

Policy document and corpus can be written immediately after ARCH004's pattern table is stable (soft coupling: vectors file is the integration point; both tasks avoid editing each other's files). Cross-channel test file auto-discovers channels, so later areas need not edit it.

## 14. Open questions and assumptions

- ASSUMPTION: entropy heuristic in the scanner is limited to key-like contexts to avoid noise (hashes in lockfiles are excluded).
- Open: whether pasted secrets in Telegram should trigger Telegram message deletion (Bot API `deleteMessage` works for the bot's chat within 48 h); default yes, TG area decides.
