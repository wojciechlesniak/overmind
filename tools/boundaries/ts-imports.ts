// SPDX-License-Identifier: Apache-2.0
import ts from "typescript";
export interface ImportReference {
  readonly node: ts.Node;
  readonly specifier: string | undefined;
}
export function importsOf(source: ts.SourceFile): ImportReference[] {
  const references: ImportReference[] = [];
  const visit = (node: ts.Node) => {
    let target: ts.Node | undefined;
    let reference = false;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      target = node.moduleSpecifier;
      reference = target !== undefined;
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      target = node.moduleReference.expression;
      reference = true;
    } else if (ts.isImportTypeNode(node)) {
      target = ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined;
      reference = true;
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      target = node.arguments[0];
      reference = true;
    }
    if (reference) {
      references.push({
        node,
        specifier: target && ts.isStringLiteralLike(target) ? target.text : undefined,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return references;
}
