import { defineConfig } from "vitest/config";
import { packageCoverage, coverageThresholds } from "./vitest.shared.ts";
const coverage = await packageCoverage();
const pluginSources =
  "eslint-rules/boundaries/{resolve-package,import-nodes,import-capabilities}.ts";
export default defineConfig({
  test: {
    // Tooling tests launch real compilers and CLIs; bound concurrent file workers.
    maxWorkers: 2,
    projects: [
      "apps/*/vitest.config.ts",
      "packages/*/vitest.config.ts",
      "packages/adapters/*/vitest.config.ts",
      "tools/vitest.config.ts",
      "eslint-rules/boundaries/vitest.config.ts",
    ],
    reporters: ["default"],
    coverage: {
      ...coverage,
      include: [...coverage.include, pluginSources],
      thresholds: { ...coverage.thresholds, [pluginSources]: coverageThresholds.tools },
    },
  },
});
