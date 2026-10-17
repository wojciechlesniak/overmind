# Documentation checker

Run `pnpm check:docs` from the repository root. The default reads tracked Markdown
outside `tasks/` and `docs/pl/`, checks links without network access, invokes the
official markdownlint core and reports errors and warnings. Existing Polish prose
produces warnings until its translation task completes. Upstream conduct text and
third-party notices retain their prescribed Markdown-lint exclusions.

## Options

| Option       | Behavior                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--publish`  | Require LICENSE, completed pending documents, resolved Owner placeholders and no draft translation metadata, including excluded Markdown sources |
| `--i18n`     | Require the OVE_OSS005 translation plugin; unavailable means failure                                                                             |
| `--fix-toc`  | Update explicit managed contents and dependency-credit blocks only                                                                               |
| `--github`   | Add escaped GitHub workflow annotations to the diagnostic table                                                                                  |
| `--external` | Manually check public HTTP(S) reachability, with warnings on failure                                                                             |

Unknown options fail. Errors exit with status 1; warnings alone exit with status 0.
The default never sends network requests. External checks allow only ports 80 and
443, verify every DNS answer before connecting to a pinned address, use at most two
workers and give each URL a ten-second deadline. HEAD falls back to GET only when
the server does not support HEAD. Redirects, credentials and nonpublic addresses
are denied; IPv6-only hosts conservatively produce a warning. No cookies or tokens
are sent, and response bodies are not consumed.

Unfiltered script commands are checked against the root manifest. Literal
`--filter` or `--dir` selections are checked against the real tracked manifest
selected by `pnpm-workspace.yaml`; unknown workspaces and scripts fail. Complex
filter expressions and multiple selectors are unsupported and fail closed.

## Configuration and generated sections

The historical `.markdownlint-cli2.jsonc` filename is retained, but its contents
are JSON data with comments and trailing commas: only the reviewed `config` and
`ignores` data fields.
No executable configuration, extends loader or inline disable directive runs.
The direct markdownlint 0.41.1 API is the Owner-approved core from CLI2 0.23.3.
The checker enforces its fixed file exclusions rather than evaluating glob code.

Place one matching `docs-toc:start` / `docs-toc:end` HTML comment pair around a
managed contents block, or `docs-credits:start` / `docs-credits:end` around generated
credits. The fix option preserves other text. Credits come from the dependency
inventory's third-level headings, including reserved packages. Malformed or
duplicate pairs fail; writes are atomic and executable aliases are denied.

Pending local targets must be registered in `pending-links.json` with a tracked
owning task. Remove an entry in the same change that creates its target. Stale
entries fail ordinary checks; any remaining entry blocks publication.

Git inventory selects inputs; a tracked name alone does not prove that a target
still exists. Inventory reads and temporary-repository test commands use the shared
Git environment isolation helper: inherited `GIT_*` variables cannot redirect
repository, index, object or configuration selection. Other environment values,
including PATH, HOME and the pinned toolchain, are preserved.
Linked files and LICENSE must resolve to real regular files inside
the repository on the same device. Binary assets are checked without reading
their contents. Document reads open without following the final symlink or
blocking on a FIFO, validate descriptor identity/type/size before content access,
and stop after at most one MiB plus a single overflow-detection byte. Changed
documents fail. Translation metadata uses the same public `frontMatterLines`
parser result as Markdown checks, including a leading UTF-8 BOM, CRLF and trailing
delimiter whitespace. Only renderer-recognized YAML metadata is interpreted;
TOML, JSON, incomplete metadata and unsupported delimiters fail publication.

## Translation extension

Every tracked canonical `tools/docs-*/check.ts` module is trusted project code
and exports a default object with `name` and `run(ctx)`. A plugin called `i18n`
supplies translation parity checks. The context contains root, read-only typed
files and paths, and flags `publish`, `i18n`, `fixToc`, `github`, `external`.
Run returns diagnostics with `file`, positive `line`, `rule`, `severity` and
`message`; asynchronous results are supported. Report only tracked paths and
never include document contents, credentials or local paths in messages.

Modules are discovered from Git, not Markdown input. Source aliases, escaped
paths, invalid exports and malformed diagnostics fail closed. Plugins are reviewed
repository code, not a sandbox for untrusted executable extensions.
