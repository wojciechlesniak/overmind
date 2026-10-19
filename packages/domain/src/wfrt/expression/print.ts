// SPDX-License-Identifier: Apache-2.0
import { binarySyntax, unarySyntax, type ExpressionAst } from "./ast.ts";
type Rendered = readonly [text: string, precedence: number];
const postfixPrecedence = unarySyntax["-"].precedence + 1;
const primaryPrecedence = postfixPrecedence + 1;
function child(ast: ExpressionAst, minimum: number, groupEqual = false): string {
  const [text, precedence] = render(ast);
  return precedence < minimum || (groupEqual && precedence === minimum) ? `(${text})` : text;
}
function render(ast: ExpressionAst): Rendered {
  switch (ast.type) {
    case "literal":
      return [
        ast.kind === "str"
          ? quoted(ast.value)
          : (ast.kind === "num" || ast.kind === "pct" ? decimal(ast.value) : String(ast.value)) +
            (ast.kind === "pct" ? "%" : ""),
        primaryPrecedence,
      ];
    case "ident":
      return [ast.name, primaryPrecedence];
    case "array":
      return [`[${ast.items.map(printExpression).join(", ")}]`, primaryPrecedence];
    case "call":
      return [`${ast.name}(${ast.args.map(printExpression).join(", ")})`, primaryPrecedence];
    case "member":
      return [`${child(ast.object, postfixPrecedence)}.${ast.property}`, postfixPrecedence];
    case "index":
      return [
        `${child(ast.object, postfixPrecedence)}[${printExpression(ast.index)}]`,
        postfixPrecedence,
      ];
    case "unary": {
      const syntax = unarySyntax[ast.op];
      return [
        syntax.aliases[0] + (ast.op === "not" ? " " : "") + child(ast.argument, syntax.precedence),
        syntax.precedence,
      ];
    }
    case "binary": {
      const syntax = binarySyntax[ast.op];
      const left = child(
        ast.left,
        syntax.precedence,
        syntax.precedence === binarySyntax.eq.precedence,
      );
      const right = child(ast.right, syntax.precedence, true);
      return [`${left} ${syntax.aliases[0]} ${right}`, syntax.precedence];
    }
  }
}
export function printExpression(ast: ExpressionAst): string {
  return render(ast)[0];
}
function decimal(value: number): string {
  const text = String(value);
  const exponentAt = text.indexOf("e");
  if (exponentAt < 0) {
    return text;
  }
  const coefficient = text.slice(0, exponentAt);
  const sign = coefficient.startsWith("-") ? "-" : "";
  const unsigned = coefficient.slice(sign.length);
  const dot = unsigned.indexOf(".");
  const digits = unsigned.replace(".", "");
  const point = (dot < 0 ? unsigned.length : dot) + Number(text.slice(exponentAt + 1));
  if (point <= 0) {
    return sign + "0." + "0".repeat(-point) + digits;
  }
  if (point >= digits.length) {
    return sign + digits + "0".repeat(point - digits.length);
  }
  return sign + digits.slice(0, point) + "." + digits.slice(point);
}
function quoted(value: string): string {
  return JSON.stringify(value).replace(/\\(?:[bfr]|\\)/g, (escape: string) => {
    switch (escape) {
      case "\\b":
        return "\\u0008";
      case "\\f":
        return "\\u000c";
      case "\\r":
        return "\\u000d";
      default:
        return escape;
    }
  });
}
