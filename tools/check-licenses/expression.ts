import identifiers from "spdx-license-ids/index.json" with { type: "json" };
import deprecated from "spdx-license-ids/deprecated.json" with { type: "json" };

const knownLicenses = new Set([...identifiers, ...deprecated]);
const licenseRef = /^(?:DocumentRef-[A-Za-z0-9.-]+:)?LicenseRef-[A-Za-z0-9.-]+$/u;
const exceptionIdentifier = /^[A-Za-z0-9][A-Za-z0-9.-]*$/u;

/** Evaluate SPDX alternatives; WITH/plus terms never authorize a license. */
export function evaluateLicenseExpression(
  expression: string,
  isAllowed: (identifier: string) => boolean,
): boolean {
  if (expression.length > 8192) {
    return false;
  }
  const tokens = Array.from(expression.matchAll(/[()+]|[^\s()+]+/gu), (match) => ({
    text: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }));
  if (!tokens.length || tokens.length > 256) {
    return false;
  }
  for (const [index, token] of tokens.entries()) {
    if (token.text === "AND" || token.text === "OR") {
      const before = tokens[index - 1];
      const after = tokens[index + 1];
      if (
        !before ||
        !after ||
        (before.end === token.start && before.text !== ")") ||
        (after.start === token.end && after.text !== "(")
      ) {
        return false;
      }
    }
  }
  let cursor = 0;
  function atom(depth: number): boolean {
    if (depth > 32) {
      throw new Error("License expression nesting limit exceeded");
    }
    const token = tokens[cursor++];
    if (token?.text === "(") {
      const value = disjunction(depth + 1);
      if (tokens[cursor++]?.text !== ")") {
        throw new Error("Missing closing license parenthesis");
      }
      return value;
    }
    if (!token || (!knownLicenses.has(token.text) && !licenseRef.test(token.text))) {
      throw new Error("Unknown license identifier");
    }
    let restricted = false;
    let lastEnd = token.end;
    const plus = tokens[cursor];
    if (plus?.text === "+") {
      if (plus.start !== token.end || !knownLicenses.has(token.text)) {
        throw new Error("Plus must immediately follow a registered license ID");
      }
      cursor++;
      lastEnd = plus.end;
      restricted = true;
    }
    const withOperator = tokens[cursor];
    if (withOperator?.text === "WITH") {
      cursor++;
      const exception = tokens[cursor++];
      if (
        !exception ||
        withOperator.start === lastEnd ||
        exception.start === withOperator.end ||
        ["AND", "OR", "WITH"].includes(exception.text) ||
        !exceptionIdentifier.test(exception.text)
      ) {
        throw new Error("Invalid exception identifier");
      }
      // Exception data is unnecessary: no WITH term is approved by this policy.
      restricted = true;
    }
    return !restricted && isAllowed(token.text);
  }
  function conjunction(depth: number): boolean {
    let value = atom(depth);
    while (tokens[cursor]?.text === "AND") {
      cursor++;
      // Always parse the RHS, even if the result is already determined.
      const right = atom(depth);
      value = value && right;
    }
    return value;
  }
  function disjunction(depth: number): boolean {
    let value = conjunction(depth);
    while (tokens[cursor]?.text === "OR") {
      cursor++;
      const right = conjunction(depth);
      value = value || right;
    }
    return value;
  }
  try {
    const value = disjunction(0);
    return cursor === tokens.length && value;
  } catch {
    return false;
  }
}
