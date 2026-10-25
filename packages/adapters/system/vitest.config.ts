// SPDX-License-Identifier: Apache-2.0
import { defineProject } from "vitest/config";
import { sharedConfig, coverageThresholds } from "../../../vitest.shared.ts";
export const coverageThreshold = coverageThresholds.infrastructure;
export default defineProject(
  sharedConfig({ name: "adapter-system", environment: "node", root: import.meta.dirname }),
);
