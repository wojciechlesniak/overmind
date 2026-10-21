// SPDX-License-Identifier: Apache-2.0
import ts from "typescript";
export function suppressionPositions(source: ts.SourceFile): number[] {
  const positions = new Set<number>();
  const textRanges: ts.JsxText[] = [];
  const inspect = (start: number, end: number, kind: ts.CommentKind) => {
    const body = source.text
      .slice(start + 2, end - (kind === ts.SyntaxKind.MultiLineCommentTrivia ? 2 : 0))
      .trim();
    const disable = /^eslint-disable(?:-next-line|-line)?(?:\s|$)([\s\S]*)/.exec(body);
    if (
      (disable && suppressesBoundary(disable[1] ?? "")) ||
      (/^eslint\s/.test(body) && reconfiguresBoundary(body.slice(6)))
    ) {
      positions.add(start);
    }
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      textRanges.push(node);
      return;
    }
    if (ts.isJsxExpression(node)) {
      ts.forEachTrailingCommentRange(source.text, node.getStart(source) + 1, inspect);
    }
    ts.forEachTrailingCommentRange(source.text, node.pos, inspect);
    ts.forEachLeadingCommentRange(source.text, node.pos, inspect);
    ts.forEachTrailingCommentRange(source.text, node.end, inspect);
    ts.forEachChild(node, visit);
  };
  visit(source);
  textRanges.sort((left, right) => left.pos - right.pos);
  let range = 0;
  return [...positions]
    .sort((left, right) => left - right)
    .filter((position) => {
      let current = textRanges[range];
      while (current && current.end <= position) {
        current = textRanges[++range];
      }
      return !current || position < current.pos;
    });
}

function reconfiguresBoundary(text: string): boolean {
  const trimmed = withoutDescription(text).trim();
  const configuration =
    trimmed.startsWith("{") && trimmed.endsWith("}") ? trimmed.slice(1, -1) : trimmed;
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    configuration,
  );
  let depth = 0;
  let propertyStart = 0;
  let previousTokenEnd = 0;
  let previousString: string | undefined;
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    const tokenStart = scanner.getTokenStart();
    if (
      depth === 0 &&
      (token === ts.SyntaxKind.Identifier || token === ts.SyntaxKind.StringLiteral) &&
      tokenStart > previousTokenEnd &&
      configuration.slice(previousTokenEnd, tokenStart).trim().length === 0
    ) {
      propertyStart = tokenStart;
    }
    if (depth === 0 && token === ts.SyntaxKind.ColonToken) {
      const name =
        previousString ?? configuration.slice(propertyStart, scanner.getTokenStart()).trim();
      if (isBoundaryRule(name)) {
        return true;
      }
    }
    if (depth === 0 && token === ts.SyntaxKind.CommaToken) {
      propertyStart = scanner.getTokenEnd();
    }
    if (depth === 0) {
      previousString = token === ts.SyntaxKind.StringLiteral ? scanner.getTokenValue() : undefined;
    }
    if (
      token === ts.SyntaxKind.OpenBraceToken ||
      token === ts.SyntaxKind.OpenBracketToken ||
      token === ts.SyntaxKind.OpenParenToken
    ) {
      depth++;
    } else if (
      token === ts.SyntaxKind.CloseBraceToken ||
      token === ts.SyntaxKind.CloseBracketToken ||
      token === ts.SyntaxKind.CloseParenToken
    ) {
      depth--;
    }
    previousTokenEnd = scanner.getTokenEnd();
  }
  return false;
}

function withoutDescription(text: string): string {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text);
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    const position = scanner.getTokenStart();
    if (
      token === ts.SyntaxKind.MinusMinusToken &&
      /\s/u.test(text.slice(position - 1, position)) &&
      /^--+(?:\s|$)/u.test(text.slice(position))
    ) {
      return text.slice(0, position);
    }
  }
  return text;
}

function isBoundaryRule(name: string): boolean {
  return name === "boundaries" || name.startsWith("boundaries/");
}

function suppressesBoundary(text: string): boolean {
  if (text.trimStart().startsWith("--")) {
    return true;
  }
  const names = withoutDescription(text)
    .split(",")
    .map((part) => {
      const name = part.trim();
      const quote = name[0];
      return name.length >= 2 && (quote === '"' || quote === "'") && name.at(-1) === quote
        ? name.slice(1, -1)
        : name;
    })
    .filter((name) => name.length > 0);
  return names.length === 0 || names.some(isBoundaryRule);
}
