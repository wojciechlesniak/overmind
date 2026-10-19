// SPDX-License-Identifier: Apache-2.0
import { realpathSync } from "node:fs";
import { relative, sep } from "node:path";
import { compilerOptions } from "../../tools/boundaries/compiler-options.parse-boundary.ts";
import { loadCatalog } from "../../tools/boundaries/policy.parse-boundary.ts";
import {
  readWorkspace,
  ownerOf,
  packageSpecifier,
  publicEntries,
  publicTargets,
} from "../../tools/boundaries/workspace.parse-boundary.ts";
import { resolveImport } from "../../tools/boundaries/ts-resolve.ts";
import { importCapability } from "./import-capabilities.ts";
import type { Rule, SourceCode } from "eslint";
import type {
  BoundaryCatalog,
  BoundaryPackage,
} from "../../tools/boundaries/policy.parse-boundary.ts";
import type {
  Workspace,
  WorkspacePackage,
} from "../../tools/boundaries/workspace.parse-boundary.ts";
import type { ImportCapability } from "./import-capabilities.ts";
export interface Environment {
  readonly root: string;
  readonly filename: string;
  readonly sourceCode: SourceCode;
  readonly workspace: Workspace;
  readonly catalog: BoundaryCatalog;
  readonly owner: BoundaryPackage | undefined;
  readonly isTest: boolean;
  readonly isTestSupport: boolean;
}
export interface PackageTarget {
  readonly kind: "workspace" | "external" | "builtin" | "platform" | "unknown" | "unresolved";
  readonly specifier: string;
  readonly owner?: WorkspacePackage | undefined;
  readonly nominalOwner?: WorkspacePackage | undefined;
  readonly path?: string;
  readonly subpath?: string | undefined;
  readonly public?: boolean;
  readonly capability?: ImportCapability;
}
const cache = new WeakMap<SourceCode, Map<string, { fingerprint: string; value: Environment }>>();
/** Revalidate data before a cache hit; stale or unsafe configuration never inherits permission. */
export function environment(root: string, context: Rule.RuleContext): Environment {
  try {
    const canonicalRoot = realpathSync(root);
    const filename = context.physicalFilename;
    const catalog = loadCatalog(canonicalRoot);
    const workspace = readWorkspace(canonicalRoot);
    const options = compilerOptions(canonicalRoot, filename);
    const actualOwner = ownerOf(workspace, filename);
    if (actualOwner && !actualOwner.policy) {
      throw new Error("Invalid boundary environment.");
    }
    const local = relative(canonicalRoot, filename).split(sep).join("/");
    const owner = [...catalog.packages]
      .sort((a, b) => b.path.length - a.path.length)
      .find((entry) => local.startsWith(entry.path + "/"));
    const packageLocal = owner ? local.slice(owner.path.length + 1) : local;
    const fingerprint = JSON.stringify({
      catalog,
      packages: workspace.packages,
      options,
      filename,
    });
    let roots = cache.get(context.sourceCode);
    const previous = roots?.get(canonicalRoot);
    if (previous?.fingerprint === fingerprint && previous.value.catalog === catalog) {
      return previous.value;
    }
    const value: Environment = Object.freeze({
      root: canonicalRoot,
      filename,
      sourceCode: context.sourceCode,
      workspace,
      catalog,
      owner,
      isTest: /\.test\.tsx?$/u.test(packageLocal) || packageLocal.startsWith("test/"),
      isTestSupport:
        owner?.path.startsWith("packages/") === true && packageLocal.startsWith("test-support/"),
    });
    if (!roots) {
      roots = new Map();
      cache.set(context.sourceCode, roots);
    }
    roots.set(canonicalRoot, { fingerprint, value });
    return value;
  } catch {
    throw new Error("Invalid boundary environment.");
  }
}
function exportedSubpath(pkg: WorkspacePackage, path: string): string | undefined {
  publicEntries(pkg);
  const exports = pkg.manifest["exports"];
  const keys =
    exports &&
    typeof exports === "object" &&
    !Array.isArray(exports) &&
    Object.keys(exports).some((key) => key.startsWith("."))
      ? Object.keys(exports)
      : ["."];
  return keys.find((key) => publicTargets(pkg, key).includes(path));
}
/** Resolve names through the bounded metadata-only TS resolver; no project module is loaded. */
export function packageTarget(env: Environment, specifier: string): PackageTarget {
  let denied: PackageTarget = { kind: "unresolved", specifier };
  if (!specifier || /[\\\p{Cc}]/u.test(specifier)) {
    return denied;
  }
  try {
    if (loadCatalog(env.root) !== env.catalog) {
      return denied;
    }
    compilerOptions(env.root, env.filename);
    const workspace = readWorkspace(env.root);
    const capability = importCapability(specifier);
    if (capability) {
      return { kind: capability.kind, specifier, capability };
    }
    const identity = packageSpecifier(specifier);
    const nominalOwner = identity ? workspace.byName.get(identity.name) : undefined;
    if (identity?.name.startsWith("@overmind/") && !nominalOwner?.policy) {
      return {
        kind: "unknown",
        specifier,
        nominalOwner,
        owner: nominalOwner,
        subpath: identity.subpath,
      };
    }
    if (identity && nominalOwner?.policy) {
      denied = { ...denied, nominalOwner, subpath: identity.subpath, public: false };
    }
    const result = resolveImport(workspace, env.filename, specifier);
    if (result.nominalOwner && !result.owner) {
      return { ...result, kind: "unresolved", specifier, public: false };
    }
    if (result.owner && !result.owner.policy) {
      return { ...result, kind: "unknown", specifier };
    }
    const subpath = result.owner ? exportedSubpath(result.owner, result.path) : undefined;
    const publicTarget =
      !!result.owner &&
      !!subpath &&
      (!result.nominalOwner || result.nominalOwner.path === result.owner.path) &&
      (result.nominalOwner
        ? publicTargets(result.nominalOwner, result.subpath).includes(result.path)
        : true);
    return {
      ...result,
      kind: result.owner ? "workspace" : "external",
      specifier,
      subpath: result.nominalOwner ? result.subpath : subpath,
      public: publicTarget,
    };
  } catch {
    return denied;
  }
}
export function testOnlyAllowed(env: Environment, target: PackageTarget): boolean {
  const id = target.owner?.policy?.id;
  return (
    !!id &&
    (!env.catalog.testOnly.includes(id) ||
      env.isTest ||
      env.isTestSupport ||
      (env.owner?.id === "tools" && env.catalog.toolsMayImportAny))
  );
}
export function crossAdapter(env: Environment, target: PackageTarget): boolean {
  const id = target.owner?.policy?.id;
  return (
    !!id &&
    !!env.owner?.id.startsWith("adapters/") &&
    id.startsWith("adapters/") &&
    id !== env.owner.id
  );
}
export function matrixAllows(env: Environment, target: PackageTarget): boolean {
  const source = env.owner;
  const destination = target.owner?.policy;
  if (target.kind !== "workspace" || !source || !destination || !testOnlyAllowed(env, target)) {
    return false;
  }
  if (source.id === destination.id) {
    return true;
  }
  const library = destination.path.startsWith("packages/");
  if (
    (env.isTest ||
      (env.isTestSupport && env.catalog.testOnly.includes(destination.id)) ||
      (source.id === "tools" && env.catalog.toolsMayImportAny)) &&
    library
  ) {
    return true;
  }
  if (crossAdapter(env, target)) {
    return false;
  }
  return (
    source.allowedImports.includes(destination.id) ||
    (target.subpath !== undefined &&
      (source.allowedSubpaths[destination.id] ?? []).includes(target.subpath.replace(/^\.\//u, "")))
  );
}
