# Proposal from OVE_ENGINE022 to OVE_SETUP010: bridge changes

SETUP010 requirement 8 and ASSUMPTION 14.1 say the webview's api-client attaches the bearer token. The final contract (OVE_ENGINE022, `docs/architecture/desktop-bridge.md`) is that the Rust shell attaches it and JavaScript never sees it.

Requested changes in `gateway_bridge.rs` and `engine.rs`:

1. Read `run/session-token` (verify uid owner, mode 0600, not a symlink), keep in memory only (zeroize), attach `Authorization: Bearer ...` to every forwarded request, re-read once on 401.
2. Strip webview-supplied `Authorization`, `Cookie`, `Host`, `Content-Length`, `Transfer-Encoding`, `X-Overmind-Bridge`, `X-Overmind-Confirm`.
3. Return only allow-listed response headers (`content-type`, `x-request-id`, `retry-after`, `idempotent-replay`, `allow`).
4. Block from the webview: `/v1/system/bridge/register`, `/v1/system/token/rotate`, `/v1/system/shutdown`.
5. At start and after engine restart call `POST /v1/system/bridge/register` with a random 32-byte secret; send it as `X-Overmind-Bridge` on bridged requests.
6. Replace the `engine.sock` ping step with `GET /v1/system/health` (no separate control socket exists, see OVE_ENGINE001).
7. `gateway_subscribe` forwards parsed SSE events `{id?, event, data}`; add `gateway_unsubscribe`.
8. Add `cargo test` cases for stripping, blocked paths, header allow-list and token never appearing in any return value.
