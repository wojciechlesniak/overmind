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
  const tokens = expression.match(/[()+]|[^\s()+]+/gu) ?? [];
  if (!tokens.length || tokens.length > 256) {
    return false;
  }
  let cursor = 0;
  function atom(depth: number): boolean {
    if (depth > 32) {
      throw new Error("License expression nesting limit exceeded");
    }
    const token = tokens[cursor++];
    if (token === "(") {
      const value = disjunction(depth + 1);
      if (tokens[cursor++] !== ")") {
        throw new Error("Missing closing license parenthesis");
      }
      return value;
    }
    if (!token || (!knownLicenses.has(token) && !licenseRef.test(token))) {
      throw new Error("Unknown license identifier");
    }
    let restricted = false;
    if (tokens[cursor] === "+") {
      cursor++;
      restricted = true;
    }
    if (tokens[cursor] === "WITH") {
      cursor++;
      const exception = tokens[cursor++];
      if (
        !exception ||
        ["AND", "OR", "WITH"].includes(exception) ||
        !exceptionIdentifier.test(exception)
      ) {
        throw new Error("Invalid exception identifier");
      }
      // Exception data is unnecessary: no WITH term is approved by this policy.
      restricted = true;
    }
    return !restricted && isAllowed(token);
  }
  function conjunction(depth: number): boolean {
    let value = atom(depth);
    while (tokens[cursor] === "AND") {
      cursor++;
      // Always parse the RHS, even if the result is already determined.
      const right = atom(depth);
      value = value && right;
    }
    return value;
  }
  function disjunction(depth: number): boolean {
    let value = conjunction(depth);
    while (tokens[cursor] === "OR") {
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
