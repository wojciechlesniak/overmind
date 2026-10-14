---
id: OVE_SETUP009
title: apps/desktop Vite + React scaffold
area: SETUP
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_SETUP001, OVE_SETUP002]
soft_depends_on: [OVE_SETUP003, OVE_SETUP004, OVE_SETUP008]
provides: ["lib:desktop-scaffold", "lib:vite-config"]
needs: []
owns:
  - apps/desktop/index.html
  - apps/desktop/vite.config.ts
  - apps/desktop/src/main.tsx
  - apps/desktop/src/vite-env.d.ts
  - apps/desktop/src/app/App.tsx
  - apps/desktop/public/**
  - apps/desktop/scripts/check-dist.mjs
reads: ["apps/desktop/package.json", "tsconfig.base.json"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13"]
adr_refs: [17, 18, 5]
---

# OVE_SETUP009: apps/desktop Vite + React scaffold

## 1. Summary

Create the minimal Vite 8 + React 19 + TypeScript application in `apps/desktop` that builds a static bundle into `apps/desktop/dist`, runs a dev server bound to loopback, and is shaped for a strict Content-Security-Policy and a Tauri webview (no remote content, no inline scripts, no `eval`). Product UI, routing and the shell are added later by the SHELL and feature areas.

## 2. Context

ADR 0018: the window is Tauri + React + TypeScript. The window is only a client of the engine (ADR 0005); it talks to the engine through `@overmind/api-client` and never touches the database, files or CLIs (CONVENTIONS section 6). The UI imports only `ui-kit`, `api-client` and `contracts`. Versions (verified 2026-10-13): `vite@8.3.4`, `@vitejs/plugin-react@6.1.2`, `react` and `react-dom` 19.3.0, matching `@types/*` 19.3.0 (see OVE_SETUP008). `apps/desktop/src/app/` belongs to the SHELL area (PLAN section 6); this task only leaves a placeholder there. Feature folders and `feature.manifest.ts` discovery are OVE_ARCH009.

## 3. Scope (in)

- `index.html`, `vite.config.ts`, `src/main.tsx`, `src/vite-env.d.ts`, placeholder `src/app/App.tsx`, `public/` (empty app icon placeholder only), `scripts/check-dist.mjs`.
- Dependencies and scripts in `apps/desktop/package.json` (append-only edit of the skeleton manifest).

## 4. Out of scope

- Tauri shell and `tauri.conf.json`: OVE_SETUP010.
- App shell, routing, layout, navigation: SHELL area. Feature discovery via `import.meta.glob`: OVE_ARCH009.
- i18n runtime: OVE_ARCH011. Design tokens, fonts, global CSS: DS area (`ui-kit`).
- Storybook: DS tasks. Playwright and visual tests: OVE_TEST004, OVE_TEST005.
- The mock gateway used by `pnpm dev`: OVE_SETUP012.

## 5. Detailed requirements

1. **Dependencies** (all `catalog:`): `react`, `react-dom`, `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (workspace); dev: `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`, `@types/node`. React Flow (`@xyflow/react`) is NOT added here (WFED area adds it with a register entry). No router, state or CSS library is chosen here.
2. **Scripts** (package-level, names fixed): `dev` = `vite`, `build` = `vite build && node scripts/check-dist.mjs`, `preview` = `vite preview`. (`test:e2e`, `test:visual`, `tauri` are added by OVE_TEST004/005/OVE_SETUP010.)
3. **`vite.config.ts`:** plugins `[react()]`; `clearScreen: false`; `server: { host: "127.0.0.1", port: 5173, strictPort: true, allowedHosts: ["127.0.0.1", "localhost"], fs: { strict: true }, cors: false, watch: { ignored: ["**/src-tauri/**"] } }`; `build: { outDir: "dist", target: "safari18", sourcemap: false, minify: true, cssCodeSplit: true, modulePreload: { polyfill: false }, assetsInlineLimit: 0, chunkSizeWarningLimit: 800 }`; `server.proxy`: when `process.env.OVERMIND_DEV_PROXY` (for example `http://127.0.0.1:7878`) is set, proxy `/v1` to it with `changeOrigin: false` (used by OVE_SETUP012, ignored in builds); `envPrefix: ["VITE_OVERMIND_"]` (nothing else is exposed to the client bundle); `define` does not inject secrets; `resolve.dedupe: ["react", "react-dom"]`. `assetsInlineLimit: 0` keeps all assets as files so a strict `img-src 'self'` works (no `data:` needed for app assets). Target is the WebKit of macOS 26; if Vite 8 rejects `safari18` in the pinned version, use the newest accepted Safari target and record it.
4. **`index.html`:** `<!doctype html>`, `lang="en"`, `<meta charset="utf-8">`, viewport meta, `<title>Overmind</title>`, `<div id="root"></div>`, one `<script type="module" src="/src/main.tsx">`. No inline script, no inline style, no external URL (fonts or analytics), no `<base>`.
5. **`src/main.tsx`:** `createRoot(document.getElementById("root")!)` (the single permitted non-null assertion, suppressed with a reasoned disable comment or replaced by an explicit null check that throws), renders `<StrictMode><App/></StrictMode>`. No global side effects beyond that.
6. **`src/app/App.tsx` placeholder** with header `// PLACEHOLDER(SHELL): replaced wholesale by the SHELL area`. It renders a `main` element with `data-testid="app-root"` and the text "Overmind". It exists so build and tests have something to render.
7. **`scripts/check-dist.mjs`** (dependency-free): after build, fails if any file in `dist/` contains `eval(`, `new Function(`, `http://` or `https://` URLs other than the XML/SVG namespace `http://www.w3.org/`, inline `<script>` without `src`, or references to `fonts.googleapis.com`, `cdn.`, `unpkg`, `jsdelivr`. Prints a table of the 10 largest files. This is the guard that keeps the CSP in OVE_SETUP010 truthful.
8. **Environment:** no `.env` files; the engine endpoint is not configured through env vars in the bundle but obtained at runtime from the Tauri shell (OVE_SETUP010) or the dev proxy (OVE_SETUP012).
9. **Public assets:** only `public/favicon.svg` placeholder (the real icon comes from DS/branding). No runtime fetches of assets from other origins.
10. `tsconfig.json` (from OVE_SETUP002) is used as is; `types: ["vite/client"]`, `lib` with DOM.

## 6. Design notes

N/A, functionality only (no visual specification yet; the layout belongs to SHELL).

## 7. Reuse

Uses `lib:tsconfig-base` and the catalog. The dist guard is reused by OVE_SETUP014 (release verification runs it on the packaged resources).

## 8. Architecture and code placement

Layer: UI composition root of the desktop app (`apps/desktop`). Allowed imports: `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts`. `src/main.tsx` is the only file that touches `document`. Features live in `src/features/<feature>/` (ARCH009), app chrome in `src/app/` (SHELL), shared UI helpers in `src/shared/`.

## 9. Security and safety

- The built bundle MUST work under a CSP of `script-src 'self'` with no `unsafe-eval` and no `unsafe-inline` for scripts: guaranteed by requirement 7 plus the Vite config.
- Dev server binds only to loopback with `allowedHosts` to mitigate DNS-rebinding attacks and `fs.strict` to avoid serving files outside the workspace; it is a development tool and never packaged.
- No remote fonts/scripts/telemetry: the app makes no network calls of its own; all data flows through the engine gateway.
- No secrets in the client bundle: `envPrefix` is restricted; a unit test greps `dist/` for the patterns of OVE_SETUP007.
- Source maps disabled in production builds to avoid shipping source paths; developer builds may enable them via a flag in OVE_SETUP012.

## 10. Errors and edge cases

- Port 5173 already used: `strictPort` makes `pnpm dev` fail instead of silently choosing another port (Tauri `devUrl` depends on it).
- React StrictMode double-invokes effects in dev: placeholder has none; feature authors must write idempotent effects (noted in `docs/ui/conventions.md` by SHELL).
- Missing `#root`: main.tsx throws an explicit error that is visible in the webview.
- `check-dist.mjs` false positive from a library string containing `eval(`: the library is evaluated in a review; the script has an allow-list file `scripts/check-dist.allow.json` with `{file, pattern, reason}`; additions need CODEOWNERS approval.

## 11. Acceptance criteria

- [ ] `pnpm --filter @overmind/desktop build` produces `dist/index.html` and passes `check-dist.mjs`.
- [ ] `pnpm --filter @overmind/desktop dev` serves on `127.0.0.1:5173` and not on other interfaces (checked with `lsof` or a connect test to the LAN address).
- [ ] A request with `Host: evil.example` to the dev server is rejected.
- [ ] Given a fixture bundle containing `eval(`, `check-dist.mjs` exits 1.
- [ ] `pnpm typecheck`, `pnpm lint` pass for `apps/desktop`; the render smoke test passes.
- [ ] `index.html` contains exactly one script tag and no external URL (asserted by test).

## 12. Test plan

Vitest + Testing Library: `src/app/App.test.tsx` renders the placeholder (`getByTestId("app-root")`). Node test for `check-dist.mjs` with fixture directories (good and four bad). A test parsing `index.html` for single script tag. Dev-server host test as an integration test using `vite`'s `createServer` on an ephemeral port in `scripts/dev-server.int.test.ts`. Commands: `pnpm --filter @overmind/desktop build`, `pnpm test -- apps/desktop`.

## 13. Parallelization notes

Parallel with OVE_SETUP010, 011, 012. Hotspots: `apps/desktop/package.json` (shared with OVE_SETUP010 and TEST tasks, edits are additive and rebasing is trivial), `vite.config.ts` (owned here; features must not edit it, they use `import.meta.glob` discovery). `src/app/App.tsx` is handed over to SHELL.

## 14. Open questions and assumptions

- ASSUMPTION: no CSS framework is chosen; styling comes from `ui-kit` tokens (DS area).
- ASSUMPTION: Safari 18 as WebKit baseline (macOS 26 ships newer); lower target not needed.
- Open question: whether to use `rolldown`-specific features of Vite 8; default no.
