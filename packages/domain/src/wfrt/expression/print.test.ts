// SPDX-License-Identifier: Apache-2.0
import { expect, it } from "vitest";
import type { BinaryOperator, ExpressionAst } from "./ast.ts";
import { printExpression } from "./print.ts";
const pos = { start: 0, end: 1 };
it.each([
  [{ type: "literal", kind: "num", value: 7, pos }, "7"],
  [{ type: "literal", kind: "pct", value: 100, pos }, "100%"],
  [{ type: "literal", kind: "str", value: "hello", pos }, '"hello"'],
] satisfies readonly (readonly [ExpressionAst, string])[])(
  "prints a literal as %s",
  (ast, expected) => {
    expect(printExpression(ast)).toBe(expected);
  },
);

const id = (name: string): ExpressionAst => Object.freeze({ type: "ident", name, pos });
const num = (value: number): ExpressionAst =>
  Object.freeze({ type: "literal", kind: "num", value, pos });
const binary = (op: BinaryOperator, left: ExpressionAst, right: ExpressionAst): ExpressionAst =>
  Object.freeze({ type: "binary", op, left, right, pos });
const unary = (op: "-" | "not", argument: ExpressionAst): ExpressionAst =>
  Object.freeze({ type: "unary", op, argument, pos });
const member = (object: ExpressionAst, property: string): ExpressionAst =>
  Object.freeze({ type: "member", object, property, pos });
const index = (object: ExpressionAst, item: ExpressionAst): ExpressionAst =>
  Object.freeze({ type: "index", object, index: item, pos });
const call = (name: string, args: readonly ExpressionAst[]): ExpressionAst =>
  Object.freeze({ type: "call", name, args: Object.freeze(args), pos });
const array = (items: readonly ExpressionAst[]): ExpressionAst =>
  Object.freeze({ type: "array", items: Object.freeze(items), pos });

it.each([
  ["or", "a OR b"],
  ["and", "a AND b"],
  ["eq", "a = b"],
  ["ne", "a != b"],
  ["lt", "a < b"],
  ["le", "a <= b"],
  ["gt", "a > b"],
  ["ge", "a >= b"],
  ["in", "a IN b"],
  ["add", "a + b"],
  ["sub", "a - b"],
  ["mul", "a * b"],
  ["div", "a / b"],
] as const)("prints canonical %s independently of source aliases", (op, expected) => {
  expect(printExpression(binary(op, id("a"), id("b")))).toBe(expected);
});

it.each([
  [id("item"), "item"],
  [{ type: "literal", kind: "bool", value: true, pos }, "true"],
  [{ type: "literal", kind: "bool", value: false, pos }, "false"],
  [{ type: "literal", kind: "null", value: null, pos }, "null"],
  [array([]), "[]"],
  [array([num(1), id("x")]), "[1, x]"],
  [call("value", []), "value()"],
  [call("max", [num(1), num(2)]), "max(1, 2)"],
  [member(id("input"), "score"), "input.score"],
  [index(id("input"), num(0)), "input[0]"],
  [member(index(member(id("a"), "b"), num(0)), "c"), "a.b[0].c"],
  [member(call("get", [id("input")]), "value"), "get(input).value"],
  [index(array([id("a"), id("b")]), num(0)), "[a, b][0]"],
  [unary("-", id("a")), "-a"],
  [unary("not", id("a")), "NOT a"],
  [unary("not", unary("not", id("a"))), "NOT NOT a"],
  [unary("-", unary("-", id("a"))), "--a"],
  [unary("-", binary("add", id("a"), id("b"))), "-(a + b)"],
  [unary("-", unary("not", id("a"))), "-(NOT a)"],
  [unary("not", binary("eq", id("a"), id("b"))), "NOT a = b"],
  [binary("eq", unary("not", id("a")), id("b")), "(NOT a) = b"],
  [unary("not", binary("and", id("a"), id("b"))), "NOT (a AND b)"],
  [binary("sub", id("a"), binary("sub", id("b"), id("c"))), "a - (b - c)"],
  [binary("div", id("a"), binary("mul", id("b"), id("c"))), "a / (b * c)"],
  [binary("add", id("a"), binary("add", id("b"), id("c"))), "a + (b + c)"],
  [binary("add", binary("sub", id("a"), id("b")), id("c")), "a - b + c"],
  [binary("mul", binary("add", id("a"), id("b")), id("c")), "(a + b) * c"],
  [binary("add", id("a"), binary("mul", id("b"), id("c"))), "a + b * c"],
  [binary("eq", binary("lt", id("a"), id("b")), id("c")), "(a < b) = c"],
  [binary("eq", id("a"), binary("lt", id("b"), id("c"))), "a = (b < c)"],
  [binary("or", id("a"), binary("and", id("b"), id("c"))), "a OR b AND c"],
  [binary("and", binary("or", id("a"), id("b")), id("c")), "(a OR b) AND c"],
  [binary("and", id("a"), binary("and", id("b"), id("c"))), "a AND (b AND c)"],
  [member(binary("add", id("a"), id("b")), "field"), "(a + b).field"],
  [index(unary("-", id("a")), binary("add", num(1), num(2))), "(-a)[1 + 2]"],
  [unary("-", member(id("a"), "field")), "-a.field"],
] satisfies readonly (readonly [ExpressionAst, string])[])(
  "preserves semantic grouping as %s",
  (ast, expected) => {
    expect(printExpression(ast)).toBe(expected);
  },
);

it("prints the full 1030-character canonical counterexample without applying parser admission", () => {
  const name = "a".repeat(64);
  let ast = id(name);
  for (let i = 1; i < 15; i += 1) {
    ast = binary("and", ast, id(name));
  }
  const expected = Array.from({ length: 15 }, () => name).join(" AND ");
  expect(expected).toHaveLength(1030);
  expect(printExpression(ast)).toBe(expected);
});
it("ignores every position and preserves frozen input while printing deterministically", () => {
  const ast = binary("add", id("a"), num(2));
  const alternate: ExpressionAst = {
    type: "binary",
    op: "add",
    pos: { start: 101, end: 200 },
    left: { type: "ident", name: "a", pos: { start: 130, end: 131 } },
    right: { type: "literal", kind: "num", value: 2, pos: { start: 190, end: 191 } },
  };
  const before = JSON.stringify(ast);
  expect(printExpression(ast)).toBe("a + 2");
  expect(printExpression(alternate)).toBe("a + 2");
  expect(printExpression(ast)).toBe("a + 2");
  expect(JSON.stringify(ast)).toBe(before);
});

it.each([
  [num(0.0000001), "0.0000001"],
  [num(0.00000012), "0.00000012"],
  [num(Number.MIN_VALUE), "0." + "0".repeat(323) + "5"],
  [num(999999999999999), "999999999999999"],
  [{ type: "literal", kind: "pct", value: 0.0000001, pos }, "0.0000001%"],
  [{ type: "literal", kind: "pct", value: 0.5, pos }, "0.5%"],
] satisfies readonly (readonly [ExpressionAst, string])[])(
  "prints numeric data in admitted decimal syntax as %s",
  (ast, expected) => {
    expect(printExpression(ast)).toBe(expected);
  },
);
it.each([
  ["", '""'],
  ['double " quote', '"double \\" quote"'],
  ["it's", `"it's"`],
  ["a\\b", '"a\\\\b"'],
  ["line\n\tend", String.raw`"line\n\tend"`],
  ["\b", String.raw`"\u0008"`],
  ["\f", String.raw`"\u000c"`],
  ["\r", String.raw`"\u000d"`],
  [String.raw`\b\f\r\n`, String.raw`"\\b\\f\\r\\n"`],
  ["\\\b", String.raw`"\\\u0008"`],
  ["\u0000\u000b", String.raw`"\u0000\u000b"`],
  ["Hello Ω 😀", '"Hello Ω 😀"'],
  ["\ud800", String.raw`"\ud800"`],
  ["\udfff", String.raw`"\udfff"`],
] as const)("preserves string data using only admitted escapes: %s", (value, expected) => {
  expect(printExpression({ type: "literal", kind: "str", value, pos })).toBe(expected);
});
it("prints all bounded arguments, array entries, string data and depth without omissions", () => {
  expect(
    printExpression(
      call(
        "f",
        Array.from({ length: 8 }, (_, i) => num(i)),
      ),
    ),
  ).toBe("f(0, 1, 2, 3, 4, 5, 6, 7)");
  expect(printExpression(array(Array.from({ length: 50 }, (_, i) => num(i))))).toBe(
    "[" + Array.from({ length: 50 }, (_, i) => String(i)).join(", ") + "]",
  );
  const value = "x".repeat(998);
  expect(printExpression({ type: "literal", kind: "str", value, pos })).toBe('"' + value + '"');
  let deep = id("x");
  for (let i = 0; i < 19; i += 1) {
    deep = unary("not", deep);
  }
  expect(printExpression(deep)).toBe("NOT ".repeat(19) + "x");
});
