// SPDX-License-Identifier: Apache-2.0
import type { JSSyntaxElement, SourceCode } from "eslint";
export interface ImportReference {
  readonly node: JSSyntaxElement;
  readonly specifier: string | undefined;
}
type Syntax = JSSyntaxElement & Readonly<Record<string, unknown>>;
function syntax(value: unknown): value is Syntax {
  return (
    typeof value === "object" && value !== null && "type" in value && typeof value.type === "string"
  );
}
function literal(value: unknown): string | undefined {
  if (!syntax(value)) {
    return undefined;
  }
  if (value.type === "Literal" && typeof value["value"] === "string") {
    return value["value"];
  }
  if (value.type === "TSLiteralType") {
    return literal(value["literal"]);
  }
  if (
    value.type === "TemplateLiteral" &&
    Array.isArray(value["expressions"]) &&
    value["expressions"].length === 0 &&
    Array.isArray(value["quasis"])
  ) {
    const quasi: unknown = value["quasis"][0];
    const data = syntax(quasi) ? quasi["value"] : undefined;
    if (
      typeof data === "object" &&
      data !== null &&
      "cooked" in data &&
      typeof data.cooked === "string"
    ) {
      return data.cooked;
    }
  }
  return undefined;
}
export function importNodes(source: SourceCode): ImportReference[] {
  const references: ImportReference[] = [];
  function visit(node: Syntax) {
    let target: unknown;
    let reference = false;
    if (
      node.type === "ImportDeclaration" ||
      ((node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") &&
        node["source"] !== null &&
        node["source"] !== undefined)
    ) {
      target = node["source"];
      reference = true;
    } else if (
      node.type === "TSImportEqualsDeclaration" &&
      syntax(node["moduleReference"]) &&
      node["moduleReference"].type === "TSExternalModuleReference"
    ) {
      target = node["moduleReference"]["expression"];
      reference = true;
    } else if (node.type === "TSImportType") {
      target = node["source"];
      reference = true;
    } else if (node.type === "ImportExpression") {
      target = node["source"];
      reference = true;
    } else if (
      node.type === "CallExpression" &&
      syntax(node["callee"]) &&
      node["callee"].type === "Identifier" &&
      node["callee"]["name"] === "require"
    ) {
      target = Array.isArray(node["arguments"]) ? node["arguments"][0] : undefined;
      reference = true;
    }
    if (reference) {
      references.push({ node, specifier: literal(target) });
    }
    for (const key of source.visitorKeys[node.type] ?? []) {
      const child = node[key];
      if (Array.isArray(child)) {
        for (const value of child) {
          if (syntax(value)) {
            visit(value);
          }
        }
      } else if (syntax(child)) {
        visit(child);
      }
    }
  }
  if (!syntax(source.ast)) {
    throw new Error("Invalid ESLint syntax input.");
  }
  visit(source.ast);
  return references;
}
