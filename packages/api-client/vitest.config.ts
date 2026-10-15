import { defineProject } from "vitest/config";
import { sharedConfig, coverageThresholds } from "../../vitest.shared.ts";
export const coverageThreshold = coverageThresholds.ui;
const config = sharedConfig({ name: "api-client", environment: "node", root: import.meta.dirname });
export default defineProject(config);
