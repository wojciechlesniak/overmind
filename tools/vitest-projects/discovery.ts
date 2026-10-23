// SPDX-License-Identifier: Apache-2.0
import { lstatSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { readSource } from "../boundaries/policy.parse-boundary.ts";
export const workspaceProjects = [
  "tools",
  "apps/engine",
  "packages/application",
  "packages/api-client",
  "packages/workflow-runtime",
  "packages/adapters/keychain-macos",
  "apps/desktop",
  "packages/adapters/sqlite",
  "packages/adapters/notifications-macos",
  "packages/domain",
  "packages/gateway",
  "packages/ui-kit",
  "packages/adapters/sandbox-macos",
  "packages/adapters/telegram",
  "packages/adapters/providers",
  "packages/adapters/herdr",
  "packages/contracts",
] as const;
export const pluginProject = "eslint-rules/boundaries";
function present(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw new Error("Vitest configuration cannot be inspected.", { cause: error });
  }
}
/** Admit the complete canonical inventory before any configuration module evaluates. */
export function discoverProjects(root: string): string[] {
  if (realpathSync(root) !== resolve(root)) {
    throw new Error("Vitest root must be canonical.");
  }
  const projects = workspaceProjects.map((project) => {
    const choices = [
      resolve(root, project, "vitest.config.ts"),
      resolve(root, "tools/vitest-projects", project, "vitest.config.ts"),
    ].filter(present);
    if (choices.length !== 1) {
      throw new Error("Vitest configuration must exist exactly once.");
    }
    const selected = choices[0];
    if (!selected) {
      throw new Error("Vitest configuration is unavailable.");
    }
    readSource(root, selected);
    return selected;
  });
  const plugin = resolve(root, pluginProject, "vitest.config.ts");
  readSource(root, plugin);
  return [...projects, plugin];
}
