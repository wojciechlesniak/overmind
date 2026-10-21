// SPDX-License-Identifier: Apache-2.0
import { afterAll, describe, it } from "vitest";
import { RuleTester } from "eslint";
import { parser } from "typescript-eslint";
import { structuralWorkspace } from "./structuralWorkspace.ts";
RuleTester.describe = describe;
RuleTester.it = it;
const fixture = structuralWorkspace();
afterAll(() => {
  fixture.cleanup();
});
fixture.write(
  "packages/unknown/package.json",
  JSON.stringify({ name: "@overmind/unknown", exports: "./src/index.ts" }),
);
fixture.write("packages/unknown/src/index.ts", "export {};\n");
fixture.write(
  "tsconfig.json",
  JSON.stringify({
    compilerOptions: {
      paths: {
        "@private": ["./packages/domain/src/private.ts"],
      },
    },
  }),
);
let serial = 0;
function file(code: string, folder = "packages/domain/src", suffix = ".ts") {
  return { code, filename: fixture.write(folder + "/case" + String(serial++) + suffix, code) };
}
import { noDeepImports } from "./no-deep-imports.ts";
new RuleTester({ languageOptions: { parser } }).run("noDeepImports", noDeepImports(fixture.root), {
  valid: [
    file('import "@overmind/domain";', "packages/application/src"),
    file('import "@overmind/application/ports";', "packages/adapters/sqlite/src"),
    file('import "./private.ts";', "packages/domain/src"),
    file('import "@overmind/unknown";', "packages/domain/src"),
    file('import "@overmind/adapter-herdr/src/private.ts";', "packages/adapters/sqlite/src"),
    file('import "@overmind/testing/src/private.ts";', "packages/domain/src"),
  ],
  invalid: [
    {
      ...file('import "@overmind/domain/src/private.ts";', "packages/application/src"),
      errors: [{ messageId: "BOUNDARY_DEEP_IMPORT", line: 1, column: 1 }],
    },
    {
      ...file('export * from "../../domain/src/private.ts";', "packages/application/src"),
      errors: [{ messageId: "BOUNDARY_DEEP_IMPORT", line: 1, column: 1 }],
    },
    {
      ...file('import type { X } from "@private";', "packages/application/src"),
      errors: [{ messageId: "BOUNDARY_DEEP_IMPORT", line: 1, column: 1 }],
    },
    {
      ...file('import "@overmind/domain/src/private.ts";', "packages/domain/src"),
      errors: [{ messageId: "BOUNDARY_DEEP_IMPORT", line: 1, column: 1 }],
    },
  ],
});
