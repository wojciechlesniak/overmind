import { spawnSync } from "node:child_process";
import { cpSync, symlinkSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { expect, it } from "vitest";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";
const source = resolve(import.meta.dirname, "../..");
it("partial shards pass collection but merged coverage fails on untested domain code", () => {
  const root = mkdtempSync(join(tmpdir(), "overmind-coverage-merge-"));
  const reports = resolve(root, "reports");
  const run = (args: string[]) =>
    spawnSync(resolve(source, "node_modules/.bin/vitest"), args, {
      cwd: root,
      encoding: "utf8",
      env: isolatedGitEnvironment(),
      timeout: 15000,
    });
  try {
    // Copy the actual configuration into an isolated project so concurrent
    // negative probes cannot contaminate this test or its parent's coverage.
    for (const directory of [
      "tools",
      "apps/engine",
      "packages/application",
      "packages/api-client",
      "packages/workflow-runtime",
      "packages/adapters/keychain-macos",
      "apps/desktop",
      "packages/adapters/sqlite",
      "packages/adapters/notifications-macos",
      "packages/domain",
      "packages/gateway",
      "packages/ui-kit",
      "packages/adapters/sandbox-macos",
      "packages/adapters/telegram",
      "packages/adapters/providers",
      "packages/adapters/herdr",
      "packages/contracts",
      "packages/adapters/system",
      "eslint-rules/boundaries",
      "packages/domain/src",
      "tools/vitest-projects",
      "tools/boundaries",
      "tools/vitest-setup",
      "reports/blobs",
    ]) {
      mkdirSync(resolve(root, directory), { recursive: true });
    }
    for (const file of [
      "package.json",
      "tsconfig.base.json",
      "vitest.config.ts",
      "vitest.ci.config.ts",
      "vitest.shared.ts",
      "tools/vitest.config.ts",
      "eslint-rules/boundaries/vitest.config.ts",
      "apps/engine/vitest.config.ts",
      "packages/application/vitest.config.ts",
      "packages/api-client/vitest.config.ts",
      "packages/workflow-runtime/vitest.config.ts",
      "packages/adapters/keychain-macos/vitest.config.ts",
      "apps/desktop/vitest.config.ts",
      "packages/adapters/sqlite/vitest.config.ts",
      "packages/adapters/notifications-macos/vitest.config.ts",
      "packages/domain/vitest.config.ts",
      "packages/gateway/vitest.config.ts",
      "packages/ui-kit/vitest.config.ts",
      "packages/adapters/sandbox-macos/vitest.config.ts",
      "packages/adapters/telegram/vitest.config.ts",
      "packages/adapters/providers/vitest.config.ts",
      "packages/adapters/herdr/vitest.config.ts",
      "packages/contracts/vitest.config.ts",
      "packages/adapters/system/vitest.config.ts",
      "tools/package.json",
      "apps/engine/package.json",
      "packages/application/package.json",
      "packages/api-client/package.json",
      "packages/workflow-runtime/package.json",
      "packages/adapters/keychain-macos/package.json",
      "apps/desktop/package.json",
      "packages/adapters/sqlite/package.json",
      "packages/adapters/notifications-macos/package.json",
      "packages/domain/package.json",
      "packages/gateway/package.json",
      "packages/ui-kit/package.json",
      "packages/adapters/sandbox-macos/package.json",
      "packages/adapters/telegram/package.json",
      "packages/adapters/providers/package.json",
      "packages/adapters/herdr/package.json",
      "packages/contracts/package.json",
      "packages/adapters/system/package.json",
      "tools/vitest-projects/discovery.ts",
      "tools/vitest-projects/coverage.ts",
      "tools/boundaries/policy.parse-boundary.ts",
      "packages/domain/src/index.ts",
      "packages/domain/src/index.test.ts",
      "tools/vitest-setup/setup-node.ts",
      "tools/vitest-setup/setup-dom.ts",
    ]) {
      cpSync(resolve(source, file), resolve(root, file));
    }
    symlinkSync(resolve(source, "node_modules"), resolve(root, "node_modules"), "dir");
    for (let index = 0; index < 4; index++) {
      const name = `probe-${String(index)}`;
      writeFileSync(
        resolve(root, "packages/domain/src", `${name}.ts`),
        "export function probe(): number { return 42; }\n",
      );
      if (index < 3) {
        writeFileSync(
          resolve(root, "packages/domain/src", `${name}.test.ts`),
          `import {it,expect} from "vitest"; import {probe} from "./${name}.ts"; it("covers probe",()=>{expect(probe()).toBe(42);});\n`,
        );
      }
    }
    for (let shard = 1; shard <= 3; shard++) {
      const result = run([
        "run",
        "--config",
        "vitest.ci.config.ts",
        "--project",
        "domain",
        "--coverage",
        `--coverage.reportsDirectory=${resolve(reports, `coverage-${String(shard)}`)}`,
        `--shard=${String(shard)}/3`,
        "--reporter=blob",
        `--outputFile.blob=${resolve(reports, "blobs", `blob-${String(shard)}.json`)}`,
      ]);
      expect(result.status, result.stdout + result.stderr).toBe(0);
    }
    const merged = run([
      "run",
      "--project",
      "domain",
      "--coverage",
      `--merge-reports=${resolve(reports, "blobs")}`,
      `--coverage.reportsDirectory=${resolve(reports, "merged")}`,
    ]);
    expect(merged.status).not.toBe(0);
    expect(merged.stdout + merged.stderr).toContain("Coverage for");
    expect(merged.stdout + merged.stderr).toContain("packages/domain/src/**");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 60000);
