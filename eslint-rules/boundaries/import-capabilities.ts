// SPDX-License-Identifier: Apache-2.0
import { isBuiltin } from "node:module";
import { packageSpecifier } from "../../tools/boundaries/workspace.parse-boundary.ts";
export type ImportCapability =
  | Readonly<{ kind: "builtin"; name: string; family: string }>
  | Readonly<{ kind: "platform"; name: string }>;
export function importCapability(specifier: string): ImportCapability | undefined {
  if (specifier.startsWith("@tauri-apps/") && packageSpecifier(specifier)) {
    return { kind: "platform", name: specifier };
  }
  if (!isBuiltin(specifier)) {
    return undefined;
  }
  const name = specifier.replace(/^node:/u, "");
  return { kind: "builtin", name, family: name.split("/")[0] ?? name };
}
