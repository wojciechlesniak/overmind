// SPDX-License-Identifier: Apache-2.0
import { relative, sep } from "node:path";
import type { Rule } from "eslint";
import { importRule } from "./allowed-imports.ts";

/** Capability restrictions are not relaxed by the test-only import overlay. */
export function noForbiddenBuiltins(root: string): Rule.RuleModule {
  return importRule(
    root,
    {
      BOUNDARY_FORBIDDEN_BUILTIN: "Inject a port instead of importing this runtime capability.",
      BOUNDARY_FORBIDDEN_PACKAGE: "Use the permitted platform bridge instead of this package.",
    },
    (env, target) => {
      if (!target || !env.owner) {
        return undefined;
      }
      const name = target.specifier.replace(/^node:/u, "");
      const builtin = target.capability?.kind === "builtin" || target.specifier.startsWith("node:");
      if (
        builtin &&
        env.owner.forbiddenBuiltins.some((entry) => {
          const pattern = entry.replace(/^node:/u, "");
          return pattern === "*" || name === pattern || name.startsWith(pattern + "/");
        })
      ) {
        return "BOUNDARY_FORBIDDEN_BUILTIN";
      }
      const forbidden = env.owner.forbiddenPackages.some((pattern) =>
        pattern.endsWith("/*")
          ? target.specifier.startsWith(pattern.slice(0, -1))
          : target.specifier === pattern,
      );
      const path = relative(env.root, env.filename).split(sep).join("/");
      const bridge =
        env.owner.id === "apps/desktop" &&
        path.startsWith("apps/desktop/src/shared/platform/tauri/") &&
        target.specifier.startsWith("@tauri-apps/");
      return forbidden && !bridge ? "BOUNDARY_FORBIDDEN_PACKAGE" : undefined;
    },
  );
}
