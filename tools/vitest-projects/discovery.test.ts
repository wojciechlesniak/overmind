// SPDX-License-Identifier: Apache-2.0
import {
  cpSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, expect, it } from "vitest";
import { discoverProjects } from "./discovery.ts";
import { packageCoverage } from "./coverage.ts";
import * as systemConfig from "../../packages/adapters/system/vitest.config.ts";
import { spawnSync } from "node:child_process";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";
const configurations = [
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
];
it("admits every configured project exactly once", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ove036-discovery-")));
  try {
    for (const file of configurations) {
      mkdirSync(dirname(resolve(root, file)), { recursive: true });
      writeFileSync(resolve(root, file), "export default {};\n");
    }
    expect(discoverProjects(root).sort()).toEqual(
      configurations.map((file) => resolve(root, file)).sort(),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});
function fixture(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ove036-discovery-case-")));
  roots.push(root);
  for (const file of configurations) {
    mkdirSync(dirname(resolve(root, file)), { recursive: true });
    writeFileSync(resolve(root, file), "export default {};\n");
  }
  return root;
}
const workspaceConfigs = configurations.filter((file) => !file.startsWith("eslint-rules/"));
it.each(workspaceConfigs)(
  "admits relocated configuration %s without omitting its product",
  (file) => {
    const root = fixture();
    const moved = resolve(root, "tools/vitest-projects", file);
    mkdirSync(dirname(moved), { recursive: true });
    renameSync(resolve(root, file), moved);
    const actual = discoverProjects(root);
    expect(actual).toHaveLength(19);
    expect(new Set(actual).size).toBe(19);
    expect(actual).toContain(moved);
    expect(actual).not.toContain(resolve(root, file));
  },
);
it.each(workspaceConfigs)("denies a missing expected project %s", (file) => {
  const root = fixture();
  rmSync(resolve(root, file));
  expect(() => discoverProjects(root)).toThrow("exactly once");
});
it.each(workspaceConfigs)("denies both configurations for %s", (file) => {
  const root = fixture();
  const duplicate = resolve(root, "tools/vitest-projects", file);
  mkdirSync(dirname(duplicate), { recursive: true });
  writeFileSync(duplicate, "export default {};");
  expect(() => discoverProjects(root)).toThrow("exactly once");
});
it.each(["symlink", "hardlink", "directory", "invalid UTF8", "oversized"])(
  "denies unsafe configuration: %s",
  (kind) => {
    const root = fixture();
    const path = resolve(root, "packages/domain/vitest.config.ts");
    rmSync(path);
    if (kind === "symlink") {
      symlinkSync(resolve(root, "tools/vitest.config.ts"), path);
    } else if (kind === "hardlink") {
      linkSync(resolve(root, "tools/vitest.config.ts"), path);
    } else if (kind === "directory") {
      mkdirSync(path);
    } else if (kind === "invalid UTF8") {
      writeFileSync(path, Buffer.from([0xff]));
    } else {
      writeFileSync(path, Buffer.alloc(2 * 1024 * 1024 + 1));
    }
    expect(() => discoverProjects(root)).toThrow();
  },
);
it("denies a relocated directory that escapes through a symlink", () => {
  const root = fixture();
  const outside = fixture();
  rmSync(resolve(root, "packages/domain/vitest.config.ts"));
  const parent = resolve(root, "tools/vitest-projects/packages");
  mkdirSync(parent, { recursive: true });
  symlinkSync(resolve(outside, "packages/domain"), resolve(parent, "domain"), "dir");
  expect(() => discoverProjects(root)).toThrow();
});
it("requires the separate plugin and canonical root", () => {
  const root = fixture();
  const alias = resolve(root, "alias");
  symlinkSync(root, alias, "dir");
  expect(() => discoverProjects(alias)).toThrow("canonical");
  rmSync(resolve(root, "eslint-rules/boundaries/vitest.config.ts"));
  expect(() => discoverProjects(root)).toThrow();
});
const repository = resolve(import.meta.dirname, "../..");
it("preserves all17 original coverage budgets and the real19-project inventory", () => {
  expect(systemConfig).toMatchObject({
    default: {
      root: resolve(repository, "packages/adapters/system"),
      test: { name: "adapter-system", environment: "node" },
    },
    coverageThreshold: { lines: 80, functions: 80, branches: 75, statements: 80 },
  });
  const projects = discoverProjects(repository);
  expect(projects).toHaveLength(19);
  expect(new Set(projects).size).toBe(19);
  expect(packageCoverage(repository).thresholds).toEqual({
    "tools/src/**": {
      lines: 70,
      functions: 70,
      branches: 60,
      statements: 70,
    },
    "apps/engine/src/**": {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
    "packages/application/src/**": {
      lines: 90,
      functions: 90,
      branches: 85,
      statements: 90,
    },
    "packages/api-client/src/**": {
      lines: 70,
      functions: 70,
      branches: 65,
      statements: 70,
    },
    "packages/workflow-runtime/src/**": {
      lines: 90,
      functions: 90,
      branches: 85,
      statements: 90,
    },
    "packages/adapters/keychain-macos/src/**": {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
    "apps/desktop/src/**": {
      lines: 70,
      functions: 70,
      branches: 65,
      statements: 70,
    },
    "packages/adapters/sqlite/src/**": {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
    "packages/adapters/notifications-macos/src/**": {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
    "packages/domain/src/**": {
      lines: 90,
      functions: 90,
      branches: 85,
      statements: 90,
    },
    "packages/gateway/src/**": {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
    "packages/ui-kit/src/**": {
      lines: 70,
      functions: 70,
      branches: 65,
      statements: 70,
    },
    "packages/adapters/sandbox-macos/src/**": {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
    "packages/adapters/telegram/src/**": {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
    "packages/adapters/providers/src/**": {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
    "packages/adapters/herdr/src/**": {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
    "packages/contracts/src/**": {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
    "packages/adapters/system/src/**": {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
  });
  expect(() => packageCoverage(resolve(repository, "packages"))).toThrow("Vitest project root");
});
it("rejects an actual exported wrong root before executing tests", () => {
  const root = fixture();
  const files = [
    "package.json",
    "tsconfig.base.json",
    "vitest.config.ts",
    "vitest.shared.ts",
    "tools/vitest-projects/discovery.ts",
    "tools/vitest-projects/coverage.ts",
    "tools/boundaries/policy.parse-boundary.ts",
    "tools/vitest-setup/setup-node.ts",
    "tools/vitest-setup/setup-dom.ts",
    ...configurations,
  ];
  for (const file of files) {
    mkdirSync(dirname(resolve(root, file)), { recursive: true });
    cpSync(resolve(repository, file), resolve(root, file));
  }
  symlinkSync(resolve(repository, "node_modules"), resolve(root, "node_modules"), "dir");
  const domain = resolve(root, "packages/domain/vitest.config.ts");
  const original =
    'import { defineProject } from "vitest/config";\nimport { sharedConfig, coverageThresholds } from "../../vitest.shared.ts";\nexport const coverageThreshold = coverageThresholds.core;\nconst config = sharedConfig({ name: "domain", environment: "node", root: import.meta.dirname });\nexport default defineProject(config);\n';
  writeFileSync(
    domain,
    original.replace("root: import.meta.dirname", 'root: import.meta.dirname + "/.."'),
  );
  mkdirSync(resolve(root, "packages/domain/src"));
  const marker = resolve(root, "executed");
  writeFileSync(
    resolve(root, "packages/domain/src/sentinel.test.ts"),
    `import {writeFileSync} from "node:fs"; import {it} from "vitest"; it("must not run",()=>writeFileSync(${JSON.stringify(marker)},"bad"));`,
  );
  const result = spawnSync(
    resolve(repository, "node_modules/.bin/vitest"),
    ["run", "--project", "domain"],
    { cwd: root, env: isolatedGitEnvironment(), encoding: "utf8", timeout: 4000 },
  );
  expect(result.status, result.stdout + result.stderr).toBe(1);
  expect(result.stdout + result.stderr).toContain("Vitest project root");
  expect(existsSync(marker)).toBe(false);
});
