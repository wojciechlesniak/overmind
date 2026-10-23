# OSS006: reject malformed CLI inputs before loading unused operations

The integrator applies this finite maintenance correction under the Owner's direct
2026-10-23 instruction to resolve routine MVP blockers. The completed OSS006
allocation remains unchanged; no parent acceptance or new capability is implied.

## Original failure and measurement

ARCH055 final f05c492 pre-push passed typecheck/lint and1474 unit cases but failed
one unchanged public ADR malformed-event case: its child exceeded3000ms; the
outer case took3157ms. Remote ARCH055 remains fbf4d90. These are retained RED
records, never replaced by a retry or an earlier passing candidate.

A disposable paired CLI probe retained the actual installed TSX loader, same
synthetic malformed event, fixed safe diagnostic, exit1 and original3000ms child
limit. Narrowing only the task-parser barrel import did not show a consistent
benefit and is not included. Deferring operation modules and separating the
small event boundary measured base443..597ms versus177..345ms across four
balanced samples each. All eight outputs/exits matched. Local diagnostic timing
is not proof of the original timeout's sole cause or a hosted fix.

## Exact finite allocation

- `tools/adr/cli.ts`: keep argument validation, confined event reading and error
  redaction; load only the selected operation after validating its arguments or
  event. Await imports inside the existing safe error boundary.
- `tools/adr/{check,new,gen-index,renumber}.ts`: await CLI completion explicitly.
- `tools/adr/labels.parse-boundary.ts`: move the existing event parser unchanged.
- `tools/adr/text-schema.ts`: one shared unchanged bounded text schema.
- `tools/adr/input.parse-boundary.ts`: reuse that schema and preserve the existing
  parseLabels export. ADR/Markdown parsing remains unchanged.
- `tools/adr/labels.test.ts`: verify valid/missing events, label count/name limits,
  malformed shapes and fixed non-reflective diagnostics.
- This proposal records the allocation and evidence.

No repository/history check, Git authority, file confinement, accepted label
shape, dependency, license, runtime, worker, retry, deadline, assertion, workflow
or release control changes. No untrusted input becomes a module specifier: all
four deferred imports are fixed local literals. The same original native123case
inventory in30files remains required; no missing, skipped or failed check passes.

## Required completion evidence

Run actual types and lint before focused ADR tests, the original public safety
and native ADR cases, full ordinary publication hooks, applicable dependency,
license, audit, architecture, secret, SBOM, build and docs checks. Both independent
whole Standards and Spec reviews and all exact candidate hosted workflows must
pass. Prevalidate the exact squash message and recheck the actual message.
The actual merged DEVELOP must pass before affected ARCH055 resumes publication.
Original timing failures remain visible. Missing physical isolation/penetration
or provider evidence remains assigned to its existing tasks, never accepted here.

## Implementation and final verification checkpoint

Real types and lint passed before51ADR unit cases and29original native ADR cases
in10files. Dependency/license checks, production-high and all-critical audits,
implemented architecture checks, history/tree secret scans, SBOM, build, docs and
agent-rule checks passed. The ordinary staging publication passed1477unit cases
in123files, types and lint. Both whole independent source reviews passed atc349a33.

An initial private selector named a nonexistent test project; no tests ran under
that selector. Its corrected original integration selection passed29cases. A later
reserved standalone boundary command failed because ARCH002 has not supplied it.
That command remains unavailable and is never called passed; existing implemented
architecture checks passed separately. Those invocation failures and the original
055timeout remain retained rather than overwritten.

The one original source commit's author/date/message and all nine source/test
blobs were preserved by ordinary rebase on ARCH056's actual mergea1b63af. That
base's actual post checks are still required separately. This final evidence head
requires its own normal full hooks, independent whole reviews and complete hosted
checks. Only after those and the base's actual post checks pass may normal merge
proceed; then its own merged DEVELOP must pass before055resumes. No initial
staging/label-event run or older passing copy substitutes for this final evidence.
