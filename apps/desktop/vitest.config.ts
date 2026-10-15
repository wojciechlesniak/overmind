import { defineProject } from "vitest/config";
import { sharedConfig, coverageThresholds } from "../../vitest.shared.ts";
export const coverageThreshold = coverageThresholds.ui;
const config = sharedConfig({ name: "desktop", environment: "jsdom", root: import.meta.dirname });
export default defineProject(config);
