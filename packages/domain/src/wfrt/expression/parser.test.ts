import { describe, expect, it } from "vitest";
import type { ExpressionAst } from "./ast.ts";
import { parseExpression } from "./parser.ts";
import { printExpression } from "./print.ts";

function admitted(source: string): ExpressionAst {
  const result = parseExpression(source);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("Expected an admitted test expression");
  }
  return result.value;
}

describe("public bounded expression parser", () => {
  it("returns a frozen positioned numeric literal", () => {
    const node = admitted("42");
    expect(node).toEqual({ type: "literal", kind: "num", value: 42, pos: { start: 0, end: 2 } });
    expect(Object.isFrozen(node)).toBe(true);
    expect(Object.isFrozen(node.pos)).toBe(true);
  });

  it("binds NOT below comparison using the shared spelling metadata", () => {
    const node = admitted("not score=7");
    expect(node.type).toBe("unary");
    expect(printExpression(node)).toBe("NOT score = 7");
  });

  it("parses the actual specification Gate condition with its three clauses", () => {
    const source = "testsPassed = 100% AND criticalVulnerabilities = 0 AND seniorReview = approved";
    const node = admitted(source);
    expect(node.pos).toEqual({ start: 0, end: source.length });
    expect(printExpression(node)).toBe(source);
  });
});

const validGrammar = [
  "0",
  "100%",
  "0.25",
  "'text'",
  '"not"',
  '"-"',
  '"constructor"',
  "true",
  "false",
  "null",
  "And",
  "Not",
  "TRUE",
  "score",
  "(42)",
  "((true))",
  "[]",
  "[1]",
  "[1, true, null, 'a']",
  "f()",
  "f(1, 2)",
  "unknownGlobal(score)",
  "a.b",
  "a[0]",
  "a[1 + 2].b",
  "[1, 2][0]",
  "f().value",
  "f()[0]",
  "-1",
  "--1",
  "-(1 + 2)",
  "NOT true",
  "!!true",
  "not a = b",
  "!(a OR b)",
  "a+b*c",
  "(a+b)*c",
  "a-(b-c)",
  "a/(b/c)",
  "a==b",
  "a<>b",
  "a!=b",
  "a<=b",
  "a>=b",
  "a in [1]",
  "a IN [1]",
  "a && b || c",
  "a and b OR c",
  "a<b AND c<d AND e<f",
  "a < (b < c)",
  "(a < b) < c",
  "input.score >= 7 AND len(input.issues) = 0",
  '"\\u0008\\u000c\\u000d"',
  '"\\\\b"',
  '"zażółć😀"',
  "a['constructor']",
] as const;
const invalidGrammar = [
  "",
  "   ",
  "(",
  ")",
  "[",
  "]",
  "[1,]",
  "[,1]",
  "[1 2]",
  "f(,1)",
  "f(1,)",
  "f(1 2)",
  "f(1",
  "a.",
  "a[]",
  "a[0",
  "a.b()",
  "f()()",
  "(f)(1)",
  "true(1)",
  "a<b<c",
  "a=b=c",
  "a<b=c",
  "a IN b IN c",
  "a ? b : c",
  "{a:1}",
  "a:=b",
  "a += 1",
  "1e3",
  "`text`",
  "/regex/",
  "x=>x",
  "a;b",
  "a b",
  "1 + NOT true",
  "-NOT true",
  'a "AND" b',
  'a "=" b',
  "__proto__",
  "constructor",
  "prototype",
  "this",
  "eval",
  "Function",
  "a.__proto__",
  "a.constructor",
  "a.prototype",
  "a.this",
  "a.eval",
  "a.Function",
  "__proto__()",
  "constructor()",
  "prototype()",
  "this()",
  "eval()",
  "Function()",
] as const;
describe("complete grammar admission", () => {
  it.each(validGrammar)("admits %s", (source) => {
    expect(parseExpression(source).ok).toBe(true);
  });
  it.each(invalidGrammar)("denies %s", (source) => {
    const result = parseExpression(source);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toHaveLength(1);
    }
  });
  it("reports a forbidden member token without copying source", () => {
    expect(parseExpression("safe.constructor")).toEqual({
      ok: false,
      error: [{ code: "expr.forbidden_identifier", pos: { start: 5, end: 16 } }],
    });
  });
  it("keeps postfix, call and parenthesized positions and child arrays frozen", () => {
    const root = admitted("(f(1, [2])).x[0]");
    expect(root.pos).toEqual({ start: 0, end: 16 });
    const visit = (value: unknown): void => {
      if (typeof value !== "object" || value === null) {
        return;
      }
      expect(Object.isFrozen(value)).toBe(true);
      for (const child of Object.values(value)) {
        visit(child);
      }
    };
    visit(root);
    expect(admitted("  a.b ")).toEqual({
      type: "member",
      object: {
        type: "ident",
        name: "a",
        pos: { start: 2, end: 3 },
      },
      property: "b",
      pos: { start: 2, end: 5 },
    });
  });
});
function deniedLimit(source: string, limit: string): void {
  expect(parseExpression(source)).toEqual({
    ok: false,
    error: [
      {
        code: "expr.too_complex",
        limit,
        pos: { start: 0, end: source.length },
      },
    ],
  });
}
describe("original resource boundaries and canonical admission", () => {
  it("admits raw 1000 and denies 1001 before scanning", () => {
    admitted(" ".repeat(999) + "1");
    deniedLimit(" ".repeat(1000) + "1", "sourceLength");
  });
  it("admits eight call arguments and denies nine", () => {
    admitted("f(" + Array(8).fill("1").join(",") + ")");
    deniedLimit("f(" + Array(9).fill("1").join(",") + ")", "arguments");
  });
  it("admits fifty array entries and denies fifty-one", () => {
    admitted("[" + Array(50).fill("1").join(",") + "]");
    deniedLimit("[" + Array(51).fill("1").join(",") + "]", "arrayItems");
  });
  it("counts exact 200 and 201 produced nodes independently from depth", () => {
    const source = (first: number) =>
      "[f(" + Array(first).fill("1").join(",") + ")," + Array(48).fill("f(1,1,1)").join(",") + "]";
    admitted(source(6));
    deniedLimit(source(7), "nodes");
  });
  it.each([
    (n: number) => Array(n).fill("a").join("+"),
    (n: number) => "a" + ".b".repeat(n - 1),
    (n: number) => "-".repeat(n - 1) + "1",
    (n: number) => "NOT ".repeat(n - 1) + "true",
    (n: number) => "[".repeat(n - 1) + "1" + "]".repeat(n - 1),
    (n: number) => "f(".repeat(n - 1) + "1" + ")".repeat(n - 1),
  ])("bounds actual AST depth, including iterative chains", (source) => {
    admitted(source(20));
    deniedLimit(source(21), "depth");
  });
  it("bounds parenthesized recursion before descent", () => {
    admitted("(".repeat(20) + "1" + ")".repeat(20));
    deniedLimit("(".repeat(21) + "1" + ")".repeat(21), "depth");
    deniedLimit("(".repeat(499) + "1" + ")".repeat(499), "depth");
  });
  it("admits canonical 1000 and rejects 1001 without relaxing raw bounds", () => {
    const names = Array<string>(15).fill("a".repeat(62));
    const source = names.join("&&");
    expect(printExpression(admitted(source))).toHaveLength(1000);
    names[0] = "a".repeat(63);
    const over = names.join("&&");
    expect(over.length).toBeLessThan(1000);
    deniedLimit(over, "canonicalSourceLength");
  });
  it("preserves the actual raw988/29node/depth15 canonical1030 counterexample", () => {
    const source = Array<string>(15).fill("a".repeat(64)).join("&&");
    expect(source).toHaveLength(988);
    deniedLimit(source, "canonicalSourceLength");
  });
  it("denies million parentheses and 10MB strings without stack overflow", () => {
    deniedLimit("(".repeat(1_000_000), "sourceLength");
    deniedLimit("x".repeat(10 * 1024 * 1024), "sourceLength");
  });
  it.each([
    ["", "expr.empty", 0, 0],
    ["   ", "expr.empty", 0, 3],
    ["'open", "expr.unterminated_string", 0, 5],
    ["1 @ 2", "expr.illegal_character", 2, 3],
    ["1 +", "expr.unexpected_token", 3, 3],
    ["a b", "expr.unexpected_token", 2, 3],
  ] as const)("returns one positioned safe error for %s", (source, code, start, end) => {
    expect(parseExpression(source)).toEqual({ ok: false, error: [{ code, pos: { start, end } }] });
  });
});
function semantic(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(semantic);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "pos")
      .map(([key, child]) => [key, semantic(child)]),
  );
}
it("roundtrips every bounded fixed-seed AST without filtering or discarding fixtures", () => {
  let seed = 0x6042026;
  const next = (max: number): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % max;
  };
  const pos = { start: 123, end: 456 };
  const operators = [
    "or",
    "and",
    "eq",
    "ne",
    "lt",
    "le",
    "gt",
    "ge",
    "in",
    "add",
    "sub",
    "mul",
    "div",
  ] as const;
  const build = (depth: number): ExpressionAst => {
    switch (next(depth === 0 ? 6 : 12)) {
      case 0:
        return { type: "literal", kind: "num", value: next(100) / 10, pos };
      case 1:
        return { type: "literal", kind: "pct", value: next(101), pos };
      case 2:
        return {
          type: "literal",
          kind: "str",
          value: ["\b\f\r", "\\b", "😀\ud800", "constructor"][next(4)] ?? "",
          pos,
        };
      case 3:
        return { type: "literal", kind: "bool", value: next(2) === 0, pos };
      case 4:
        return { type: "literal", kind: "null", value: null, pos };
      case 5:
        return { type: "ident", name: "score", pos };
      case 6:
        return { type: "member", object: build(depth - 1), property: "value", pos };
      case 7:
        return { type: "index", object: build(depth - 1), index: build(depth - 1), pos };
      case 8:
        return {
          type: "call",
          name: "futureFunction",
          args: Array.from({ length: next(4) }, () => build(depth - 1)),
          pos,
        };
      case 9:
        return {
          type: "array",
          items: Array.from({ length: next(4) }, () => build(depth - 1)),
          pos,
        };
      case 10:
        return { type: "unary", op: next(2) === 0 ? "not" : "-", argument: build(depth - 1), pos };
      default:
        return {
          type: "binary",
          op: operators[next(operators.length)] ?? "add",
          left: build(depth - 1),
          right: build(depth - 1),
          pos,
        };
    }
  };
  for (let index = 0; index < 400; index++) {
    const expected = build(4);
    const source = printExpression(expected);
    expect(source.length).toBeLessThanOrEqual(1000);
    const actual = admitted(source);
    expect(semantic(actual)).toEqual(semantic(expected));
    expect(semantic(admitted(printExpression(actual)))).toEqual(semantic(actual));
    expect(printExpression(actual)).toBe(source);
  }
});
it("assigns exact child positions separately from semantic properties", () => {
  expect(admitted("f(1, [2])")).toEqual({
    type: "call",
    name: "f",
    pos: { start: 0, end: 9 },
    args: [
      { type: "literal", kind: "num", value: 1, pos: { start: 2, end: 3 } },
      {
        type: "array",
        pos: { start: 5, end: 8 },
        items: [{ type: "literal", kind: "num", value: 2, pos: { start: 6, end: 7 } }],
      },
    ],
  });
});
it("preserves percent scale and leading-zero decimal values", () => {
  expect(admitted("100%")).toMatchObject({ kind: "pct", value: 100 });
  expect(admitted("000.0000001")).toMatchObject({ kind: "num", value: 0.0000001 });
});
it.each([
  "`",
  "$",
  "{",
  "}",
  ";",
  "@",
  "#",
  "\\",
  "?",
  ":",
  "~",
  "^",
  "&",
  "|",
  "＝",
  "а",
  "\u200b",
  "\u202e",
])("denies illegal character %s without normalization", (source) => {
  expect(parseExpression(source)).toEqual({
    ok: false,
    error: [{ code: "expr.illegal_character", pos: { start: 0, end: source.length } }],
  });
});

it("preserves original identifier and significant-digit boundaries", () => {
  admitted("a".repeat(64));
  deniedLimit("a".repeat(65), "identifierLength");
  admitted("999999999999999");
  deniedLimit("9999999999999999", "numberDigits");
});

const rightNestedAddition = (count: number): string =>
  "a+(".repeat(count) + "a" + ")".repeat(count);
it.each([11, 19])("admits original AST/group bounds without double-counting RHS at %s", (count) => {
  const source = rightNestedAddition(count);
  if (count === 11) {
    expect(source).toHaveLength(45);
  }
  const parsed = admitted(source);
  const canonical = printExpression(parsed);
  expect(semantic(admitted(canonical))).toEqual(semantic(parsed));
  expect(printExpression(admitted(canonical))).toBe(canonical);
});
it("still denies the twenty-first produced node level in a right-associated tree", () => {
  deniedLimit(rightNestedAddition(20), "depth");
});
it.each([
  (count: number, leaf: string) => "-".repeat(count) + leaf,
  (count: number, leaf: string) => "f(".repeat(count) + leaf + ")".repeat(count),
  (count: number, leaf: string) => "a[".repeat(count) + leaf + "]".repeat(count),
  (count: number, leaf: string) => "[".repeat(count) + leaf + "]".repeat(count),
])("keeps original grouping and structural20/21 checks independent in mixed syntax", (wrap) => {
  const group = (count: number) => "(".repeat(count) + "1" + ")".repeat(count);
  const parsed = admitted(wrap(19, group(20)));
  expect(semantic(admitted(printExpression(parsed)))).toEqual(semantic(parsed));
  deniedLimit(wrap(20, group(20)), "depth");
  deniedLimit(wrap(19, group(21)), "depth");
});
