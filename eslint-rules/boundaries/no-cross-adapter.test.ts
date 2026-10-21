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
let serial = 0;
function file(code: string, folder = "packages/domain/src", suffix = ".ts") {
  return { code, filename: fixture.write(folder + "/case" + String(serial++) + suffix, code) };
}
import { noCrossAdapter } from "./no-cross-adapter.ts";
new RuleTester({ languageOptions: { parser } }).run(
  "noCrossAdapter",
  noCrossAdapter(fixture.root),
  {
    valid: [
      file('import "@overmind/adapter-sqlite";', "packages/adapters/sqlite/src"),
      file('import "@overmind/application/ports";', "packages/adapters/sqlite/src"),
      file('import "@overmind/adapter-herdr";', "packages/adapters/sqlite/test"),
      file('import "@overmind/adapter-herdr";', "tools"),
    ],
    invalid: [
      {
        ...file('import "@overmind/adapter-herdr";', "packages/adapters/sqlite/src"),
        errors: [{ messageId: "BOUNDARY_CROSS_ADAPTER", line: 1, column: 1 }],
      },
      {
        ...file(
          'export type { X } from "../../herdr/src/index.ts";',
          "packages/adapters/sqlite/src",
        ),
        errors: [{ messageId: "BOUNDARY_CROSS_ADAPTER", line: 1, column: 1 }],
      },
      {
        ...file(
          'export * from "@overmind/adapter-herdr";',
          "packages/adapters/sqlite/test-support",
        ),
        errors: [{ messageId: "BOUNDARY_CROSS_ADAPTER", line: 1, column: 1 }],
      },
    ],
  },
);
