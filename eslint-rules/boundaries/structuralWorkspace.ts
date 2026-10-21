// SPDX-License-Identifier: Apache-2.0
import { resolve } from "node:path";
import { loadCatalog } from "../../tools/boundaries/policy.parse-boundary.ts";
import {
  createWorkspace,
  type FixtureWorkspace,
} from "../../tools/boundaries-fixtures/workspace.ts";

/** Test-only public/private entries shared by the structural rule suites. */
export function structuralWorkspace(): FixtureWorkspace {
  const fixture = createWorkspace();
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
  return fixture;
}
