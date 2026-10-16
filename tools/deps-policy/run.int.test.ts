import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { expect, it } from "vitest";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";
import { readRenovateConfig, readWorkspaceText } from "./input.parse-boundary.ts";

const root = resolve(import.meta.dirname, "../..");
function fixture() {
  const directory = mkdtempSync(resolve(tmpdir(), "overmind-deps-policy-"));
  for (const path of [
    "package.json",
    "pnpm-workspace.yaml",
    ".npmrc",
    ".nvmrc",
    "renovate.json",
    "docs/dependencies.md",
    "tools/package.json",
    "tools/pinned-bin/lock.json",
    "tools/secret-scan/gitleaks.lock.json",
    "tools/secret-scan/syft.lock.json",
    "tools/check-licenses/allowlist.json",
    "tools/check-licenses/exceptions.json",
    "node_modules/typescript/package.json",
    "node_modules/typescript-eslint/package.json",
  ]) {
    mkdirSync(dirname(resolve(directory, path)), { recursive: true });
    copyFileSync(resolve(root, path), resolve(directory, path));
  }
  return directory;
}
function run(directory: string) {
  return spawnSync(
    resolve(root, "node_modules/.bin/tsx"),
    [resolve(root, "tools/deps-policy/run.ts")],
    {
      cwd: directory,
      encoding: "utf8",
      env: isolatedGitEnvironment(),
      timeout: 15000,
    },
  );
}
it("actual CLI accepts the register/catalog tree, rejects non-catalog dependencies and never echoes an invalid URL pin", () => {
  const directory = fixture();
  try {
    expect(run(directory).status).toBe(0);
    const packagePath = resolve(directory, "package.json");
    // Deliberate fixture edit only; the actual workspace manifest is untouched.
    writeFileSync(
      packagePath,
      readFileSync(packagePath, "utf8").replace('"react": "catalog:"', '"react": "^19"'),
    );
    const invalid = run(directory);
    expect(invalid.status).toBe(1);
    expect(invalid.stdout).toContain("specifier");
    const catalogPath = resolve(directory, "pnpm-workspace.yaml");
    const untrusted = "https://example.invalid/untrusted.tgz";
    writeFileSync(
      catalogPath,
      readFileSync(catalogPath, "utf8").replace('"react": "19.3.0"', `"react": "${untrusted}"`),
    );
    const unsafe = run(directory);
    expect(unsafe.status).toBe(1);
    expect(unsafe.stdout).toContain("INVALID");
    expect(unsafe.stdout + unsafe.stderr).not.toContain(untrusted);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 60000);
it("rejects unsafe inputs and policy changes before any dependency/network execution", () => {
  const directory = fixture();
  const outside = mkdtempSync(resolve(tmpdir(), "overmind-deps-outside-"));
  try {
    writeFileSync(resolve(outside, "private.txt"), "outside fixture must not be read");
    symlinkSync(resolve(outside, "private.txt"), resolve(directory, "outside-link"));
    expect(() => readWorkspaceText(directory, "outside-link")).toThrow("inside the workspace");
    expect(() => readWorkspaceText(directory, "../outside")).toThrow();
    const original = readFileSync(resolve(directory, "renovate.json"), "utf8");
    for (const fragment of [
      '{"automerge": true}',
      '{"minimumReleaseAge": "0 days"}',
      '{"ignoreScripts": false}',
    ]) {
      const altered = original.replace('"packageRules": [', `"packageRules": [${fragment},`);
      writeFileSync(resolve(directory, "renovate.json"), altered);
      expect(() => readRenovateConfig(directory)).toThrow();
    }
    writeFileSync(resolve(directory, "renovate.json"), original);
    writeFileSync(resolve(directory, ".npmrc"), "registry=https://example.invalid/\n");
    expect(run(directory).status).toBe(1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
}, 60000);

it("actual CLI rejects unreviewed build, age, hook and Cargo range bypasses", () => {
  const directory = fixture();
  try {
    const workspacePath = resolve(directory, "pnpm-workspace.yaml");
    const originalWorkspace = readFileSync(workspacePath, "utf8");
    for (const fragment of [
      "permissions: { esbuild: { build: true } }",
      "dangerouslyAllowAllBuilds: true",
      "minimumReleaseAgeExclude: ['*']",
    ]) {
      writeFileSync(workspacePath, originalWorkspace + `\n${fragment}\n`);
      expect(run(directory).status, fragment).toBe(1);
    }
    writeFileSync(workspacePath, originalWorkspace);
    const packagePath = resolve(directory, "package.json");
    const originalPackage = readFileSync(packagePath, "utf8");
    writeFileSync(
      packagePath,
      originalPackage.replace(/^\{/u, '{"pnpm":{"dangerouslyAllowAllBuilds":true},'),
    );
    expect(run(directory).status).toBe(1);
    writeFileSync(packagePath, originalPackage);
    for (const fragment of ["dangerously-allow-all-builds=true", "minimum-release-age=0"]) {
      writeFileSync(resolve(directory, ".npmrc"), `engine-strict=true\n${fragment}\n`);
      expect(run(directory).status, fragment).toBe(1);
    }
    writeFileSync(resolve(directory, ".npmrc"), "engine-strict=true\n");
    const hookPath = resolve(directory, ".pnpmfile.mjs");
    writeFileSync(hookPath, 'throw new Error("must never execute");\n');
    const hook = run(directory);
    expect(hook.status).toBe(1);
    expect(hook.stderr).toContain("Unreviewed pnpm hooks");
    expect(hook.stderr).not.toContain("must never execute");
    rmSync(hookPath);
    for (const version of ['"2.12.3"', '{ version = "2.12.3" }']) {
      writeFileSync(resolve(directory, "Cargo.toml"), `[dependencies]\ntauri = ${version}\n`);
      expect(run(directory).status, version).toBe(1);
    }
    writeFileSync(resolve(directory, "Cargo.toml"), '[dependencies]\ntauri = "=2.12.3"\n');
    expect(run(directory).status).toBe(0);
    writeFileSync(
      resolve(directory, "Cargo.toml"),
      '[workspace.dependencies]\ntauri = "=2.12.3"\n[dependencies]\ntauri = "=2.13.0"\n',
    );
    const conflicting = run(directory);
    expect(conflicting.status).toBe(1);
    expect(conflicting.stderr).toContain("one consistent exact pin");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 60000);

it("actual CLI rejects non-registry overrides even with a complete justification", () => {
  const directory = fixture();
  try {
    const packagePath = resolve(directory, "package.json");
    const original = readFileSync(packagePath, "utf8");
    const registerPath = resolve(directory, "docs/dependencies.md");
    const register = readFileSync(registerPath, "utf8").replace(
      "### react\n",
      "### react\n\n- Justifies: pnpm.overrides.react\n",
    );
    writeFileSync(registerPath, register);
    const setOverride = (target: string) => {
      writeFileSync(
        packagePath,
        original.replace(/^\{/u, `{"pnpm":{"overrides":{"react":${JSON.stringify(target)}}},`),
      );
    };
    setOverride("19.3.0");
    expect(run(directory).status).toBe(0);
    for (const target of [
      "https://example.invalid/react.tgz",
      "git+https://example.invalid/react",
      "file:../outside",
      "npm:alternate@19.3.0",
      "^19.3.0",
    ]) {
      setOverride(target);
      const invalid = run(directory);
      expect(invalid.status, target).toBe(1);
      expect(invalid.stderr).toContain("Overrides require exact registry versions");
    }
    writeFileSync(
      registerPath,
      register.replace("pnpm.overrides.react", "pnpm.patchedDependencies.react@19.3.0"),
    );
    const setPatch = (path: string) => {
      writeFileSync(
        packagePath,
        original.replace(
          /^\{/u,
          `{"pnpm":{"patchedDependencies":{"react@19.3.0":${JSON.stringify(path)}}},`,
        ),
      );
    };
    writeFileSync(resolve(directory, "reviewed.patch"), "reviewed fixture patch\n");
    setPatch("reviewed.patch");
    expect(run(directory).status).toBe(0);
    setPatch("../outside.patch");
    const patch = run(directory);
    expect(patch.status).toBe(1);
    expect(patch.stderr).toContain("Dependency patches must be reviewed workspace files");
    symlinkSync("reviewed.patch", resolve(directory, "linked.patch"));
    setPatch("linked.patch");
    const linked = run(directory);
    expect(linked.status).toBe(1);
    expect(linked.stderr).toContain("Dependency patches cannot use symlinks");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 60000);
