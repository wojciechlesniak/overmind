// SPDX-License-Identifier: Apache-2.0
import { afterAll, describe, it, expect } from "vitest";
import { RuleTester, Linter } from "eslint";
import { parser } from "typescript-eslint";
import { resolve } from "node:path";
import { loadCatalog } from "../../tools/boundaries/policy.parse-boundary.ts";
import { createWorkspace } from "../../tools/boundaries-fixtures/workspace.ts";
import { allowedImports } from "./allowed-imports.ts";
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
}
fixture.write(
  "tsconfig.json",
  JSON.stringify({
    compilerOptions: {
      paths: {
        "@application": ["./packages/application/src/index.ts"],
        "@peer": ["./apps/desktop/src/features/alpha/peer.ts"],
      },
    },
  }),
);
function file(code: string) {
  return { code, filename: fixture.write("packages/domain/src/fixture.ts", code) };
}
new RuleTester({ languageOptions: { parser } }).run(
  "allowedImports",
  allowedImports(fixture.root),
  {
    valid: [file('import "@overmind/contracts";')],
    invalid: [
      {
        ...file('import "@overmind/application";'),
        errors: [{ messageId: "BOUNDARY_FORBIDDEN_IMPORT", line: 1, column: 1 }],
      },
      {
        ...file('import type { X } from "@application";'),
        errors: [{ messageId: "BOUNDARY_FORBIDDEN_IMPORT", line: 1, column: 1 }],
      },
    ],
  },
);

fixture.write(
  "packages/unknown/package.json",
  JSON.stringify({ name: "@overmind/unknown", exports: "./src/index.ts" }),
);
fixture.write("packages/unknown/src/index.ts", "export {};\n");
fixture.write("apps/desktop/src/features/alpha/peer.ts", "export {};\n");
fixture.write("apps/desktop/src/features/alphabet/peer.ts", "export {};\n");
fixture.write("apps/desktop/src/shared/helper.ts", "export {};\n");
function at(code: string, path: string) {
  return { code, filename: fixture.write(path, code) };
}
new RuleTester({ languageOptions: { parser } }).run(
  "allowedImports diagnostics and precedence",
  allowedImports(fixture.root),
  {
    valid: [
      at('import "@overmind/domain";', "tools/check.ts"),
      at('import "@overmind/application/ports";', "packages/adapters/sqlite/src/valid.ts"),
      at('export type { X } from "@overmind/domain";', "packages/contracts/src/valid.test.ts"),
      at('import "./private.ts";', "packages/domain/src/same.ts"),
      at('import "@overmind/domain/src/private.ts";', "packages/application/src/deep.ts"),
      at('import "@overmind/adapter-herdr";', "packages/adapters/sqlite/src/cross.ts"),
      at('import "@overmind/testing";', "packages/domain/src/testing.ts"),
      at('import "./peer.ts";', "apps/desktop/src/features/alpha/self.ts"),
      at('import "../../shared/helper.ts";', "apps/desktop/src/features/alpha/shared.ts"),
      at('import "node:fs";', "packages/domain/src/builtin.ts"),
    ],
    invalid: [
      {
        ...file("import(name);"),
        errors: [{ messageId: "BOUNDARY_DYNAMIC_IMPORT", line: 1, column: 1 }],
      },
      {
        ...file("require(name);"),
        errors: [{ messageId: "BOUNDARY_DYNAMIC_IMPORT", line: 1, column: 1 }],
      },
      {
        ...file('import "@overmind/unknown";'),
        errors: [{ messageId: "BOUNDARY_UNKNOWN_PACKAGE", line: 1, column: 1 }],
      },
      {
        ...file('import "@overmind/absent";'),
        errors: [{ messageId: "BOUNDARY_UNKNOWN_PACKAGE", line: 1, column: 1 }],
      },
      {
        ...file('import "./missing.ts";'),
        errors: [{ messageId: "BOUNDARY_UNRESOLVED_IMPORT", line: 1, column: 1 }],
      },
      {
        ...file('export * from "../src/../../application/src/index.ts";'),
        errors: [{ messageId: "BOUNDARY_FORBIDDEN_IMPORT", line: 1, column: 1 }],
      },
      {
        ...at('import "@overmind/application";', "packages/adapters/sqlite/src/root.ts"),
        errors: [{ messageId: "BOUNDARY_FORBIDDEN_IMPORT", line: 1, column: 1 }],
      },
      {
        ...at('import "@overmind/engine";', "tools/app.ts"),
        errors: [{ messageId: "BOUNDARY_FORBIDDEN_IMPORT", line: 1, column: 1 }],
      },
      {
        ...at('import "../alphabet/peer.ts";', "apps/desktop/src/features/alpha/cross.ts"),
        errors: [{ messageId: "BOUNDARY_FEATURE_CROSS_IMPORT", line: 1, column: 1 }],
      },
      {
        ...at('export type { X } from "@peer";', "apps/desktop/src/features/alphabet/alias.ts"),
        errors: [{ messageId: "BOUNDARY_FEATURE_CROSS_IMPORT", line: 1, column: 1 }],
      },
    ],
  },
);

import { noDeepImports } from "./no-deep-imports.ts";
import { testOnly } from "./test-only.ts";
import { noCrossAdapter } from "./no-cross-adapter.ts";
const rules = {
  "allowed-imports": allowedImports(fixture.root),
  "no-deep-imports": noDeepImports(fixture.root),
  "test-only": testOnly(fixture.root),
  "no-cross-adapter": noCrossAdapter(fixture.root),
};
for (const [code, path, rule, messageId] of [
  [
    'import "@overmind/unknown";',
    "packages/domain/src/unknown.ts",
    "allowed-imports",
    "BOUNDARY_UNKNOWN_PACKAGE",
  ],
  [
    'import "@overmind/domain/src/private.ts";',
    "packages/application/src/private.ts",
    "no-deep-imports",
    "BOUNDARY_DEEP_IMPORT",
  ],
  [
    'import "@overmind/testing/src/private.ts";',
    "packages/domain/src/testing-private.ts",
    "test-only",
    "BOUNDARY_TEST_ONLY",
  ],
  [
    'import "@overmind/adapter-herdr/src/private.ts";',
    "packages/adapters/sqlite/src/peer-private.ts",
    "no-cross-adapter",
    "BOUNDARY_CROSS_ADAPTER",
  ],
  [
    'import "@overmind/application";',
    "packages/domain/src/matrix.ts",
    "allowed-imports",
    "BOUNDARY_FORBIDDEN_IMPORT",
  ],
  [
    '/* eslint-disable */\nimport "@overmind/application";',
    "packages/domain/src/no-inline.ts",
    "allowed-imports",
    "BOUNDARY_FORBIDDEN_IMPORT",
  ],
  [
    'import "@overmind/adapter-herdr/src/private.ts";',
    "packages/adapters/sqlite/test/nominal-private.ts",
    "no-deep-imports",
    "BOUNDARY_DEEP_IMPORT",
  ],
  [
    'import type { X } from "@overmind/adapter-herdr/src/private.ts";',
    "packages/adapters/sqlite/test/nominal-type-private.ts",
    "no-deep-imports",
    "BOUNDARY_DEEP_IMPORT",
  ],
  [
    'export * from "@overmind/adapter-herdr/src/private.ts";',
    "packages/adapters/sqlite/test/nominal-reexport-private.ts",
    "no-deep-imports",
    "BOUNDARY_DEEP_IMPORT",
  ],
  [
    'import "../../herdr/src/private.ts";',
    "packages/adapters/sqlite/test/relative-private.ts",
    "no-deep-imports",
    "BOUNDARY_DEEP_IMPORT",
  ],
] as const) {
  it("combined rules emit only their owning diagnostic: " + path, () => {
    const { filename } = at(code, path);
    const messages = new Linter({ cwd: fixture.root }).verify(
      code,
      [
        {
          files: ["**/*.ts"],
          languageOptions: { parser },
          plugins: { boundaries: { rules } },
          rules: Object.fromEntries(
            Object.keys(rules).map((name) => ["boundaries/" + name, "error"]),
          ),
        },
      ],
      { filename, allowInlineConfig: false },
    );
    expect(
      messages.map(({ ruleId, messageId: id, line, column }) => ({
        ruleId,
        messageId: id,
        line,
        column,
      })),
    ).toEqual([
      { ruleId: "boundaries/" + rule, messageId, line: code.startsWith("/*") ? 2 : 1, column: 1 },
    ]);
  });
}
