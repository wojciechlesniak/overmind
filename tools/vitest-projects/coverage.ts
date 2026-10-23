// SPDX-License-Identifier: Apache-2.0
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { workspaceProjects, pluginProject } from "./discovery.ts";
import * as toolsConfig from "../../tools/vitest.config.ts";
import * as boundaryRulesConfig from "../../eslint-rules/boundaries/vitest.config.ts";
import * as engineConfig from "../../apps/engine/vitest.config.ts";
import * as applicationConfig from "../../packages/application/vitest.config.ts";
import * as apiClientConfig from "../../packages/api-client/vitest.config.ts";
import * as workflowRuntimeConfig from "../../packages/workflow-runtime/vitest.config.ts";
import * as keychainMacosConfig from "../../packages/adapters/keychain-macos/vitest.config.ts";
import * as desktopConfig from "../../apps/desktop/vitest.config.ts";
import * as sqliteConfig from "../../packages/adapters/sqlite/vitest.config.ts";
import * as notificationsMacosConfig from "../../packages/adapters/notifications-macos/vitest.config.ts";
import * as domainConfig from "../../packages/domain/vitest.config.ts";
import * as gatewayConfig from "../../packages/gateway/vitest.config.ts";
import * as uiKitConfig from "../../packages/ui-kit/vitest.config.ts";
import * as sandboxMacosConfig from "../../packages/adapters/sandbox-macos/vitest.config.ts";
import * as telegramConfig from "../../packages/adapters/telegram/vitest.config.ts";
import * as providersConfig from "../../packages/adapters/providers/vitest.config.ts";
import * as herdrConfig from "../../packages/adapters/herdr/vitest.config.ts";
import * as contractsConfig from "../../packages/contracts/vitest.config.ts";
import * as systemConfig from "../../packages/adapters/system/vitest.config.ts";
const namespaces: Readonly<Record<string, unknown>> = {
  tools: toolsConfig,
  "eslint-rules/boundaries": boundaryRulesConfig,
  "apps/engine": engineConfig,
  "packages/application": applicationConfig,
  "packages/api-client": apiClientConfig,
  "packages/workflow-runtime": workflowRuntimeConfig,
  "packages/adapters/keychain-macos": keychainMacosConfig,
  "apps/desktop": desktopConfig,
  "packages/adapters/sqlite": sqliteConfig,
  "packages/adapters/notifications-macos": notificationsMacosConfig,
  "packages/domain": domainConfig,
  "packages/gateway": gatewayConfig,
  "packages/ui-kit": uiKitConfig,
  "packages/adapters/sandbox-macos": sandboxMacosConfig,
  "packages/adapters/telegram": telegramConfig,
  "packages/adapters/providers": providersConfig,
  "packages/adapters/herdr": herdrConfig,
  "packages/contracts": contractsConfig,
  "packages/adapters/system": systemConfig,
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
