// SPDX-License-Identifier: Apache-2.0
import ts from "typescript";
import { resolve } from "node:path";
import { compilerOptions, resolutionHost } from "./compiler-options.parse-boundary.ts";
import { readSource } from "./policy.parse-boundary.ts";
import {
  ownerOf,
  packageSpecifier,
  type Workspace,
  type WorkspacePackage,
} from "./workspace.parse-boundary.ts";
export interface ResolvedImport {
  readonly path: string;
  readonly owner: WorkspacePackage | undefined;
  readonly nominalOwner: WorkspacePackage | undefined;
  readonly subpath: string | undefined;
}
export function resolveImport(
  workspace: Workspace,
  filename: string,
  specifier: string,
): ResolvedImport {
  const options = compilerOptions(workspace.root, filename);
  try {
    const host = resolutionHost(workspace.root);
    const identity = packageSpecifier(specifier);
    const nominalOwner = identity ? workspace.byName.get(identity.name) : undefined;
    // An actual package.json anchors TS self-name resolution without admitting source links.
    // Importer-derived options still control aliases and export conditions in the native resolver.
    const context = nominalOwner ? resolve(nominalOwner.path, "package.json") : filename;
    const resolved = ts.resolveModuleName(specifier, context, options, host).resolvedModule;
    const path = resolved && host.realpath?.(resolved.resolvedFileName);
    if (!path) {
      throw new Error("Invalid repository import.");
    }
    readSource(workspace.root, path);
    return { path, owner: ownerOf(workspace, path), nominalOwner, subpath: identity?.subpath };
  } catch {
    throw new Error("Invalid repository import.");
  }
}
