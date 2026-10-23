import { defineConfig } from "vitest/config";
import { coverageThresholds } from "./vitest.shared.ts";
import { discoverProjects } from "./tools/vitest-projects/discovery.ts";
const projects = discoverProjects(import.meta.dirname);
const { packageCoverage } = await import("./tools/vitest-projects/coverage.ts");
const coverage = packageCoverage(import.meta.dirname);
const pluginSources =
  "eslint-rules/boundaries/{resolve-package,import-nodes,import-capabilities}.ts";
export default defineConfig({
  test: {
    // Tooling tests launch real compilers and CLIs; bound concurrent file workers.
    maxWorkers: 2,
    projects,
    reporters: ["default"],
    coverage: {
      ...coverage,
      include: [...coverage.include, pluginSources],
      thresholds: { ...coverage.thresholds, [pluginSources]: coverageThresholds.tools },
    },
  },
});
