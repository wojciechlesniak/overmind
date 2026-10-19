// SPDX-License-Identifier: Apache-2.0
import { afterAll, describe, it } from "vitest";
import { RuleTester } from "eslint";
import { parser } from "typescript-eslint";
import { resolve } from "node:path";
import { loadCatalog } from "../../tools/boundaries/policy.parse-boundary.ts";
import { createWorkspace } from "../../tools/boundaries-fixtures/workspace.ts";
RuleTester.describe = describe;
RuleTester.it = it;
const fixture = createWorkspace();
afterAll(() => {
  fixture.cleanup();
});
const catalog = loadCatalog(resolve(import.meta.dirname, "../.."));
fixture.write("docs/architecture/boundaries.json", JSON.stringify(catalog));
for (const pkg of catalog.packages.filter(
  (entry) =>
    entry.path.startsWith("packages/") ||
    ["tools", "apps/engine", "apps/desktop"].includes(entry.id),
)) {
  fixture.write(
    pkg.path + "/package.json",
    JSON.stringify({
      name: "@overmind/" + pkg.id.replace("adapters/", "adapter-").replace("apps/", ""),
      exports: { ".": "./src/index.ts", "./ports": "./src/ports/index.ts" },
    }),
  );
  fixture.write(pkg.path + "/src/index.ts", "export {};\n");
  fixture.write(pkg.path + "/src/ports/index.ts", "export {};\n");
  fixture.write(pkg.path + "/src/private.ts", "export {};\n");
  fixture.write(pkg.path + "/test-support/helper.ts", "export {};\n");
}
fixture.write(
  "packages/unknown/package.json",
  JSON.stringify({ name: "@overmind/unknown", exports: "./src/index.ts" }),
);
fixture.write("packages/unknown/src/index.ts", "export {};\n");
fixture.write("apps/desktop/src/features/alpha/peer.ts", "export {};\n");
fixture.write("apps/desktop/src/features/alphabet/peer.ts", "export {};\n");
fixture.write("apps/desktop/src/shared/helper.ts", "export {};\n");
fixture.write(
  "tsconfig.json",
  JSON.stringify({
    compilerOptions: {
      paths: {
        "@application": ["./packages/application/src/index.ts"],
        "@private": ["./packages/domain/src/private.ts"],
        "@support": ["./packages/domain/test-support/helper.ts"],
        "@peer": ["./apps/desktop/src/features/alpha/peer.ts"],
      },
    },
  }),
);
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
