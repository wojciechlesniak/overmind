# Unit and contract tests

Run `pnpm test`, `pnpm test:coverage`, or `pnpm test --shard=1/2`.
Projects are discovered from their `vitest.config.ts`; each exports its shared
layer's `coverageThreshold`. Vitest 5 coverage is process-wide, so the root
translates that metadata into one native glob threshold per package. Coverage
in another package cannot rescue a failing package. No thresholds are lowered.
The fail-closed regression adds an unimported domain function and verifies that
its own threshold fails (lowering a threshold, as phrased in the original task,
would make a gate easier rather than fail it).

Node and Happy DOM use isolated forks, UTC, C.UTF-8, no global test API, no retries,
and no fetch access by default. Import and call `allowLocalhost()` inside the
specific test that needs a local fake server. Only exact loopback hosts and
HTTP(S) are permitted, credentials are forbidden, and redirects are rejected
so a local server cannot redirect a request to the internet. Permission resets
between tests. This is a fetch guard, not an OS-level network sandbox.

DOM setup follows the actual test environment, including per-file
`// @vitest-environment happy-dom` overrides in Node-default packages. Such files
receive the same matchers, automatic cleanup and browser stubs as UI projects.
Happy DOM replaces jsdom under the Owner's license-compatible tooling request.
Script evaluation and external script/style/image/iframe loading are disabled;
real-browser behavior is verified by the Playwright owner tasks.

Production packages exclude test files so importing Vitest types cannot grant
Node/DOM globals to domain source. `tsc -b` still validates every production
project, then `tsconfig.tests.json` checks test/config source with Node/DOM
fixtures. The `zz-vitest.mjs` extension selects that test-only typing project;
no lint rule is disabled. Integration files use `*.int.test.ts`. The separate `vitest.int.config.ts`
provides the initial `overmind-int` project; owning areas add their specialised
projects when needed. Vitest 5 rejects a project filter matching zero projects
even with `--passWithNoTests`, so this honest empty project keeps the initial
integration command usable without including integration work in unit runs. The empty integration command alone
permits no tests; normal unit projects retain `passWithNoTests: false`.

Bootstrap Node tests migrate to Vitest here. The heavier subprocess meta-tests
have explicit local timeouts; the shared default remains five seconds. React
and React DOM are development dependencies for Testing Library here. Their
production adoption belongs to OVE-009. Testing Library's required DOM peer is
pinned to 10.4.2 rather than disabling peer checks. All additions consume the
catalog; OVE-008 maintains the complete dependency register.

## Configuration transition

The root test configuration admits all 17 workspace projects and the separate
boundary-rules project explicitly. Each workspace project must have exactly one
canonical regular configuration at its legacy path or under
`tools/vitest-projects/<package>/vitest.config.ts`. Missing, duplicate and unsafe
paths stop configuration before tests run.

Coverage imports use literal selected paths in `tools/vitest-projects/coverage.ts`.
A later migration batch updates its four imports and keeps every threshold keyed
to the original product `src/**` root. Configurations belong to the root test
program; Tools production excludes only the new configuration subtree.
