import { defineConfig } from "vitest/config";
import { packageCoverage } from "./vitest.shared.ts";
export default defineConfig({
  test: {
    // Tooling tests launch real compilers and CLIs; bound concurrent file workers.
    maxWorkers: 2,
    projects: [
      "apps/*/vitest.config.ts",
      "packages/*/vitest.config.ts",
      "packages/adapters/*/vitest.config.ts",
      "tools/vitest.config.ts",
    ],
    reporters: ["default"],
    coverage: await packageCoverage(),
  },
});
