export type Position = Readonly<{ start: number; end: number }>;
type Node<T> = Readonly<T & { pos: Position }>;
export type Literal = Node<
  | { type: "literal"; kind: "num" | "pct"; value: number }
  | { type: "literal"; kind: "str"; value: string }
  | { type: "literal"; kind: "bool"; value: boolean }
  | { type: "literal"; kind: "null"; value: null }
>;
export type ExpressionAst =
  | Literal
  | Node<{ type: "ident"; name: string }>
  | Node<{ type: "member"; object: ExpressionAst; property: string }>
  | Node<{ type: "index"; object: ExpressionAst; index: ExpressionAst }>
  | Node<{ type: "call"; name: string; args: readonly ExpressionAst[] }>
  | Node<{ type: "unary"; op: "-" | "not"; argument: ExpressionAst }>
  | Node<{ type: "binary"; op: BinaryOperator; left: ExpressionAst; right: ExpressionAst }>
  | Node<{ type: "array"; items: readonly ExpressionAst[] }>;
export type Token = Node<
  | { kind: "NUMBER" | "PERCENT"; value: number }
  | { kind: "STRING" | "IDENT" | "KEYWORD" | "SYMBOL"; value: string }
  | { kind: "EOF"; value: null }
>;
export type ExprSyntaxError = Readonly<{
  code:
    | "expr.empty"
    | "expr.illegal_character"
    | "expr.unterminated_string"
    | "expr.unexpected_token"
    | "expr.forbidden_identifier"
    | "expr.too_complex";
  pos: Position;
  expected?: readonly string[];
  limit?: string;
}>;
function operator<const T extends readonly string[]>(aliases: T, precedence: number) {
  return Object.freeze({ aliases: Object.freeze(aliases), precedence });
}
// The first alias is canonical. NOT binds below comparisons; unary minus binds above multiplication.
export const binarySyntax = Object.freeze({
  or: operator(["OR", "or", "||"], 1),
  and: operator(["AND", "and", "&&"], 2),
  eq: operator(["=", "=="], 4),
  ne: operator(["!=", "<>"], 4),
  lt: operator(["<"], 4),
  le: operator(["<="], 4),
  gt: operator([">"], 4),
  ge: operator([">="], 4),
  in: operator(["IN", "in"], 4),
  add: operator(["+"], 5),
  sub: operator(["-"], 5),
  mul: operator(["*"], 6),
  div: operator(["/"], 6),
});
export type BinaryOperator = keyof typeof binarySyntax;
export const unarySyntax = Object.freeze({
  not: operator(["NOT", "not", "!"], 3),
  "-": operator(["-"], 7),
});
