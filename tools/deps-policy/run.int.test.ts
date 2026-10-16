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
