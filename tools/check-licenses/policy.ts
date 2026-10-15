import { evaluateLicenseExpression } from "./expression.ts";
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
  return evaluateLicenseExpression(expression, (identifier) => {
    if (identifier === "MPL-2.0") {
      return exceptions.some(
        (entry) =>
          entry.package === name &&
          entry.expires >= today &&
          entry.justification.trim().length >= 20,
      );
    }
    return allowed.has(identifier);
  });
}
