// SPDX-License-Identifier: Apache-2.0
import type { Rule } from "eslint";
import { relative, sep } from "node:path";
import { importNodes } from "./import-nodes.ts";
import { publicTargets } from "../../tools/boundaries/workspace.parse-boundary.ts";
import {
  environment,
  packageTarget,
  matrixAllows,
  testOnlyAllowed,
  crossAdapter,
  type Environment,
  type PackageTarget,
} from "./resolve-package.ts";

type Decision = (env: Environment, target: PackageTarget | undefined) => string | undefined;
/** Share metadata traversal, not policy: every decision reads the canonical018 model. */
export function importRule(
  root: string,
  messages: Readonly<Record<string, string>>,
  decide: Decision,
): Rule.RuleModule {
  return {
    meta: { schema: [], messages },
    create(context) {
      return {
        Program() {
          const env = environment(root, context);
          if (!env.owner) {
            return;
          }
          for (const reference of importNodes(context.sourceCode)) {
            const target =
              reference.specifier === undefined
                ? undefined
                : packageTarget(env, reference.specifier);
            const messageId = decide(env, target);
            if (messageId) {
              context.report({ node: reference.node, messageId });
            }
          }
        },
      };
    },
  };
}
export function testTargetDenied(env: Environment, target: PackageTarget): boolean {
  const owner = target.owner ?? target.nominalOwner;
  if (!owner?.policy) {
    return false;
  }
  const support =
    target.path !== undefined && relative(owner.path, target.path).split(sep)[0] === "test-support";
  return (
    !testOnlyAllowed(env, { ...target, owner }) ||
    (support &&
      !env.isTest &&
      !env.isTestSupport &&
      !(env.owner?.id === "tools" && env.catalog.toolsMayImportAny))
  );
}
export function adapterTargetDenied(env: Environment, target: PackageTarget): boolean {
  const resolvedOwner = { ...target, owner: target.owner ?? target.nominalOwner };
  // Classify the known package's matrix permission without admitting an unresolved path.
  return (
    crossAdapter(env, resolvedOwner) && !matrixAllows(env, { ...resolvedOwner, kind: "workspace" })
  );
}
export function deepTarget(env: Environment, target: PackageTarget): boolean {
  if (target.kind === "unknown") {
    return false;
  }
  if (target.nominalOwner) {
    return (
      publicTargets(target.nominalOwner, target.subpath).length === 0 ||
      (target.kind === "workspace" && !target.public)
    );
  }
  return (
    target.kind === "workspace" && target.owner?.policy?.id !== env.owner?.id && !target.public
  );
}
function feature(env: Environment, path: string): string | undefined {
  const parts = relative(env.root, path).split(sep);
  return parts.length > 5 &&
    parts[0] === "apps" &&
    parts[1] === "desktop" &&
    parts[2] === "src" &&
    parts[3] === "features"
    ? parts[4]
    : undefined;
}
/** Type-only and value imports obey the same canonical matrix. */
export function allowedImports(root: string): Rule.RuleModule {
  return importRule(
    root,
    {
      BOUNDARY_FORBIDDEN_IMPORT: "This import violates the dependency matrix.",
      BOUNDARY_DYNAMIC_IMPORT: "The import target must be statically verifiable.",
      BOUNDARY_UNKNOWN_PACKAGE: "The workspace package needs a canonical catalogue entry.",
      BOUNDARY_UNRESOLVED_IMPORT: "The import target cannot be safely resolved.",
      BOUNDARY_FEATURE_CROSS_IMPORT: "Desktop features must not import peer features.",
    },
    (env, target) => {
      if (!target) {
        return "BOUNDARY_DYNAMIC_IMPORT";
      }
      if (target.kind === "unknown") {
        return "BOUNDARY_UNKNOWN_PACKAGE";
      }
      if (
        testTargetDenied(env, target) ||
        adapterTargetDenied(env, target) ||
        deepTarget(env, target)
      ) {
        return undefined;
      }
      if (target.kind === "unresolved") {
        return "BOUNDARY_UNRESOLVED_IMPORT";
      }
      if (target.kind !== "workspace") {
        return undefined;
      }
      const sourceFeature = feature(env, env.filename);
      const destinationFeature = target.path ? feature(env, target.path) : undefined;
      if (sourceFeature && destinationFeature && sourceFeature !== destinationFeature) {
        return "BOUNDARY_FEATURE_CROSS_IMPORT";
      }
      return matrixAllows(env, target) ? undefined : "BOUNDARY_FORBIDDEN_IMPORT";
    },
  );
}
