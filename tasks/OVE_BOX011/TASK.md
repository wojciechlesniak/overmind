---
id: OVE_BOX011
title: Implement the host-side egress proxy with host allowlist and SSRF protection
area: BOX
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH005, OVE_ARCH007, OVE_ARCH010, OVE_BOX002, OVE_BOX003]
soft_depends_on: [OVE_SEC009]
provides: ["lib:egress-proxy", "port:EgressDecider"]
needs: ["port:Clock", "port:Logger", "port:EventBus", "port:IdGenerator", "lib:data-dir"]
owns:
  - packages/adapters/sandbox-macos/src/egress/proxy/**
  - packages/adapters/sandbox-macos/src/egress/allowlist/**
  - packages/application/src/ports/EgressDecider.ts
reads: ["docs/security/login-flow.md", "docs/research/box-channels-spike.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16", "SPECIFICATION 17"]
adr_refs: [4, 20, 21, 22]
---

# OVE_BOX011: Implement the host-side egress proxy with host allowlist and SSRF protection

## 1. Summary

Agent Environments have no direct internet access. All outbound traffic goes through one small HTTP/HTTPS forward proxy in the engine process, listening on a separate owner-only Unix socket per Environment. The proxy allows only hosts decided by an `EgressDecider` (provider hosts pre-allowed, everything else denied or sent to the Owner for approval), resolves names itself, and refuses private and loopback addresses.

## 2. Context

ADR 0020 and prototype finding 3.2.4: the VM needs a host allowlist; model providers (Anthropic, OpenAI) are allowed up front, any other domain needs a Zgoda (ADR 0021: entering a new domain). bubblewrap-style full cut-off blocks the CLIs, so a proxy with an allowlist is required. SR-20. The proxy runs in the engine (Node, no new dependency: `node:http`, `node:net`, `node:dns`), reachable from the Environment only through the published socket and the in-container relay (OVE_BOX012). The proxy does not decrypt TLS.

## 3. Scope (in)

- `EgressProxy` server (HTTP proxying for `http://` URLs and `CONNECT` tunnelling).
- Host normalisation, allowlist matching, DNS resolution with address-class filtering, connection pinning to the resolved IP.
- `EgressDecider` port and the default `AllowlistDecider` backed by a per-Environment policy and the provider host data file.
- Decision logging and counters; limits.

## 4. Out of scope

- The path into the container and no-network proof: OVE_BOX012. The Approval flow for new domains: OVE_BOX013. TLS interception (not done, not planned).

## 5. Detailed requirements

1. **Port:**
   ```ts
   interface EgressDecider {
     decide(req: { envId: EnvironmentId; host: string; port: number; scheme: 'http'|'connect'; runId?: string }): Promise<EgressDecision>;
   }
   EgressDecision = { action: 'allow'; reason: 'provider'|'policy'|'approved' } | { action: 'deny'; reason: 'not_allowed'|'invalid'|'private_address'|'rate_limited'|'paused'|'policy_none'; } | { action: 'ask'; ticket: string }
   ```
   `ask` is resolved by BOX013 into allow/deny before the proxy answers; the proxy waits at most `askTimeoutMs` (default 120000) and answers `403` on timeout.
2. **Listening:** one `net.Server` per Environment bound to a Unix socket in `<runDir>/egress/<envId>.sock`, directory 0700, socket chmod 0600, created by `EgressProxyHost.openFor(envId)` and closed by `closeFor(envId)`. The Environment identity is the socket, never a header. A single proxy engine instance multiplexes all sockets with shared counters.
3. **Request handling:**
   - `CONNECT host:port`: port must be in `allowedPorts` (default 443; 80 only for explicit HTTP allow rules); host normalised: lowercase, IDNA to punycode (reject mixed-script confusables per Unicode rules), strip trailing dot, reject empty labels, reject IP literals in v4/v6/decimal/octal/hex forms (`box.egress_blocked`, reason `invalid`) even if allowlisted, reject hosts longer than 253 bytes.
   - Absolute-form HTTP (`GET http://host/...`): same host checks; methods limited to `GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS`; hop-by-hop headers stripped; request line and header limits 16 KiB.
   - Everything else (origin-form without Host mapping, `TRACE`, `CONNECT` with a path) gets `400`.
4. **Allowlist matching:** entries are `exact.host` or `*.suffix` (wildcard matches one or more labels below the suffix, never the apex unless listed). The provider list is a data file `allowlist/provider-hosts.json`: `{ "claude": ["api.anthropic.com", "claude.ai", "console.anthropic.com", "platform.claude.com"], "codex": ["api.openai.com", "chatgpt.com", "auth.openai.com"], "notes": "reviewed list, change by PR only" }` (the implementer verifies the real hosts by running the CLIs and recording observed hosts in a table in the docs; SEC009 login hosts are a subset). It MUST NOT contain `herdr.dev` (OVE_SETUP015) or package registries by default. Per-Environment policy = provider hosts of the Environment's CLI + Run-scoped grants (BOX013) + Workspace-level grants stored by PERM. Policy `mode: 'deny-all'` allows nothing.
5. **DNS and SSRF protection:** the proxy resolves the host itself (`dns.lookup` with `all: true`, `verbatim`), discards results in private or special ranges (IPv4: `0.0.0.0/8`, `10/8`, `100.64/10`, `127/8`, `169.254/16`, `172.16/12`, `192.0.0.0/24`, `192.168/16`, `198.18/15`, `224/4`, `240/4`; IPv6: `::1`, `fc00::/7`, `fe80::/10`, `ff00::/8`, IPv4-mapped forms of the above); if no public address remains, deny with `private_address` (protects the gateway socket server, local databases, Ollama, router admin pages and DNS rebinding of an allowed name to `127.0.0.1`). The connection is made to the vetted IP directly (no second resolution), with the original hostname only for SNI by the client itself. Happy-eyeballs limited to the vetted set. Resolver timeouts 5 s.
6. **Redirects:** the proxy does not follow redirects; a redirect from an allowed host to a non-allowed host is followed by the client as a new request that is evaluated independently.
7. **Limits:** concurrent tunnels per Environment (default 32), new connections per minute (default 120), tunnel idle timeout 120 s, maximum tunnel lifetime 2 h, total bytes per Environment per Run soft counter reported in decision logs (no hard cap by default, but `maxBytesPerTunnel` configurable for exfiltration limits, default unlimited because model traffic is large). Exceeding gives `429`/closes with `rate_limited`.
8. **Logging:** per decision record `{ ts, envId, host, port, action, reason, bytesIn, bytesOut, durationMs }` (never URLs, paths, headers or bodies) into an in-memory ring (last 500 per Environment) and as `sandbox.egress_decision` events for denies and asks (allows are aggregated into a counter event per minute). Hosts are logged; query strings never.
9. **Failure behaviour:** if the proxy cannot start for an Environment, the Environment is not started (BOX012 treats it as `box.proxy_unavailable`); if the decider throws, answer `403` (fail closed).
10. **Global Pause / policy changes:** `AllowlistDecider` consults an injected `isPaused()` and denies new connections with `paused`; open tunnels are closed on Pause. Policy updates apply to new connections immediately and close tunnels of revoked hosts.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`EgressPolicy` type (OVE_ARCH012), `Clock`, `Logger`, `EventBus`, secure random for ticket ids (OVE_SEC005 `SecureRandom`), node built-ins only; no proxy library dependency (a dependency would need a justification block, SETUP008).

## 8. Architecture and code placement

`packages/adapters/sandbox-macos/src/egress/proxy/{egress-proxy.ts,connect-handler.ts,http-handler.ts,host-normalizer.ts,address-class.ts,resolver.ts,limits.ts}`, `allowlist/{provider-hosts.json,allowlist-decider.ts,match.ts}`. Port `EgressDecider` in `packages/application/src/ports/EgressDecider.ts`. Pure units: normaliser, address classifier, matcher.

## 9. Security and safety

Threats: data exfiltration to arbitrary hosts (prompt-injected or malicious repo code), SSRF to host services via the proxy (127.0.0.1 gateway, link-local metadata), DNS rebinding, IP-literal and encoded-IP bypass, CONNECT to non-443 ports (SMTP, SSH), header smuggling, resource exhaustion, domain fronting (residual: a TLS tunnel to an allowed host cannot be inspected; accepted and recorded). Controls: deny by default, own DNS with address classes, pinning, port allowlist, strict parsing, per-env sockets, quotas, audit of denies. Hostnames in logs can leak intent but not content. The allowlist data file is code-reviewed; no runtime download of allowlists.

## 10. Errors and edge cases

- Host resolves to both public and private addresses: only public ones are used; if the client needs the private one the request fails.
- IDN homograph (`аnthropic.com` Cyrillic а): normalised to punycode, does not match, denied.
- Trailing-dot FQDN, uppercase, port suffix in Host: normalised before matching.
- `CONNECT` to allowed host on port 22: denied (`invalid`).
- Client half-closes the tunnel: both sides closed within 5 s.
- Proxy engine restarts: tunnels drop; the CLI retries; no state beyond counters is lost.
- Very long header or slow-loris: header timeout 10 s, connection closed.

## 11. Acceptance criteria

- [ ] CONNECT to an allowed provider host succeeds against a local test server (resolver stub) and bytes flow both ways.
- [ ] Table tests deny: IP literals in all encodings, `localhost`, hosts resolving to private/loopback/link-local, non-443 ports, look-alike and IDN hosts, wildcard apex mismatch.
- [ ] DNS rebinding test: first lookup public, second private; the proxy uses only the first vetted IP.
- [ ] `deny-all` policy blocks even provider hosts; `herdr.dev` is blocked in the default policy (test).
- [ ] Decision logs contain no URL path, query, header or body (grep test).
- [ ] Limits close excess tunnels; Pause closes open tunnels and denies new ones.
- [ ] Throwing decider results in `403` (fail closed).

## 12. Test plan

Unit tests per pure module; integration tests with real sockets in a temp run dir and a stub resolver and TLS-less echo servers; a Linux-runnable suite (no `container` needed). Escape-test cases ESC-050 exercise it through a real Environment (TEST007). Commands: `pnpm vitest run packages/adapters/sandbox-macos/src/egress`.

## 13. Parallelization notes

Independent of BOX008 at code level; BOX012 plugs it into Environments, BOX013 provides the Approval-backed decider. Hotspot: `provider-hosts.json` (owned here; additions by PR with evidence).

## 14. Open questions and assumptions

- ASSUMPTION: Claude Code and Codex CLI honour `HTTPS_PROXY`; the implementer verifies with a real run in a no-network Environment and records any additional hosts the CLIs need (telemetry hosts stay blocked; telemetry is disabled by environment variables where documented).
- Open: allowing `registry.npmjs.org`, `github.com` and `pypi.org` as an Owner-selectable "development preset" (still approval-gated per ADR 0021 by default).
