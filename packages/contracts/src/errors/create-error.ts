import type { AppError } from "../kernel/app-error.ts";
import { registrationInvariant, type ErrorDefinition } from "./definition.ts";
import { validateDetails, isSafeText } from "./safe-details.ts";

export function createAppError<Code extends string>(
  code: Code,
  definition: ErrorDefinition,
  details?: unknown,
  cause?: unknown,
): AppError<Code> {
  if (!isSafeText(definition.defaultMessage)) {
    registrationInvariant("Unsafe error definition.");
  }
  const safe = validateDetails(definition, details);
  const error: AppError<Code> = {
    code,
    message: definition.defaultMessage,
    retryable: definition.retryable,
    ...(safe ? { details: safe } : {}),
  };
  if (cause !== undefined) {
    Object.defineProperty(error, "cause", { value: cause, enumerable: false });
  }
  return error;
}
