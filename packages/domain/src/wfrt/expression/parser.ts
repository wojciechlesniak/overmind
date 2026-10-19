import { err, ok, type Result } from "@overmind/contracts";
import {
  binarySyntax,
  unarySyntax,
  type BinaryOperator,
  type ExpressionAst,
  type ExprSyntaxError,
  type Token,
} from "./ast.ts";
import { lex } from "./lexer.ts";
import { expressionLimits } from "./limits.ts";
import { printExpression } from "./print.ts";

class SyntaxProblem extends Error {
  readonly problem: ExprSyntaxError;
  constructor(problem: ExprSyntaxError) {
    super("Invalid workflow expression");
    this.problem = problem;
  }
}
const binaryOperators = Object.keys(binarySyntax) as BinaryOperator[];
const forbiddenNames = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "this",
  "eval",
  "Function",
]);

export function parseExpression(source: string): Result<ExpressionAst, ExprSyntaxError[]> {
  const scanned = lex(source);
  if (!scanned.ok) {
    return scanned;
  }
  const tokens = scanned.value;
  let cursor = 0;
  let groups = 0;
  const fail = (
    code: ExprSyntaxError["code"],
    start: number,
    end: number,
    limit?: string,
  ): never => {
    throw new SyntaxProblem(
      Object.freeze({ code, pos: Object.freeze({ start, end }), ...(limit ? { limit } : {}) }),
    );
  };
  const complex = (limit: keyof typeof expressionLimits): never =>
    fail("expr.too_complex", 0, source.length, limit);
  const peek = (): Token => {
    const token = tokens[cursor];
    if (!token) {
      return fail("expr.unexpected_token", source.length, source.length);
    }
    return token;
  };
  const node = <const T extends object>(data: T, start: number, end: number) =>
    Object.freeze({ ...data, pos: Object.freeze({ start, end }) });
  const symbol = (value: string): boolean => peek().kind === "SYMBOL" && peek().value === value;
  const take = (value: string): Token => {
    const token = peek();
    if (!symbol(value)) {
      return fail("expr.unexpected_token", token.pos.start, token.pos.end);
    }
    cursor++;
    return token;
  };
  const name = (token: Token): string => {
    if (token.kind !== "IDENT") {
      return fail("expr.unexpected_token", token.pos.start, token.pos.end);
    }
    if (forbiddenNames.has(token.value)) {
      return fail("expr.forbidden_identifier", token.pos.start, token.pos.end);
    }
    return token.value;
  };
  function list(
    end: string,
    limit: "arguments" | "arrayItems",
    depth: number,
  ): { items: readonly ExpressionAst[]; end: number } {
    const items: ExpressionAst[] = [];
    if (!symbol(end)) {
      do {
        if (items.length >= expressionLimits[limit]) {
          complex(limit);
        }
        items.push(expression(0, depth + 1));
        if (!symbol(",")) {
          break;
        }
        cursor++;
      } while (peek().kind !== "EOF");
    }
    const close = take(end);
    return { items: Object.freeze(items), end: close.pos.end };
  }
  function primary(depth: number): ExpressionAst {
    const token = peek();
    cursor++;
    let value: ExpressionAst;
    if (token.kind === "NUMBER" || token.kind === "PERCENT") {
      value = node(
        { type: "literal", kind: token.kind === "NUMBER" ? "num" : "pct", value: token.value },
        token.pos.start,
        token.pos.end,
      );
    } else if (token.kind === "STRING") {
      value = node(
        { type: "literal", kind: "str", value: token.value },
        token.pos.start,
        token.pos.end,
      );
    } else if (token.kind === "KEYWORD" && token.value === "null") {
      value = node({ type: "literal", kind: "null", value: null }, token.pos.start, token.pos.end);
    } else if (token.kind === "KEYWORD" && (token.value === "true" || token.value === "false")) {
      value = node(
        { type: "literal", kind: "bool", value: token.value === "true" },
        token.pos.start,
        token.pos.end,
      );
    } else if (token.kind === "IDENT") {
      const identifier = name(token);
      if (symbol("(")) {
        cursor++;
        const parsed = list(")", "arguments", depth);
        value = node(
          { type: "call", name: identifier, args: parsed.items },
          token.pos.start,
          parsed.end,
        );
      } else {
        value = node({ type: "ident", name: identifier }, token.pos.start, token.pos.end);
      }
    } else if (token.kind === "SYMBOL" && token.value === "(") {
      // Grouping creates no AST node, so it must not consume a structural level.
      if (groups >= expressionLimits.depth) {
        complex("depth");
      }
      groups++;
      const inner = expression(0, depth);
      groups--;
      const close = take(")");
      value = node(inner, token.pos.start, close.pos.end);
    } else if (token.kind === "SYMBOL" && token.value === "[") {
      const parsed = list("]", "arrayItems", depth);
      value = node({ type: "array", items: parsed.items }, token.pos.start, parsed.end);
    } else {
      return fail("expr.unexpected_token", token.pos.start, token.pos.end);
    }
    while (symbol(".") || symbol("[")) {
      if (symbol(".")) {
        cursor++;
        const property = peek();
        cursor++;
        value = node(
          { type: "member", object: value, property: name(property) },
          value.pos.start,
          property.pos.end,
        );
      } else {
        cursor++;
        const index = expression(0, depth + 1);
        const close = take("]");
        value = node({ type: "index", object: value, index }, value.pos.start, close.pos.end);
      }
    }
    return value;
  }
  function expression(minimum = 0, depth = 1): ExpressionAst {
    if (depth > expressionLimits.depth) {
      complex("depth");
    }
    const token = peek();
    let left: ExpressionAst;
    if (
      (token.kind === "KEYWORD" || token.kind === "SYMBOL") &&
      minimum <= unarySyntax.not.precedence &&
      unarySyntax.not.aliases.some((v) => v === token.value)
    ) {
      cursor++;
      const argument = expression(unarySyntax.not.precedence, depth + 1);
      left = node({ type: "unary", op: "not", argument }, token.pos.start, argument.pos.end);
    } else if (symbol("-")) {
      cursor++;
      const argument = expression(unarySyntax["-"].precedence, depth + 1);
      left = node({ type: "unary", op: "-", argument }, token.pos.start, argument.pos.end);
    } else {
      left = primary(depth);
    }
    let compared = false;
    while (peek().kind !== "EOF") {
      const next = peek();
      const op =
        next.kind === "KEYWORD" || next.kind === "SYMBOL"
          ? binaryOperators.find((operator) =>
              binarySyntax[operator].aliases.some((v) => v === next.value),
            )
          : undefined;
      if (!op || binarySyntax[op].precedence < minimum) {
        return left;
      }
      const precedence = binarySyntax[op].precedence;
      if (precedence === binarySyntax.eq.precedence && compared) {
        return fail("expr.unexpected_token", next.pos.start, next.pos.end);
      }
      cursor++;
      const right = expression(precedence + 1, depth + 1);
      left = node({ type: "binary", op, left, right }, left.pos.start, right.pos.end);
      compared ||= precedence === binarySyntax.eq.precedence;
    }
    return left;
  }
  try {
    if (peek().kind === "EOF") {
      return fail("expr.empty", 0, source.length);
    }
    const root = expression();
    const trailing = peek();
    if (trailing.kind !== "EOF") {
      return fail("expr.unexpected_token", trailing.pos.start, trailing.pos.end);
    }
    checkTree(root, complex);
    if (printExpression(root).length > expressionLimits.canonicalSourceLength) {
      complex("canonicalSourceLength");
    }
    return ok(root);
  } catch (problem) {
    if (problem instanceof SyntaxProblem) {
      return err([problem.problem]);
    }
    throw problem;
  }
}

function checkTree(root: ExpressionAst, complex: (limit: "nodes" | "depth") => never): void {
  const stack: { node: ExpressionAst; depth: number }[] = [{ node: root, depth: 1 }];
  let count = 0;
  while (stack.length > 0) {
    const entry = stack.pop();
    if (!entry) {
      break;
    }
    if (++count > expressionLimits.nodes) {
      complex("nodes");
    }
    if (entry.depth > expressionLimits.depth) {
      complex("depth");
    }
    const value = entry.node;
    let children: readonly ExpressionAst[];
    switch (value.type) {
      case "literal":
      case "ident":
        children = [];
        break;
      case "member":
        children = [value.object];
        break;
      case "index":
        children = [value.object, value.index];
        break;
      case "call":
        children = value.args;
        break;
      case "array":
        children = value.items;
        break;
      case "unary":
        children = [value.argument];
        break;
      case "binary":
        children = [value.left, value.right];
        break;
    }
    for (const child of children) {
      stack.push({ node: child, depth: entry.depth + 1 });
    }
  }
}
