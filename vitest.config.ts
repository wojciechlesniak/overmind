import { defineConfig } from "vitest/config";
import { packageCoverage } from "./vitest.shared.ts";
export default defineConfig({
  test: {
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
