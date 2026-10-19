# Workflow expression grammar

Expressions are data parsed by the pure Domain `parseExpression` API. The parser
returns a frozen, JSON-serialisable AST or one positioned error; it never runs
source. Evaluation and callable permissions belong to WFRT016, typing to WFRT017.

## Grammar

```ebnf
expr    = or ;
or      = and { ("or"|"OR"|"||") and } ;
and     = not { ("and"|"AND"|"&&") not } ;
not     = ("not"|"NOT"|"!") not | cmp ;
cmp     = add [ ("="|"=="|"!="|"<>"|"<"|"<="|">"|">="|"in"|"IN") add ] ;
add     = mul { ("+"|"-") mul } ;
mul     = unary { ("*"|"/") unary } ;
unary   = "-" unary | postfix ;
postfix = primary { "." IDENT | "[" expr "]" } ;
primary = NUMBER | PERCENT | STRING | "true" | "false" | "null"
        | IDENT [ "(" [ expr { "," expr } ] ")" ]
        | "(" expr ")" | "[" [ expr { "," expr } ] "]" ;
```

Whitespace is space, tab or newline. NUMBER uses `[0-9]+(\.[0-9]+)?`, at most
15 significant digits, without exponent or leading plus. PERCENT immediately
appends `%`: `100%` retains numeric value **100**, on the original 0–100 scale.
IDENT uses `[A-Za-z_][A-Za-z0-9_]*`, at most 64 characters. Single/double quoted
STRING accepts `\\`, `\'`, `\"`, `\n`, `\t`, `\uXXXX`; raw newlines deny. Strings
may contain Unicode data; Unicode operators and identifiers are never normalised.
Keywords are exact lower/upper spellings above; `true`, `false`, `null` are lower
case only. `And` remains an identifier. Comments are unsupported.

## Precedence and canonical text

| Order, low to high | Operators | Association |
| --- | --- | --- |
| 1 | OR, or, `\|\|` | Left |
| 2 | AND, and, `&&` | Left |
| 3 | NOT, not, `!` | Prefix |
| 4 | `= == != <> < <= > >=`, IN, in | Non-associative |
| 5 | `+ -` | Left |
| 6 | `* /` | Left |
| 7 | Unary `-` | Prefix |
| 8 | Member/index postfix | Left |

Thus `NOT score = 7` negates the comparison. `a < b < c` denies; explicit
parentheses can express nested comparisons for later type checking. Canonical
printing uses uppercase AND/OR/NOT/IN, `=`/`!=`, deterministic spaces, decimal
numbers, preserved percent kind and necessary semantic grouping. It never
truncates data. Position fields are UTF-16 start-inclusive/end-exclusive offsets;
parenthesised root spans include delimiters. Roundtrip compares all semantic
fields while positions are tested separately for each input.

## Specification examples

SPECIFICATION §7 has one combined Quality Gate condition with three clauses:

```text
testsPassed = 100% AND criticalVulnerabilities = 0 AND seniorReview = approved
```

Each clause also parses independently: `testsPassed = 100%`,
`criticalVulnerabilities = 0`, `seniorReview = approved`. The IF example is
`input.score >= 7 AND len(input.issues) = 0`. Barewords are identifiers; parsing
does not decide their values, types or whether a function is callable.

## Admission and deliberate omissions

Raw source is bounded to 1000 UTF-16 units before lexing. AST limits are 200 nodes,
depth 20 (including binary/postfix chains), eight arguments and 50 array items.
Recursive descent is guarded before entering deeper syntax; parentheses are also
bounded to 20 separately: grouping creates no extra AST node. Every original
bound is checked before canonical admission: full printed
text must fit the additional Owner-approved **canonicalSourceLength 1000** cap.
Excess returns `expr.too_complex` with that limit and the whole original span.
For example, fifteen 64-character identifiers joined by `&&` use raw length 988,
29 nodes/depth 15, but canonical length 1030 and therefore deny.

The parser rejects reserved IDENT/member/call names `__proto__`, `constructor`,
`prototype`, `this`, `eval`, `Function`. String literal data remains data.
No assignment, chained comparison, method/value call, object, ternary, lambda,
function definition, regular expression, template, modulo or exponent syntax is
available. This small grammar prevents source execution and ambient capabilities.
Only WFRT016's function table may extend callable names; no other module may add
syntax. WFRT015 retains final combined acceptance after its prerequisites merge.
