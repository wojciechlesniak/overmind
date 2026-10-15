import { defineProject } from "vitest/config";
import { sharedConfig, coverageThresholds } from "../vitest.shared.ts";
export const coverageThreshold = coverageThresholds.tools;
const config = sharedConfig({ name: "tools", environment: "node", root: import.meta.dirname });

config.test.include = ["**/*.test.{ts,tsx}"];
config.test.exclude = [
  "**/*.int.test.ts",
  "**/node_modules/**",
  "**/.tsbuild/**",
  "**/fixtures/**",
];
export default defineProject(config);
