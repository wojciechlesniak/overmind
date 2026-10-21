// SPDX-License-Identifier: Apache-2.0
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { workspaceProjects, pluginProject } from "./discovery.ts";
import * as project0 from "../../tools/vitest.config.ts";
import * as project1 from "../../eslint-rules/boundaries/vitest.config.ts";
import * as project2 from "../../apps/engine/vitest.config.ts";
import * as project3 from "../../packages/application/vitest.config.ts";
import * as project4 from "../../packages/api-client/vitest.config.ts";
import * as project5 from "../../packages/workflow-runtime/vitest.config.ts";
import * as project6 from "../../packages/adapters/keychain-macos/vitest.config.ts";
import * as project7 from "../../apps/desktop/vitest.config.ts";
import * as project8 from "../../packages/adapters/sqlite/vitest.config.ts";
import * as project9 from "../../packages/adapters/notifications-macos/vitest.config.ts";
import * as project10 from "../../packages/domain/vitest.config.ts";
import * as project11 from "../../packages/gateway/vitest.config.ts";
import * as project12 from "../../packages/ui-kit/vitest.config.ts";
import * as project13 from "../../packages/adapters/sandbox-macos/vitest.config.ts";
import * as project14 from "../../packages/adapters/telegram/vitest.config.ts";
import * as project15 from "../../packages/adapters/providers/vitest.config.ts";
import * as project16 from "../../packages/adapters/herdr/vitest.config.ts";
import * as project17 from "../../packages/contracts/vitest.config.ts";
const namespaces: Readonly<Record<string, unknown>> = {
  tools: project0,
  "eslint-rules/boundaries": project1,
  "apps/engine": project2,
  "packages/application": project3,
  "packages/api-client": project4,
  "packages/workflow-runtime": project5,
  "packages/adapters/keychain-macos": project6,
  "apps/desktop": project7,
  "packages/adapters/sqlite": project8,
  "packages/adapters/notifications-macos": project9,
  "packages/domain": project10,
  "packages/gateway": project11,
  "packages/ui-kit": project12,
  "packages/adapters/sandbox-macos": project13,
  "packages/adapters/telegram": project14,
  "packages/adapters/providers": project15,
  "packages/adapters/herdr": project16,
  "packages/contracts": project17,
};
const threshold = z.object({
  lines: z.number(),
  functions: z.number(),
  branches: z.number(),
  statements: z.number(),
});
const metadata = z.object({
  coverageThreshold: threshold,
  default: z.object({ root: z.string(), test: z.object({ name: z.string() }) }),
});
/** Static imports keep migration edits explicit; coverage always follows product roots. */
export function packageCoverage(root: string) {
  const thresholds: Record<string, z.infer<typeof threshold>> = {};
  const names = new Set<string>();
  for (const project of [...workspaceProjects, pluginProject]) {
    const config = metadata.parse(namespaces[project]);
    if (
      config.default.root !== resolve(root, project) ||
      realpathSync(config.default.root) !== config.default.root ||
      names.has(config.default.test.name)
    ) {
      throw new Error("Vitest project root or name is invalid.");
    }
    names.add(config.default.test.name);
    if (project !== pluginProject) {
      thresholds[`${project}/src/**`] = config.coverageThreshold;
    }
  }
  return {
    provider: "v8" as const,
    reporter: ["text-summary", "lcov", "json-summary"] as ["text-summary", "lcov", "json-summary"],
    reportsDirectory: resolve(root, "coverage"),
    include: ["**/src/**/*.{ts,tsx}"],
    exclude: [
      "**/*.test.*",
      "**/*.stories.*",
      "**/fixtures/**",
      "**/*.generated.ts",
      "**/index.ts",
      "**/src-tauri/**",
    ],
    thresholds,
  };
}
