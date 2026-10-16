import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { test } from "vitest";
import { readManifest, readWorkspace } from "./test-support/json.parse-boundary.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const readJson = (path: string) => readManifest(resolve(root, path));
const rootManifest = readJson("package.json");
const workspace = readWorkspace(resolve(root, "pnpm-workspace.yaml"));
const rootScripts = rootManifest.scripts ?? {};
const adapterNames = [
  "sqlite",
  "herdr",
  "sandbox-macos",
  "providers",
  "telegram",
  "keychain-macos",
  "notifications-macos",
];
const expectedEdges: Record<string, string[]> = {
  contracts: [],
  domain: ["contracts"],
  application: ["contracts", "domain"],
  "workflow-runtime": ["application", "contracts", "domain"],
  gateway: ["application", "contracts"],
  "api-client": ["contracts"],
  "ui-kit": [],
  desktop: ["api-client", "contracts", "ui-kit"],
  tools: [],
};
for (const name of adapterNames) {
  expectedEdges[`adapter-${name}`] = ["application", "contracts", "domain"];
}
expectedEdges["engine"] = Object.keys(expectedEdges).filter(
  (name) => !["desktop", "tools"].includes(name),
);

function collectManifests(directory = root): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", ".git", "tasks", "docs"].includes(entry.name)) {
      return [];
    }
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return collectManifests(path);
    }
    return entry.name === "package.json" && directory !== root ? [relative(root, path)] : [];
  });
}
const manifestPaths = collectManifests();

test("all 17 packages encode exactly the required Clean Architecture graph", () => {
  assert.equal(manifestPaths.length, 17);
  const names = manifestPaths.map((path) => readJson(path).name.replace("@overmind/", "")).sort();
  assert.deepEqual(names, Object.keys(expectedEdges).sort());
  for (const path of manifestPaths) {
    const manifest = readJson(path);
    const name = manifest.name.replace("@overmind/", "");
    assert.deepEqual(
      Object.keys(manifest.dependencies ?? {})
        .filter((key) => key.startsWith("@overmind/"))
        .map((key) => key.replace("@overmind/", ""))
        .sort(),
      expectedEdges[name]?.toSorted(),
      name,
    );
    assert.ok(
      Object.entries(manifest.dependencies ?? {}).every(
        ([key, value]) => value === (key.startsWith("@overmind/") ? "workspace:*" : "catalog:"),
      ),
      name,
    );
    assert.equal(manifest.main, undefined);
    assert.deepEqual(manifest.exports, { ".": "./src/index.ts" });
    if (path.startsWith("packages/")) {
      assert.equal(manifest.sideEffects, false);
    }
    const source = readFileSync(resolve(root, path, "../src/index.ts"), "utf8");
    assert.match(
      source,
      /^\/\/ PLACEHOLDER\(OVE_[A-Z]+\d{3}\): replaced wholesale by the owner task\.\nexport \{\};\n$/,
    );
  }
});

test("every manifest is private ESM under Apache-2.0 and every external dependency uses the catalog", () => {
  for (const path of ["package.json", ...manifestPaths]) {
    const manifest = readJson(path);
    assert.equal(manifest.private, true, path);
    assert.equal(manifest.type, "module", path);
    assert.equal(manifest.version, "0.0.0", path);
    assert.equal(manifest.license, "Apache-2.0", path);
    for (const field of ["dependencies", "devDependencies", "optionalDependencies"] as const) {
      for (const [name, version] of Object.entries(manifest[field] ?? {})) {
        assert.equal(
          version,
          name.startsWith("@overmind/") ? "workspace:*" : "catalog:",
          `${path}: ${name}`,
        );
      }
    }
  }
  assert.equal(rootManifest.dependencies, undefined);
});

test("all reserved scripts exist and future tool implementations are not fabricated", () => {
  const scripts =
    "dev dev:tauri build typecheck lint lint:fix format format:check test test:watch test:coverage test:e2e test:visual test:escape storybook build:storybook check:boundaries check:licenses check:deps check:tasks check:owns check:docs check:headers check:contracts gen:contracts gen:task-index task:claim task:finish task:status task:next audit sbom package:engine check prepare".split(
      " ",
    );
  for (const script of scripts) {
    assert.ok(rootScripts[script], script);
  }
  assert.equal(rootScripts["typecheck"], "tsc -b && tsc --noEmit -p tsconfig.tests.json");
  assert.equal(rootScripts["test"], "vitest run");
  assert.equal(rootScripts["audit"], "pnpm audit --audit-level=high --prod");
  assert.ok(!readdirSync(resolve(root, "tools")).includes("dev"));
});

test("runtime, package manager integrity and catalog versions are pinned", () => {
  assert.equal(readFileSync(resolve(root, ".nvmrc"), "utf8"), "22.23.3\n");
  assert.deepEqual(rootManifest.engines, { node: ">=22.22.2 <23", pnpm: ">=12.11.2 <13" });
  assert.match(rootManifest.packageManager ?? "", /^pnpm@12\.11\.2\+sha512\.[a-f0-9]{128}$/);
  const entries = Object.entries(workspace.catalog);
  assert.ok(entries.length >= 39);
  for (const [name, version] of entries) {
    assert.match(version, /^\d+\.\d+\.\d+$/, name);
  }
  assert.equal(workspace.catalog["typescript"], "6.0.3");
});

test("supply-chain settings reject unknown builds, peer conflicts and unsupported runtimes", () => {
  assert.equal(workspace.minimumReleaseAge, 4320);
  for (const enabled of [
    workspace.strictDepBuilds,
    workspace.engineStrict,
    workspace.strictPeerDependencies,
  ]) {
    assert.equal(enabled, true);
  }
  for (const disabled of [
    workspace.autoInstallPeers,
    workspace.linkWorkspacePackages,
    workspace.shamefullyHoist,
  ]) {
    assert.equal(disabled, false);
  }
  assert.equal(workspace.savePrefix, "");
  assert.equal(workspace.verifyDepsBeforeRun, "error");
  assert.equal(workspace.allowBuilds["esbuild"], false);
  assert.equal(workspace.allowBuilds["lefthook"], false);
  assert.ok(Object.values(workspace.allowBuilds).every((allowed) => !allowed));
  assert.equal(readFileSync(resolve(root, ".npmrc"), "utf8"), "engine-strict=true\n");
});

test("Git excludes credentials, generated files and local environment while retaining the lockfile", () => {
  const denied = [
    "foo.p12",
    "foo.p8",
    "foo.pem",
    "foo.key",
    ".env.local",
    "target/test",
    "node_modules/test",
    "dist/test",
    ".DS_Store",
  ];
  const ignored = execFileSync("git", ["check-ignore", "--no-index", ...denied], {
    cwd: root,
    encoding: "utf8",
  })
    .trim()
    .split("\n");
  assert.deepEqual(ignored, denied);
  const visible = execFileSync(
    "git",
    ["check-ignore", "--no-index", "--non-matching", "--verbose", ".env.example", "pnpm-lock.yaml"],
    { cwd: root, encoding: "utf8" },
  );
  assert.match(visible, /!\.env\.example/);
  assert.match(visible, /::\s+pnpm-lock\.yaml/);
  assert.ok(!readFileSync(resolve(root, ".gitattributes"), "utf8").includes("-diff"));
});
