// SPDX-License-Identifier: Apache-2.0
import type { Rule } from "eslint";
import {
  importRule,
  testTargetDenied,
  adapterTargetDenied,
  deepTarget,
} from "./allowed-imports.ts";
/** Private entries never become public through a relative path or alias. */
export function noDeepImports(root: string): Rule.RuleModule {
  return importRule(
    root,
    { BOUNDARY_DEEP_IMPORT: "Import the package through an explicitly exported entry." },
    (env, target) => {
      if (
        !target ||
        target.kind === "unknown" ||
        testTargetDenied(env, target) ||
        adapterTargetDenied(env, target)
      ) {
        return undefined;
      }
      return deepTarget(env, target) ? "BOUNDARY_DEEP_IMPORT" : undefined;
    },
  );
}
