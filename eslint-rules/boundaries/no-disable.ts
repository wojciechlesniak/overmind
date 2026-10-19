// SPDX-License-Identifier: Apache-2.0
import type { Rule } from "eslint";
import ts from "typescript";
/** The consumer must also use the native allowInlineConfig:false caller option. */
export const noDisable: (root: string) => Rule.RuleModule = () => {
  return {
    meta: {
      schema: [],
      messages: {
        BOUNDARY_NO_DISABLE: "File a proposal and ADR instead of disabling boundary rules.",
      },
    },
    create(context) {
      return {
        Program() {
          for (const comment of context.sourceCode.getAllComments()) {
            const value = (comment.value.split(/\s-{2,}\s/u, 1)[0] ?? "").trim();
            const disable = /^eslint-disable(?:-next-line|-line)?(?:\s|$)([\s\S]*)$/u.exec(value);
            const configuration = /^eslint\s+([\s\S]*)$/u.exec(value);
            const rules = disable?.[1]?.trim();
            if (
              (disable && (!rules || /(?:^|[\s,])boundaries\//u.test(rules))) ||
              (configuration && boundaryConfig(configuration[1] ?? ""))
            ) {
              if (!comment.loc) {
                throw new Error("Boundary comment location is unavailable.");
              }
              context.report({ loc: comment.loc, messageId: "BOUNDARY_NO_DISABLE" });
            }
          }
        },
      };
    },
  };
};

/** Decode quoted rule names as ESLint's JSON-like comments do; never execute input. */
function quotedName(raw: string): string {
  const controls: Readonly<Record<string, string>> = {
    b: "\b",
    f: "\f",
    n: "\n",
    r: "\r",
    t: "\t",
  };
  return raw
    .slice(1, -1)
    .replace(/\\([^u]|u[0-9a-fA-F]{4})/gu, (_match: string, escaped: string) =>
      escaped.startsWith("u")
        ? String.fromCharCode(Number.parseInt(escaped.slice(1), 16))
        : (controls[escaped] ?? escaped),
    );
}
/** Only top-level rule keys count, including escaped keys and commaless notation. */
function boundaryConfig(value: string): boolean {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    value,
  );
  let depth = 0;
  let mapDepth: number | undefined;
  let key = "";
  let end = 0;
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    mapDepth ??= token === ts.SyntaxKind.OpenBraceToken ? 1 : 0;
    if (token === ts.SyntaxKind.OpenBraceToken || token === ts.SyntaxKind.OpenBracketToken) {
      depth++;
      key = "";
    } else if (
      token === ts.SyntaxKind.CloseBraceToken ||
      token === ts.SyntaxKind.CloseBracketToken
    ) {
      depth--;
      key = "";
    } else if (depth === mapDepth) {
      if (token === ts.SyntaxKind.ColonToken) {
        if (key.startsWith("boundaries/")) {
          return true;
        }
        key = "";
      } else if (token === ts.SyntaxKind.CommaToken) {
        key = "";
      } else if (token === ts.SyntaxKind.StringLiteral) {
        key = quotedName(scanner.getTokenText());
      } else {
        if (/\s/u.test(value.slice(end, scanner.getTokenStart()))) {
          key = "";
        }
        key = (key + scanner.getTokenText()).slice(0, "boundaries/".length);
      }
    }
    end = scanner.getTokenEnd();
  }
  return false;
}
