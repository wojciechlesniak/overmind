import { defineProject } from "vitest/config";
import { sharedConfig, coverageThresholds } from "../../vitest.shared.ts";
export const coverageThreshold = coverageThresholds.core;
const config = sharedConfig({
  name: "application",
  environment: "node",
  root: import.meta.dirname,
});
export default defineProject(config);
