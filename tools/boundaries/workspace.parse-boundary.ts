// SPDX-License-Identifier: Apache-2.0
import { lstatSync, readdirSync, realpathSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { z } from "zod";
import { loadCatalog, readSource, type BoundaryPackage } from "./policy.parse-boundary.ts";

const nameSchema = z
  .string()
  .min(1)
  .max(214)
  .regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u);
const manifestSchema = z.looseObject({ name: nameSchema }).readonly();
export interface WorkspacePackage {
  readonly path: string;
  readonly manifest: z.infer<typeof manifestSchema>;
  readonly policy: BoundaryPackage | undefined;
}
export interface Workspace {
  readonly root: string;
  readonly packages: readonly WorkspacePackage[];
  readonly byName: ReadonlyMap<string, WorkspacePackage>;
}
function directory(root: string, path: string): boolean {
  const info = lstatSync(path, { throwIfNoEntry: false });
  if (!info) {
    return false;
  }
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    realpathSync(path) !== path ||
    info.dev !== lstatSync(root).dev
  ) {
    throw new Error("Invalid workspace manifest.");
  }
  return true;
}
export function readWorkspace(root: string): Workspace {
  try {
    const canonicalRoot = realpathSync(root);
    const catalog = loadCatalog(canonicalRoot);
    const paths: string[] = [];
    for (const parent of ["apps", "packages", "packages/adapters"]) {
      const base = resolve(canonicalRoot, parent);
      if (!directory(canonicalRoot, base)) {
        continue;
      }
      for (const name of readdirSync(base)) {
        if (parent === "packages" && name === "adapters") {
          continue;
        }
        const path = resolve(base, name);
        const governed = catalog.packages.some(
          (entry) => resolve(canonicalRoot, entry.path) === path,
        );
        if (lstatSync(path).isFile() && !governed) {
          continue;
        }
        if (
          directory(canonicalRoot, path) &&
          (governed || lstatSync(resolve(path, "package.json"), { throwIfNoEntry: false }))
        ) {
          paths.push(path);
        }
      }
    }
    const tools = resolve(canonicalRoot, "tools");
    if (directory(canonicalRoot, tools)) {
      paths.push(tools);
    }
    const packages = paths.sort().map((path): WorkspacePackage => {
      const raw: unknown = JSON.parse(
        readSource(canonicalRoot, resolve(path, "package.json"), 128 * 1024),
      );
      return Object.freeze({
        path,
        manifest: manifestSchema.parse(raw),
        policy: catalog.packages.find((entry) => resolve(canonicalRoot, entry.path) === path),
      });
    });
    const byName = new Map(packages.map((entry) => [entry.manifest.name, entry]));
    if (byName.size !== packages.length) {
      throw new Error("Invalid workspace manifest.");
    }
    return Object.freeze({ root: canonicalRoot, packages: Object.freeze(packages), byName });
  } catch {
    throw new Error("Invalid workspace manifest.");
  }
}

export function relativeName(root: string, file: string): string {
  return relative(root.replaceAll("\\", "/"), file.replaceAll("\\", "/")).split(sep).join("/");
}
export function ownerOf(workspace: Workspace, file: string): WorkspacePackage | undefined {
  const absolute = resolve(file);
  return [...workspace.packages]
    .sort((a, b) => b.path.length - a.path.length)
    .find((entry) => absolute === entry.path || absolute.startsWith(entry.path + sep));
}
export function packageSpecifier(specifier: string): { name: string; subpath: string } | undefined {
  if (/[\\\p{Cc}]/u.test(specifier)) {
    return undefined;
  }
  const parts = specifier.split("/");
  const count = specifier.startsWith("@") ? 2 : 1;
  const name = parts.slice(0, count).join("/");
  if (
    !nameSchema.safeParse(name).success ||
    parts.some((part) => !part || part === "." || part === "..")
  ) {
    return undefined;
  }
  return { name, subpath: parts.length === count ? "." : "./" + parts.slice(count).join("/") };
}
function exportMap(pkg: WorkspacePackage): Record<string, unknown> {
  const value = pkg.manifest["exports"];
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).some((key) => key.startsWith("."))
  ) {
    const result = z.record(z.string(), z.unknown()).parse(value);
    if (
      Object.keys(result).some(
        (key) =>
          key !== "." && (!key.startsWith("./") || !packageSpecifier("entry/" + key.slice(2))),
      )
    ) {
      throw new Error("Invalid workspace exports.");
    }
    return result;
  }
  return { ".": value };
}
export function publicTargets(pkg: WorkspacePackage, subpath = "."): readonly string[] {
  try {
    const result: string[] = [];
    function collect(value: unknown, depth: number) {
      if (depth > 32) {
        throw new Error("Invalid workspace exports.");
      }
      if (value === null || value === undefined) {
        return;
      }
      if (typeof value === "string") {
        if (
          !value.startsWith("./") ||
          value.length > 256 ||
          /[\\*\p{Cc}]/u.test(value) ||
          value
            .slice(2)
            .split("/")
            .some((part) => !part || part === "." || part === "..")
        ) {
          throw new Error("Invalid workspace exports.");
        }
        result.push(resolve(pkg.path, value));
      } else if (Array.isArray(value)) {
        for (const item of value) {
          collect(item, depth + 1);
        }
      } else if (typeof value === "object") {
        for (const [condition, target] of Object.entries(value)) {
          if (condition.startsWith(".")) {
            throw new Error("Invalid workspace exports.");
          }
          collect(target, depth + 1);
        }
      } else {
        throw new Error("Invalid workspace exports.");
      }
    }
    collect(exportMap(pkg)[subpath], 0);
    return [...new Set(result)].sort();
  } catch {
    throw new Error("Invalid workspace exports.");
  }
}
export function publicEntries(pkg: WorkspacePackage): readonly string[] {
  return [
    ...new Set(Object.keys(exportMap(pkg)).flatMap((subpath) => publicTargets(pkg, subpath))),
  ].sort();
}
