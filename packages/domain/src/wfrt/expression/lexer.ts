import { err, ok, type Result } from "@overmind/contracts";
import { binarySyntax, unarySyntax, type ExprSyntaxError, type Token } from "./ast.ts";
import { expressionLimits } from "./limits.ts";

const aliases = [...Object.values(binarySyntax), ...Object.values(unarySyntax)].flatMap<string>(
  ({ aliases }) => aliases,
);
const keywords = new Set([
  "true",
  "false",
  "null",
  ...aliases.filter((alias) => /^[A-Za-z]+$/.test(alias)),
]);
const symbols = new Set([
  "(",
  ")",
  "[",
  "]",
  ",",
  ".",
  ...aliases.filter((alias) => !/^[A-Za-z]+$/.test(alias)),
]);

function failure(code: ExprSyntaxError["code"], start: number, end: number, limit?: string) {
  return err<ExprSyntaxError[]>([{ code, pos: { start, end }, ...(limit ? { limit } : {}) }]);
}

const escapes = new Map<string, string>([
  ["\\", "\\"],
  ["'", "'"],
  ['"', '"'],
  ["n", "\n"],
  ["t", "\t"],
]);

function readString(
  source: string,
  start: number,
): Result<Readonly<{ value: string; end: number }>, ExprSyntaxError[]> {
  const quote = source.charAt(start);
  let index = start + 1;
  let value = "";
  while (index < source.length) {
    const character = source.charAt(index++);
    if (character === quote) {
      return ok({ value, end: index });
    }
    if (character === "\n" || character === "\r") {
      return failure("expr.illegal_character", index - 1, index);
    }
    if (character === "\\") {
      const escapeStart = index - 1;
      if (index === source.length) {
        return failure("expr.unterminated_string", start, index);
      }
      const escape = source.charAt(index++);
      if (escape === "u") {
        const digits = source.slice(index, index + 4);
        if (!/^[0-9A-Fa-f]{4}$/.test(digits)) {
          return failure("expr.illegal_character", escapeStart, Math.min(source.length, index + 4));
        }
        value += String.fromCharCode(Number.parseInt(digits, 16));
        index += 4;
      } else {
        const decoded = escapes.get(escape);
        if (decoded === undefined) {
          return failure("expr.illegal_character", escapeStart, index);
        }
        value += decoded;
      }
    } else {
      value += character;
    }
  }
  return failure("expr.unterminated_string", start, source.length);
}

export function lex(source: string): Result<readonly Token[], ExprSyntaxError[]> {
  if (source.length > expressionLimits.sourceLength) {
    return failure("expr.too_complex", 0, source.length, "sourceLength");
  }
  const tokens: Token[] = [];
  let index = 0;
  const emit = (token: Token) => {
    tokens.push(Object.freeze({ ...token, pos: Object.freeze(token.pos) }));
  };
  while (index < source.length) {
    if (" \t\n".includes(source.charAt(index))) {
      index++;
      continue;
    }
    const start = index;
    if (source.charAt(index) === '"' || source.charAt(index) === "'") {
      // Decoding cannot increase length; the raw 1000 cap also bounds string content.
      const string = readString(source, start);
      if (!string.ok) {
        return string;
      }
      index = string.value.end;
      emit({ kind: "STRING", value: string.value.value, pos: { start, end: index } });
      continue;
    }
    if (/[0-9]/.test(source.charAt(index))) {
      while (index < source.length && /[0-9]/.test(source.charAt(index))) {
        index++;
      }
      if (source[index] === "." && /[0-9]/.test(source.charAt(index + 1))) {
        index++;
        while (index < source.length && /[0-9]/.test(source.charAt(index))) {
          index++;
        }
      }
      const literal = source.slice(start, index);
      const kind = source[index] === "%" ? "PERCENT" : "NUMBER";
      if (kind === "PERCENT") {
        index++;
      }
      if (literal.replace(".", "").replace(/^0+/, "").length > expressionLimits.numberDigits) {
        return failure("expr.too_complex", start, index, "numberDigits");
      }
      emit({ kind, value: Number(literal), pos: { start, end: index } });
      continue;
    }
    if (/[A-Za-z_]/.test(source.charAt(index))) {
      index++;
      while (index < source.length && /[A-Za-z0-9_]/.test(source.charAt(index))) {
        index++;
      }
      if (index - start > expressionLimits.identifierLength) {
        return failure("expr.too_complex", start, index, "identifierLength");
      }
      const value = source.slice(start, index);
      emit({ kind: keywords.has(value) ? "KEYWORD" : "IDENT", value, pos: { start, end: index } });
      continue;
    }
    const pair = source.slice(index, index + 2);
    const symbol = symbols.has(pair) ? pair : source.charAt(index);
    if (symbols.has(symbol)) {
      index += symbol.length;
      emit({ kind: "SYMBOL", value: symbol, pos: { start, end: index } });
      continue;
    }
    return failure("expr.illegal_character", start, start + 1);
  }
  emit({ kind: "EOF", value: null, pos: { start: index, end: index } });
  return ok(Object.freeze(tokens));
}
