// SPDX-License-Identifier: Apache-2.0
import type { Rule } from "eslint";
import { importRule, testTargetDenied, adapterTargetDenied } from "./allowed-imports.ts";
/** Adapter collaboration goes through ports rather than peer implementations. */
export function noCrossAdapter(root: string): Rule.RuleModule {
  return importRule(
    root,
    { BOUNDARY_CROSS_ADAPTER: "Use an application port instead of importing another adapter." },
    (env, target) =>
      target && !testTargetDenied(env, target) && adapterTargetDenied(env, target)
        ? "BOUNDARY_CROSS_ADAPTER"
        : undefined,
  );
}
