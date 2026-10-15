import parse from "spdx-expression-parse";
import type { LicenseException } from "./input.parse-boundary.ts";
export function licenseAllowed(
  name: string,
  expression: string | undefined,
  allowed: ReadonlySet<string>,
  exceptions: readonly LicenseException[],
  today: string,
): boolean {
  if (!expression) {
    return false;
  }
  function evaluate(node: ReturnType<typeof parse>): boolean {
    if ("conjunction" in node) {
      return node.conjunction === "or"
        ? evaluate(node.left) || evaluate(node.right)
        : evaluate(node.left) && evaluate(node.right);
    }
    if (node.exception || node.plus) {
      return false;
    }
    if (node.license === "MPL-2.0") {
      return exceptions.some(
        (entry) =>
          entry.package === name &&
          entry.license === node.license &&
          entry.expires >= today &&
          entry.justification.trim().length >= 20,
      );
    }
    return allowed.has(node.license);
  }
  try {
    return evaluate(parse(expression));
  } catch {
    return false;
  }
}
