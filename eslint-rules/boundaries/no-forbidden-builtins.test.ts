// SPDX-License-Identifier: Apache-2.0
import { afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Linter } from "eslint";
import { parser } from "typescript-eslint";
import { structuralWorkspace } from "./structuralWorkspace.ts";
import { noForbiddenBuiltins } from "./no-forbidden-builtins.ts";
const fixture = structuralWorkspace();
afterAll(() => {
  fixture.cleanup();
});
let counter = 0;
function check(code: string, path = "packages/domain/src") {
  const filename = fixture.write(`${path}/capability-${String(counter++)}.ts`, code);
  return new Linter({ cwd: fixture.root }).verify(
    code,
    [
      {
        files: ["**/*.ts"],
        languageOptions: { parser },
        plugins: { boundaries: { rules: { capability: noForbiddenBuiltins(fixture.root) } } },
        rules: { "boundaries/capability": "error" },
      },
    ],
    { filename, allowInlineConfig: false },
  );
}
describe("OVE_ARCH020: forbidden imported capabilities", () => {
  for (const name of [
    "fs",
    "node:fs",
    "fs/promises",
    "node:fs/promises",
    "child_process",
    "node:net",
    "node:https",
    "worker_threads",
    "node:crypto",
    "node:process",
    "node:dns/promises",
  ]) {
    it(`denies the canonical builtin ${name}`, () => {
      expect(check(`import "${name}";`).map((message) => message.messageId)).toEqual([
        "BOUNDARY_FORBIDDEN_BUILTIN",
      ]);
    });
  }
  for (const code of [
    'export * from "node:fs";',
    'import type { Stats } from "fs";',
    'import X = require("fs");',
    'type X = import("fs");',
    'import("node:fs");',
    'require("fs");',
  ]) {
    it(`denies a capability through the import syntax ${code}`, () => {
      expect(check(code).map((message) => message.messageId)).toEqual([
        "BOUNDARY_FORBIDDEN_BUILTIN",
      ]);
    });
  }
  for (const path of [
    "packages/domain/src/test",
    "packages/domain/test",
    "packages/ui-kit/src",
    "apps/desktop/src",
  ]) {
    it(`keeps builtin denial in ${path}`, () => {
      expect(check('import "node:fs";', path).map((message) => message.messageId)).toEqual([
        "BOUNDARY_FORBIDDEN_BUILTIN",
      ]);
    });
  }
  it("denies every node-prefixed UI import even if unknown to this Node version", () => {
    expect(
      check('import "node:future";', "apps/desktop/src").map((message) => message.messageId),
    ).toEqual(["BOUNDARY_FORBIDDEN_BUILTIN"]);
  });
  for (const path of [
    "apps/desktop/src/features/alpha",
    "apps/desktop/src/shared/platform/tauri-lookalike",
    "packages/ui-kit/src",
    "packages/gateway/src",
  ]) {
    it(`denies Tauri outside the exact bridge in ${path}`, () => {
      expect(
        check('import "@tauri-apps/api/core";', path).map((message) => message.messageId),
      ).toEqual(["BOUNDARY_FORBIDDEN_PACKAGE"]);
    });
  }
  it("allows the exact desktop Tauri bridge subtree", () => {
    expect(
      check('import "@tauri-apps/api/core";', "apps/desktop/src/shared/platform/tauri/nested"),
    ).toEqual([]);
  });
  it("does not grant Node access to the Tauri bridge", () => {
    expect(
      check('import "node:fs";', "apps/desktop/src/shared/platform/tauri").map(
        (message) => message.messageId,
      ),
    ).toEqual(["BOUNDARY_FORBIDDEN_BUILTIN"]);
  });
  it("preserves allowed adapter and tooling builtins", () => {
    expect(check('import "node:fs";', "packages/adapters/system/src")).toEqual([]);
    expect(check('import "node:crypto";', "tools")).toEqual([]);
  });
  it("fails closed when canonical policy is unreadable", () => {
    const policy = readFileSync(resolve(fixture.root, "docs/architecture/boundaries.json"), "utf8");
    try {
      fixture.write("docs/architecture/boundaries.json", "{}");
      expect(() => check('import "node:fs";')).toThrow("Invalid boundary environment.");
    } finally {
      fixture.write("docs/architecture/boundaries.json", policy);
    }
  });
});
