import { defineProject } from "vitest/config";
import { sharedConfig, coverageThresholds } from "../../vitest.shared.ts";
export const coverageThreshold = coverageThresholds.tools;
const config = sharedConfig({
  name: "boundary-rules",
  environment: "node",
  root: import.meta.dirname,
});
config.test.include = ["**/*.test.ts"];
export default defineProject(config);
