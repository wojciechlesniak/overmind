// SPDX-License-Identifier: Apache-2.0
import ts from "typescript";

export interface AliasSelection {
  readonly object: ts.Node;
  readonly segments: readonly string[];
}
export interface AliasWrites {
  readonly writes: ReadonlyMap<ts.Symbol, readonly ts.Expression[]>;
  readonly selections: ReadonlyMap<ts.Symbol, readonly AliasSelection[]>;
  readonly propertyWrites: ReadonlyMap<ts.Symbol, ReadonlyMap<string, readonly AliasSelection[]>>;
  readonly bindings: ReadonlySet<ts.Symbol>;
  readonly assignmentTargets: ReadonlySet<ts.Identifier>;
  readonly symbolOf: (node: ts.Identifier) => ts.Symbol | undefined;
  readonly key: (node: ts.Node) => string;
  readonly elementKey: (node: ts.Expression) => string;
}

export function aliasWritesOf(source: ts.SourceFile, checker: ts.TypeChecker): AliasWrites {
  const bindings = new Set<ts.Symbol>();
  const propertyWrites = new Map<ts.Symbol, Map<string, AliasSelection[]>>();
  const symbolOf = (node: ts.Identifier) =>
    ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node
      ? checker.getShorthandAssignmentValueSymbol(node.parent)
      : checker.getSymbolAtLocation(node);
  const writes = new Map<ts.Symbol, ts.Expression[]>();
  const selections = new Map<ts.Symbol, AliasSelection[]>();
  const assignmentTargets = new Set<ts.Identifier>();
  function collectSelection(target: ts.Expression, object: ts.Node, segments: string[] = []) {
    if (ts.isIdentifier(target)) {
      const symbol = symbolOf(target);
      if (symbol) {
        selections.set(symbol, [...(selections.get(symbol) ?? []), { object, segments }]);
        assignmentTargets.add(target);
      }
    } else if (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) {
      addMemberWrite(target, { object, segments });
    } else if (ts.isObjectLiteralExpression(target)) {
      for (const property of target.properties) {
        if (ts.isPropertyAssignment(property)) {
          collectSelection(property.initializer, object, [...segments, key(property.name)]);
        } else if (ts.isShorthandPropertyAssignment(property)) {
          collectSelection(property.name, object, [...segments, property.name.text]);
          if (property.objectAssignmentInitializer) {
            addWrite(property.name, property.objectAssignmentInitializer);
          }
        } else if (ts.isSpreadAssignment(property)) {
          collectSelection(property.expression, object, segments);
        }
      }
    } else if (ts.isArrayLiteralExpression(target)) {
      target.elements.forEach((element, index) => {
        if (!ts.isOmittedExpression(element)) {
          collectSelection(ts.isSpreadElement(element) ? element.expression : element, object, [
            ...segments,
            ts.isSpreadElement(element) ? "*" : String(index),
          ]);
        }
      });
    } else if (
      ts.isBinaryExpression(target) &&
      target.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      collectSelection(target.left, object, segments);
    }
  }
  function addMemberWrite(
    target: ts.PropertyAccessExpression | ts.ElementAccessExpression,
    selection: AliasSelection,
  ) {
    const symbol = checker.getSymbolAtLocation(target.expression);
    if (symbol) {
      const members = propertyWrites.get(symbol) ?? new Map<string, AliasSelection[]>();
      const segment = ts.isPropertyAccessExpression(target)
        ? target.name.text
        : elementKey(target.argumentExpression);
      members.set(segment, [...(members.get(segment) ?? []), selection]);
      propertyWrites.set(symbol, members);
    }
  }
  const addWrite = (name: ts.Identifier, value: ts.Expression) => {
    const symbol = symbolOf(name);
    if (symbol) {
      writes.set(symbol, [...(writes.get(symbol) ?? []), value]);
    }
  };
  const collect = (node: ts.Node) => {
    if (
      (ts.isVariableDeclaration(node) || ts.isParameter(node)) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      addWrite(node.name, node.initializer);
    }
    if (ts.isBindingElement(node) && ts.isIdentifier(node.name)) {
      const symbol = checker.getSymbolAtLocation(node.name);
      if (symbol) {
        bindings.add(symbol);
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      if (ts.isIdentifier(node.left)) {
        addWrite(node.left, node.right);
      } else if (
        ts.isObjectLiteralExpression(node.left) ||
        ts.isArrayLiteralExpression(node.left)
      ) {
        collectSelection(node.left, node.right);
      } else if (
        ts.isPropertyAccessExpression(node.left) ||
        ts.isElementAccessExpression(node.left)
      ) {
        addMemberWrite(node.left, { object: node.right, segments: [] });
      }
    }
    ts.forEachChild(node, collect);
  };
  collect(source);
  function elementKey(node: ts.Expression): string {
    return ts.isStringLiteralLike(node) || ts.isNumericLiteral(node) ? node.text : "*";
  }
  function key(node: ts.Node): string {
    if (ts.isIdentifier(node) || ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) {
      return node.text;
    }
    if (ts.isComputedPropertyName(node)) {
      return elementKey(node.expression);
    }
    return "*";
  }
  return {
    writes,
    selections,
    propertyWrites,
    bindings,
    assignmentTargets,
    symbolOf,
    key,
    elementKey,
  };
}
