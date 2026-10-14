---
id: OVE_PERM004
title: Implement the capability intersection algebra (terminal, network, git, MCP, tools)
area: PERM
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_PERM001]
soft_depends_on: []
provides: ["lib:capability-intersection"]
needs: []
owns: ["packages/domain/src/perm/intersection/capabilities.ts", "packages/domain/src/perm/intersection/capabilities.test.ts", "packages/domain/src/perm/intersection/host-patterns.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.10"]
adr_refs: [3, 21]
---

# OVE_PERM004: Implement the capability intersection algebra

## 1. Summary

Pure functions that intersect the non-directory parts of policies (terminal, network allowlist, Git, MCP servers, Tool ids) so that each field can only get narrower as layers are added. Includes the host-pattern matcher used by network checks and by the sandbox egress plan.

## 2. Context

`CapabilitySet` (PERM001) fields are `'inherit' | concrete`. `inherit` is the identity. After folding all layers, any field that is still `inherit` (nobody granted it) resolves to deny, which is the deny-by-default rule (ADR 0003, SR-01/SR-02). Network is a special case: provider hosts are pre-allowed by the sandbox (ADR 0020) and every other new domain needs an Approval (ADR 0021), which is decided in `OVE_PERM006`/`OVE_PERM007`, not here.

## 3. Scope (in)

- `intersectCapabilities(layers: CapabilityLayer[]): ResolvedCapabilities`.
- `ResolvedCapabilities = { terminal: boolean, network: { mode:'deny' } | { mode:'allowlist', hosts: HostPattern[] }, git: { local: boolean, remote: boolean }, mcp: { servers: string[] }, tools: { toolIds: string[] } }` (no `inherit` left).
- `hostMatches(pattern, host)`, `intersectHostLists(a, b)`, `normalizeHost(input)`.

## 4. Out of scope

Directory handling (PERM003), composing layers into Effective Permissions (PERM005), egress proxy implementation (BOX), what counts as "new domain" for approvals (PERM006).

## 5. Detailed requirements

1. **Booleans** (`terminal`, `git.local`, `git.remote`): `allow ∧ allow = allow`, anything with `deny` is `deny`, `inherit` is skipped; unresolved `inherit` becomes `false`.
2. **Network:** `deny` absorbs everything. `allowlist ∩ allowlist` = hosts that both lists admit. `intersectHostLists`: for exact vs exact, equality; exact vs wildcard `*.x.com`, the exact host if it ends with `.x.com` (and is not `x.com` itself); wildcard vs wildcard, the longer (more specific) suffix if one is a suffix of the other, otherwise nothing. Result sorted, de-duplicated, max 200 (if more, keep deterministic order and return `perm.invalid_policy` `too_many_hosts` from the composer). `inherit` is skipped; unresolved becomes `{ mode: 'deny' }`.
3. **Host matching** (`hostMatches`): inputs are lowercased, trailing dot removed, IDNA converted to ASCII punycode by a small pure function (no network); a host containing `/`, `:`, `@`, whitespace, or being an IP literal never matches any pattern (IP access is only possible through an explicit Owner approval, never a pattern). `*.x.com` matches `a.x.com` and `a.b.x.com` but not `x.com` and not `evilx.com` or `x.com.evil.com`.
4. **Lists** (`mcp.servers`, `tools.toolIds`): set intersection; `inherit` skipped; unresolved becomes `[]`.
5. **Narrowing property:** for every field, `resolve(layers ++ [extra])` is a subset/stricter-or-equal of `resolve(layers)`. A helper `isNarrowerOrEqual(a: ResolvedCapabilities, b: ResolvedCapabilities)` is exported (used by PERM005 properties and PERM011 to classify a policy edit as widening or narrowing).
6. **Reserved keys** (`chrome`, `simulator`) are not present in MVP; the function ignores unknown keys by design of the strict schema (they cannot exist).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`CapabilitySet`/`HostPattern` from PERM001. Do not duplicate DNS parsing: this task owns `host-patterns.ts`; BOX imports `hostMatches` for the egress proxy test oracle.

## 8. Architecture and code placement

`packages/domain/src/perm/intersection/capabilities.ts` and `host-patterns.ts`; pure, dependency-free. Adding a capability later = a new small function plus one line in the fold (OCP via a `CapabilityAlgebra[]` registry array; each algebra implements `{ key, identity, meet, resolve, narrowerOrEqual }`).

## 9. Security and safety

Host matching is classic bypass territory: `evil-x.com`, `x.com.evil.com`, `x.com@evil.com`, trailing dot, uppercase, unicode lookalikes, punycode, `localhost`, `127.0.0.1`, `[::1]`, decimal/octal IP forms. All must fail to match a pattern (IPs never match). Unknown or malformed host input never matches (fail closed). No regular expressions built from policy data (avoids ReDoS and injection): matching is done with string operations.

## 10. Errors and edge cases

- Allowlist intersection resulting in an empty host list: `{ mode:'allowlist', hosts: [] }` is normalised to `{ mode: 'deny' }`.
- `*.example.com` and `example.com` in one list: both kept, they are distinct.
- Port in host input (`a.com:8080`): rejected as non-matching (the proxy strips ports before calling, covered in the contract tests).

## 11. Acceptance criteria

- [ ] Given layers `[terminal: allow, terminal: deny]`, the result is `false`; given `[inherit, inherit]`, `false`.
- [ ] Given allowlists `[*.github.com]` and `[api.github.com, github.com]`, the result is `[api.github.com]`.
- [ ] Each bypass string in section 9 fails to match `*.x.com` / `x.com`.
- [ ] Property: adding any layer never makes any field more permissive (`isNarrowerOrEqual`).
- [ ] Unresolved fields resolve to deny/empty.

## 12. Test plan

Table tests for booleans, lists, host intersection (30+ rows) and host matching (50+ strings, including unicode and IP forms); fast-check properties for monotonicity and commutativity. `pnpm vitest run packages/domain/src/perm/intersection/capabilities`.

## 13. Parallelization notes

Parallel with PERM003 and PERM006. BOX may reuse `hostMatches` after this merges.

## 14. Open questions and assumptions

- ASSUMPTION: no IP literal can be pattern-allowed in MVP (only by a per-Run Approval). Revisit for local dev servers (`localhost` inside the sandbox is unaffected, it never leaves the container).
- Open: should `git.remote` imply provider hosts for Git over HTTPS? Default: no, Git network traffic follows the `network` allowlist like everything else.
