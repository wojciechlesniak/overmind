// SPDX-License-Identifier: Apache-2.0
import type { Rule } from "eslint";
import { importRule, testTargetDenied } from "./allowed-imports.ts";
/** Production code must not reach test packages or test-support helpers. */
export function testOnly(root: string): Rule.RuleModule {
  return importRule(
    root,
    { BOUNDARY_TEST_ONLY: "Test-only code is unavailable to production entry points." },
    (env, target) => (target && testTargetDenied(env, target) ? "BOUNDARY_TEST_ONLY" : undefined),
  );
}
