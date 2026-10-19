import { expect, it } from "vitest";
import { binarySyntax, unarySyntax } from "./ast.ts";
import { expressionLimits } from "./limits.ts";
import { lex } from "./lexer.ts";

it("tokenises empty input as positioned EOF without claiming expression admission", () => {
  expect(lex("")).toEqual({
    ok: true,
    value: [{ kind: "EOF", value: null, pos: { start: 0, end: 0 } }],
  });
});
it("retains decimal value and exact whitespace offsets", () => {
  expect(lex(" \t12.5\n")).toEqual({
    ok: true,
    value: [
      { kind: "NUMBER", value: 12.5, pos: { start: 2, end: 6 } },
      { kind: "EOF", value: null, pos: { start: 7, end: 7 } },
    ],
  });
});
it("keeps adjacent percent kind and the original percentage scale", () => {
  expect(lex("100%")).toEqual({
    ok: true,
    value: [
      { kind: "PERCENT", value: 100, pos: { start: 0, end: 4 } },
      { kind: "EOF", value: null, pos: { start: 4, end: 4 } },
    ],
  });
});

function values(source: string) {
  const result = lex(source);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("Expected lexical success");
  }
  return result.value.slice(0, -1).map(({ kind, value }) => ({ kind, value }));
}

it.each(["and", "AND", "or", "OR", "not", "NOT", "in", "IN", "true", "false", "null"])(
  "recognises exact keyword %s",
  (word) => {
    expect(values(word)).toEqual([{ kind: "KEYWORD", value: word }]);
  },
);
it.each(["And", "Or", "Not", "In", "TRUE", "FALSE", "NULL", "_a0", "constructor", "__proto__"])(
  "keeps context-free identifier %s",
  (word) => {
    expect(values(word)).toEqual([{ kind: "IDENT", value: word }]);
  },
);
it.each([
  "=",
  "==",
  "!=",
  "<>",
  "<",
  "<=",
  ">",
  ">=",
  "+",
  "-",
  "*",
  "/",
  "&&",
  "||",
  "!",
  "(",
  ")",
  "[",
  "]",
  ",",
  ".",
])("scans exact symbol %s", (symbol) => {
  expect(lex(symbol)).toEqual({
    ok: true,
    value: [
      { kind: "SYMBOL", value: symbol, pos: { start: 0, end: symbol.length } },
      { kind: "EOF", value: null, pos: { start: symbol.length, end: symbol.length } },
    ],
  });
});
it("denies a percent separated from its number", () => {
  expect(lex("2 %")).toEqual({
    ok: false,
    error: [{ code: "expr.illegal_character", pos: { start: 2, end: 3 } }],
  });
});
it("tokenises context-free decimal and comment-like boundaries", () => {
  expect(values("1. .5 1e3 //x")).toEqual([
    { kind: "NUMBER", value: 1 },
    { kind: "SYMBOL", value: "." },
    { kind: "SYMBOL", value: "." },
    { kind: "NUMBER", value: 5 },
    { kind: "NUMBER", value: 1 },
    { kind: "IDENT", value: "e3" },
    { kind: "SYMBOL", value: "/" },
    { kind: "SYMBOL", value: "/" },
    { kind: "IDENT", value: "x" },
  ]);
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
  "%",
  "\r",
  "\v",
  "\f",
  "\u00a0",
  "α",
  "１",
])("denies unsupported character class %#", (source) => {
  expect(lex(source)).toEqual({
    ok: false,
    error: [{ code: "expr.illegal_character", pos: { start: 0, end: 1 } }],
  });
});
it("stops at the first error without interpolating input", () => {
  expect(lex("@#")).toEqual({
    ok: false,
    error: [{ code: "expr.illegal_character", pos: { start: 0, end: 1 } }],
  });
});
it("checks raw source 1000/1001 before scanning an illegal prefix", () => {
  expect(lex(" ".repeat(1000))).toEqual({
    ok: true,
    value: [{ kind: "EOF", value: null, pos: { start: 1000, end: 1000 } }],
  });
  expect(lex("@" + " ".repeat(1000))).toEqual({
    ok: false,
    error: [{ code: "expr.too_complex", pos: { start: 0, end: 1001 }, limit: "sourceLength" }],
  });
});
it("admits identifier64 and denies65", () => {
  expect(values("a".repeat(64))).toEqual([{ kind: "IDENT", value: "a".repeat(64) }]);
  expect(lex("a".repeat(65))).toEqual({
    ok: false,
    error: [{ code: "expr.too_complex", pos: { start: 0, end: 65 }, limit: "identifierLength" }],
  });
});
it("bounds significant digits while excluding leading decimal zeros", () => {
  expect(values("000123456789012345 0.000123456789012345 0000")).toEqual([
    { kind: "NUMBER", value: 123456789012345 },
    { kind: "NUMBER", value: 0.000123456789012345 },
    { kind: "NUMBER", value: 0 },
  ]);
  expect(lex("1234567890123456%")).toEqual({
    ok: false,
    error: [{ code: "expr.too_complex", pos: { start: 0, end: 17 }, limit: "numberDigits" }],
  });
});
it("preserves the complete frozen policy and shared operator syntax", () => {
  expect(expressionLimits).toEqual({
    sourceLength: 1000,
    canonicalSourceLength: 1000,
    nodes: 200,
    depth: 20,
    arguments: 8,
    arrayItems: 50,
    identifierLength: 64,
    numberDigits: 15,
    stringLength: 1000,
  });
  expect(Object.isFrozen(expressionLimits)).toBe(true);
  expect(Object.values(binarySyntax).flatMap(({ aliases }) => aliases)).toEqual([
    "OR",
    "or",
    "||",
    "AND",
    "and",
    "&&",
    "=",
    "==",
    "!=",
    "<>",
    "<",
    "<=",
    ">",
    ">=",
    "IN",
    "in",
    "+",
    "-",
    "*",
    "/",
  ]);
  expect(Object.values(binarySyntax).map(({ precedence }) => precedence)).toEqual([
    1, 2, 4, 4, 4, 4, 4, 4, 4, 5, 5, 6, 6,
  ]);
  expect(unarySyntax).toEqual({
    not: { aliases: ["NOT", "not", "!"], precedence: 3 },
    "-": { aliases: ["-"], precedence: 7 },
  });
  expect(Object.isFrozen(binarySyntax)).toBe(true);
  expect(Object.isFrozen(unarySyntax)).toBe(true);
  for (const syntax of [...Object.values(binarySyntax), ...Object.values(unarySyntax)]) {
    expect(Object.isFrozen(syntax)).toBe(true);
    expect(Object.isFrozen(syntax.aliases)).toBe(true);
  }
});
it("returns frozen token arrays and exact positioned tokens", () => {
  const result = lex("2");
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("Expected lexical success");
  }
  expect(Object.isFrozen(result.value)).toBe(true);
  for (const token of result.value) {
    expect(Object.isFrozen(token)).toBe(true);
    expect(Object.isFrozen(token.pos)).toBe(true);
  }
});

it.each([
  ['"abc"', "abc"],
  ["'abc'", "abc"],
  ['""', ""],
  [String.raw`"a\n\t\u0041"`, "a\n\tA"],
  [String.raw`'\'\"\\'`, "'\"\\"],
  [String.raw`"\\b"`, "\\b"],
  [String.raw`"\u0008\u000C\u000D"`, "\b\f\r"],
  [String.raw`"\uD83D\uDE00\uD800"`, "😀\uD800"],
  ['"é😀\u202e"', "é😀\u202e"],
])("decodes only admitted string spelling %#", (source, value) => {
  expect(lex(source)).toEqual({
    ok: true,
    value: [
      { kind: "STRING", value, pos: { start: 0, end: source.length } },
      { kind: "EOF", value: null, pos: { start: source.length, end: source.length } },
    ],
  });
});
it.each([
  String.raw`"\b"`,
  String.raw`"\f"`,
  String.raw`"\r"`,
  String.raw`"\x00"`,
  String.raw`"\q"`,
])("denies unsupported string escape %#", (source) => {
  expect(lex(source)).toEqual({
    ok: false,
    error: [{ code: "expr.illegal_character", pos: { start: 1, end: 3 } }],
  });
});
it.each([String.raw`"\u12G4"`, String.raw`"\u123"`])(
  "denies malformed four-digit Unicode escape %#",
  (source) => {
    expect(lex(source)).toEqual({
      ok: false,
      error: [{ code: "expr.illegal_character", pos: { start: 1, end: 7 } }],
    });
  },
);
it.each(['"a\nb"', '"a\rb"'])("denies raw string line breaks %#", (source) => {
  expect(lex(source)).toEqual({
    ok: false,
    error: [{ code: "expr.illegal_character", pos: { start: 2, end: 3 } }],
  });
});
it.each(['"abc', "'abc", '"abc\\'])("positions unterminated strings %#", (source) => {
  expect(lex(source)).toEqual({
    ok: false,
    error: [{ code: "expr.unterminated_string", pos: { start: 0, end: source.length } }],
  });
});
it("admits the maximal reachable quoted string under the unchanged raw cap", () => {
  const source = '"' + "a".repeat(998) + '"';
  expect(values(source)).toEqual([{ kind: "STRING", value: "a".repeat(998) }]);
  expect(lex('"' + "a".repeat(999) + '"')).toEqual({
    ok: false,
    error: [{ code: "expr.too_complex", pos: { start: 0, end: 1001 }, limit: "sourceLength" }],
  });
});
it("keeps offsets after decoded escapes and astral string data", () => {
  expect(lex(String.raw` "😀\n" x`)).toEqual({
    ok: true,
    value: [
      { kind: "STRING", value: "😀\n", pos: { start: 1, end: 7 } },
      { kind: "IDENT", value: "x", pos: { start: 8, end: 9 } },
      { kind: "EOF", value: null, pos: { start: 9, end: 9 } },
    ],
  });
});

it("rejects very large source before token allocation or recursion", () => {
  expect(lex("(".repeat(1_000_000))).toEqual({
    ok: false,
    error: [{ code: "expr.too_complex", pos: { start: 0, end: 1_000_000 }, limit: "sourceLength" }],
  });
});
it("decodes Unicode backslash data once rather than interpreting it again", () => {
  expect(values(String.raw`"\u005Cn"`)).toEqual([{ kind: "STRING", value: "\\n" }]);
});
it.each(["\u200b", "\u202e", "＆", "＝", "＜", "＞", "！", "−", "×", "÷"])(
  "does not normalise non-ASCII syntax %#",
  (source) => {
    expect(lex(source)).toEqual({
      ok: false,
      error: [{ code: "expr.illegal_character", pos: { start: 0, end: 1 } }],
    });
  },
);
