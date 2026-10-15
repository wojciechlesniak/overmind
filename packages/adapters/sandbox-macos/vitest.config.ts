import { defineProject } from "vitest/config";
import { sharedConfig, coverageThresholds } from "../../../vitest.shared.ts";
export const coverageThreshold = coverageThresholds.infrastructure;
const config = sharedConfig({
  name: "adapter-sandbox-macos",
  environment: "node",
  root: import.meta.dirname,
});
export default defineProject(config);
