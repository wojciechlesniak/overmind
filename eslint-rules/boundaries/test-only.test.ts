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
  "tsconfig.json",
  JSON.stringify({
    compilerOptions: {
      paths: {
        "@support": ["./packages/domain/test-support/helper.ts"],
      },
    },
  }),
);
let serial = 0;
function file(code: string, folder = "packages/domain/src", suffix = ".ts") {
  return { code, filename: fixture.write(folder + "/case" + String(serial++) + suffix, code) };
}
import { testOnly } from "./test-only.ts";
new RuleTester({ languageOptions: { parser } }).run("testOnly", testOnly(fixture.root), {
  valid: [
    file('import "@overmind/testing";', "packages/domain/test"),
    file('import "@overmind/testing";', "packages/adapters/sqlite/test-support"),
    file('import "@overmind/testing";', "tools"),
    file('import "@support";', "packages/domain/test"),
    file('import "@overmind/contracts";', "packages/domain/src"),
  ],
  invalid: [
    {
      ...file('import "@overmind/testing";', "packages/domain/src"),
      errors: [{ messageId: "BOUNDARY_TEST_ONLY", line: 1, column: 1 }],
    },
    {
      ...file('export type { X } from "@overmind/testing";', "packages/application/src"),
      errors: [{ messageId: "BOUNDARY_TEST_ONLY", line: 1, column: 1 }],
    },
    {
      ...file('import "@support";', "packages/application/src"),
      errors: [{ messageId: "BOUNDARY_TEST_ONLY", line: 1, column: 1 }],
    },
    {
      ...file('import "../test-support/helper.ts";', "packages/domain/src"),
      errors: [{ messageId: "BOUNDARY_TEST_ONLY", line: 1, column: 1 }],
    },
  ],
});
