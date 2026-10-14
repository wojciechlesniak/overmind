---
id: OVE_SKILL007
title: Implement Owner-only Skill import from file, paste or URL as untrusted pending versions
area: SKILL
kind: security
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH010, OVE_DATA002, OVE_PERM020, OVE_SKILL002, OVE_SKILL003, OVE_SKILL004, OVE_SKILL006]
soft_depends_on: []
provides: ["usecase:ImportSkill", "port:SkillFetcher"]
needs: ["port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "usecase:AppendAudit", "port:SkillRepository", "usecase:ScanSkillText", "port:SafeHttpFetcher", "lib:skill-rules"]
owns: ["packages/application/src/skill/import/**", "packages/application/src/ports/SkillFetcher.ts"]
reads: ["packages/contracts/src/skill/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 13"]
adr_refs: [12, 3, 22]
---

# OVE_SKILL007: Implement Owner-only Skill import from file, paste or URL as untrusted pending versions

## 1. Summary

The only way a Skill from outside enters the library: the Owner supplies a file, pasted text or a URL; Overmind fetches (for URLs), scans, stores it as a private pending-review version with import provenance, and never activates it automatically.

## 2. Context

ADR 0012: Skills from the internet are accepted only from the Owner. The Chief and Agents can never fetch or import (SKILL001 `chief_cannot_fetch`). An imported Skill is untrusted data that can steer the model, so it stays `pending_review` until the Owner accepts (SKILL008) and defaults to private (ASSUMPTION).

## 3. Scope (in)

- `ImportSkill` use case for `via: file | paste | url`.
- `SkillFetcher` port with a bounded, SSRF-safe fetch contract implemented over the shared egress-guarded HTTP client.
- Provenance record: host name, fetched time, sha256.

## 4. Out of scope

- Review and accept: SKILL008. Scanner internals: SKILL006. Skill marketplaces or search.

## 5. Detailed requirements

1. `ImportSkill` accepts only an Owner actor from the desktop session; any Chief, Agent or Telegram actor gets `skill.import_owner_only` (audited as a violation).
2. URL import: only `https`, no credentials in URL, no redirects to other hosts beyond 3 hops, resolved IP must be public (reject loopback, link-local, private ranges, metadata addresses), response size cap 256 KiB, timeout 10 s, content types `text/markdown|text/plain` (GitHub raw accepted). Violations return `skill.import_blocked_host` or `skill.import_fetch_failed`. The fetch goes through `port:SafeHttpFetcher` which the Overmind network policy (PERM/BOX) owns; this task never opens sockets itself.
3. File and paste: size cap 256 KiB, UTF-8 only, `.md`/`.txt`; archives and front-matter-only bundles are rejected in MVP (single instruction file).
4. Extract `name` and `description` from optional front matter, but treat all of it as data: the Owner confirms name and description in the review step; defaults derive from file name. Front matter keys other than `name`, `description`, `tools` are ignored; `tools` becomes `requiredTools` metadata (never a permission).
5. Run the scanner; store version 1 with `status: pending_review`, `source: {kind:'import', via, origin: host, fetchedAt, sha256}`, `visibility: private` in the current Workspace, `scan` result attached. Even `high` findings are stored (so the Owner sees them) but acceptance needs per-finding confirmation (SKILL008).
6. The imported text is never rendered as HTML and never included in any prompt until accepted; pending versions are excluded from `getAcceptedVersion`.
7. Events: `skill.created` and `skill.version_added` (status pending). Audit `{actor, via, host, sha256, severity}`; the full URL query string is never stored or logged.
8. Rate limit: max 20 imports per hour (config), to bound abuse by a compromised session.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Scanner, `lib:skill-rules`, `Result`.

## 8. Architecture and code placement

`packages/application/src/skill/import/{import-skill.ts,parse-front-matter.ts,provenance.ts}`; port in `ports/SkillFetcher.ts`.

## 9. Security and safety

Highest-risk Skill path. Defences: Owner-only actor check inside the use case; SSRF-safe fetch; size and time caps; no auto-activation; no execution of anything found in the text; provenance stored; private by default; hash recorded so the accepted text can be verified later. The fetched content is wrapped and treated as untrusted data in any UI or Chief-visible representation.

## 10. Errors and edge cases

- DNS rebinding: resolve once and connect to the checked IP.
- Redirect to internal host: blocked.
- Zip bomb or giant body: stopped at the cap.
- Name collision: suffix proposal, never overwrite.
- Fetcher not configured (offline): `skill.import_fetch_failed` with retryable flag.

## 11. Acceptance criteria

- [ ] Chief, Agent and Telegram actors are refused and audited.
- [ ] SSRF corpus (127.0.0.1, 169.254.169.254, 10.x, IPv6 loopback, redirect chains) is blocked.
- [ ] Imported version is pending and invisible to prompt resolution.
- [ ] Provenance stored without query string.
- [ ] Rate limit enforced.

## 12. Test plan

Unit tests with fake fetcher, SSRF table test at the fetcher contract level (shared with the adapter), scanner integration. Command: `pnpm vitest run packages/application/src/skill/import`.

## 13. Parallelization notes

Parallel with SKILL008/009 after SKILL004. The `SafeHttpFetcher` adapter is not owned here.

## 14. Open questions and assumptions

- GAP: `port:SafeHttpFetcher` (egress-guarded HTTP client) has no known provider; PERM/ENGINE must provide it (cross-area).
- ASSUMPTION: imported Skills default to private (Owner question).
- ASSUMPTION: single-file Skills only in MVP.
