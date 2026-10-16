import process from "node:process";
import { readFileSync, readdirSync, lstatSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
const desktop = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(process.argv[2] ?? resolve(desktop, "src-tauri"));
const fail = (message) => {
  throw new Error(`Tauri policy: ${message}`);
};
const read = (path) => {
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 1024 * 1024) {
    fail("invalid policy file");
  }
  return readFileSync(path, "utf8");
};
const json = (path) => JSON.parse(read(path));
const same = (actual, expected, name) => {
  if (!isDeepStrictEqual(actual, expected)) {
    fail(`${name}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
};
const forbidden = (value) => {
  if (Array.isArray(value)) {
    value.forEach(forbidden);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (["remote", "dangerousRemoteDomainIpcAccess", "updater"].includes(key)) {
        fail(`forbidden ${key}`);
      }
      forbidden(item);
    }
  }
};
const csp =
  "default-src 'none'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src ipc: http://ipc.localhost; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; frame-src 'none'; worker-src 'self'";
const devCsp = csp
  .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
  .replace(
    "connect-src ipc: http://ipc.localhost",
    "connect-src ipc: http://ipc.localhost ws://127.0.0.1:5173 http://127.0.0.1:5173",
  );
const permissions = [
  "core:event:allow-listen",
  "core:event:allow-unlisten",
  "allow-gateway-request",
  "allow-gateway-subscribe",
  "allow-pick-directory",
];
same(
  json(resolve(desktop, "scripts/tauri-permission-allowlist.json")),
  permissions,
  "permission allow-list",
);
// Tauri merges platform overrides before compiling; an unchecked override could
// replace the pinned CSP or window URL after this guard accepts the base config.
for (const name of readdirSync(root)) {
  if (
    name !== "tauri.conf.json" &&
    /^(?:tauri(?:\..+)?\.conf\.(?:json|json5)|Tauri(?:\..+)?\.toml)$/iu.test(name)
  ) {
    fail("alternate or platform configuration is not approved");
  }
}
const config = json(resolve(root, "tauri.conf.json"));
forbidden(config);
const security = config.app?.security;
same(security?.csp, csp, "production CSP");
same(security?.devCsp, devCsp, "development CSP");
same(security?.capabilities, ["main"], "enabled capabilities");
same(security?.freezePrototype, true, "prototype protection");
same(security?.dangerousDisableAssetCspModification, false, "CSP injection");
same(security?.assetProtocol, { enable: false }, "asset protocol");
same(config.app?.macOSPrivateApi, false, "private macOS API");
same(
  config.app?.windows,
  [
    {
      label: "main",
      title: "Overmind",
      url: "index.html",
      create: false,
      width: 1440,
      height: 900,
      minWidth: 1024,
      minHeight: 680,
      resizable: true,
      visible: true,
      devtools: false,
    },
  ],
  "window",
);
same(
  config.build,
  {
    beforeDevCommand: "pnpm --filter @overmind/desktop dev",
    devUrl: "http://127.0.0.1:5173",
    beforeBuildCommand: "pnpm --filter @overmind/desktop build",
    frontendDist: "../dist",
  },
  "build inputs",
);
same(config.identifier, "dev.overmind.app", "application identifier");
same(config.version, "../package.json", "application version");
same(config.bundle?.externalBin, ["binaries/overmind-engine"], "sidecar");
same(config.bundle?.targets, ["app", "dmg"], "bundle targets");
same(
  config.bundle?.macOS,
  { minimumSystemVersion: "26.0", hardenedRuntime: true },
  "macOS requirements",
);
same(readdirSync(resolve(root, "capabilities")).sort(), ["main.json"], "capability files");
const capability = json(resolve(root, "capabilities/main.json"));
forbidden(capability);
same(capability.identifier, "main", "capability identifier");
same(capability.windows, ["main"], "capability windows");
same(capability.permissions, permissions, "capability permissions");
if (capability.webviews || capability.platforms || capability.local === false) {
  fail("capability scope");
}
const sources = [
  "engine.rs",
  "gateway_bridge.rs",
  "lib.rs",
  "main.rs",
  "native_io.rs",
  "pick_directory.rs",
  "sidecar.rs",
  "transport.rs",
];
same(readdirSync(resolve(root, "src")).sort(), sources, "Rust source allow-list");
for (const name of sources) {
  const source = read(resolve(root, "src", name));
  if (source.trimEnd().split("\n").length >= 200) {
    fail(`${name} must have fewer than 200 lines`);
  }
  if (/\b(?:eprintln|println)!/u.test(source)) {
    fail(`${name} must use the private structured logger`);
  }
  if (["lib.rs", "main.rs"].includes(name) && !source.startsWith("#![forbid(unsafe_code)]")) {
    fail(`${name} unsafe policy`);
  }
}
if (/tauri-plugin-updater/u.test(read(resolve(root, "Cargo.toml")))) {
  fail("updater dependency");
}
process.stdout.write("Tauri configuration, capabilities and Rust source policy passed\n");
