# Desktop scaffold integration

The Owner authorizes sequential task implementation, necessary integration, review
and passing merges into DEVELOP. This task appends desktop manifest dependencies
and scripts, updates the dependency catalog/register, and adds its real build/server
integration checks to the existing CI build job. The existing TypeScript config is
retained; vite-env.d.ts provides vite/client types. Tests live beside the scaffold.

The accepted SETUP006 license-compatible Vite7.3.7 replacement remains in force.
The reserved plugin-react6 requires Vite8, while plugin-react5 introduces the denied
Babel/browser-data graph. Use the official @vitejs/plugin-react-swc4.3.3 (MIT,
published2026-07-30; peerVite4..8, Node20.19/22.12+) instead. It provides the same
React Fast Refresh plugin interface. Add its exact catalog pin/register block.
Native SWC code is supplied by reviewed platform packages; its postinstall remains
explicitly denied, as are existing esbuild/lefthook scripts. No license, age or build
permission exception is introduced. Validate the full resolved license/audit graph.

The scaffold dist checker and its future reviewed literal exception file are
protected by CODEOWNERS. Exceptions require a specific file pattern and reason;
they do not authorize dynamic execution or remote requests. Real built output and
negative fixtures are reviewed before allowing any upstream diagnostic literal.
The server validates the optional development proxy as a loopback-only HTTP URL;
production builds never consume that setting. Preview also binds to loopback.

The first actual build identified two pinned React DOM false positives: the quoted
React error-documentation URL and the exact minified assignment creating an inert
empty script through innerHTML. The reviewed literal exception file removes only
those exact strings in assets/index-*.js. Changed script bodies, unrelated URLs and
extended React URLs remain failures. Production build integration runs the actual
SETUP007 scanner on the generated files, proves a synthetic inserted credential is
detected, and verifies reports stay redacted. CI prewarms checksum-verified binaries
outside the Vitest network-denied process before running both integration files.

The existing desktop tsconfig stays unchanged. The root solution gains a reference
to the already-existing desktop tsconfig.node.json, so Vite's Node-side configuration
is built and discoverable by the typed lint service. No type/lint rule is relaxed.

Pinned Vite7 treats port0 as its default5173, so the integration test obtains a free
nonzero OS-assigned port before creating Vite. It still validates the production
configuration's default5173 and strictPort, actual loopback binding, hostile Host,
CORS, denied filesystem access and a real proxy preserving Host.
The dist script parses actual script attributes instead of accepting data-src or
src-like text inside another attribute; protocol-relative sources also fail.

The shared config-integrity guard also covers Vite and check-dist source/allowances;
a real isolated Git-diff regression proves missing labels deny each change. This
is a necessary security integration into SETUP006's existing gate, not a new
permission source. Existing lint/type/coverage thresholds are retained.

The dedicated Node TypeScript project now includes vite.config.ts only. Vitest's
config stays covered by the central no-emit test project; compiling it a second
time inside the composite app project would incorrectly emit the shared root test
configuration outside its rootDir. No source or test loses type-check coverage.

Server tests use one active Vite instance at a time. The occupied-port regression
uses a native TCP listener in a separate test; simultaneous Vite instances sharing
a root/cache caused a shutdown wait unrelated to the tested product configuration.
HTTP probe connections explicitly close. Final tests keep the normal time limits.
