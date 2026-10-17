import { z } from "zod";
import { errorRegistry, isKnownCode, type ErrorCode } from "../errors/index.generated.ts";
import { createAppError } from "../errors/create-error.ts";
import type { JsonValue } from "../errors/definition.ts";
import { internalErrors } from "../errors/internal.errors.ts";
import { validationErrors } from "../errors/validation.errors.ts";

export type { JsonValue } from "../errors/definition.ts";
export { createAppError } from "../errors/create-error.ts";
export interface AppError<Code extends string = ErrorCode> {
  readonly code: Code;
  readonly message: string;
  readonly details?: Record<string, JsonValue>;
  readonly retryable: boolean;
  readonly correlationId?: string;
  readonly cause?: unknown;
}

export function fromThrown(thrown: unknown, hint?: ErrorCode): AppError {
  let result: AppError = internalErrors.unexpected();
  try {
    if (thrown instanceof z.ZodError) {
      const issues = thrown.issues.slice(0, 20).map((issue) => ({
        path: issue.path
          .slice(0, 8)
          .map((part) =>
            typeof part === "number" && Number.isSafeInteger(part) && part >= 0 ? part : "field",
          ),
        code: "invalid_input" as const,
        message: "Invalid input." as const,
      }));
      result = validationErrors.invalid_input({ issues, truncated: thrown.issues.length > 20 });
    } else if (thrown instanceof SyntaxError) {
      result = validationErrors.malformed_json();
    } else if (thrown instanceof Error && thrown.name === "AbortError") {
      result = internalErrors.cancelled();
    } else if (hint && isKnownCode(hint)) {
      result = createAppError(hint, errorRegistry[hint]);
    }
  } catch {
    /* Foreign objects and reflection failures always become a generic error. */
  }
  Object.defineProperty(result, "cause", { value: thrown, enumerable: false });
  return result;
}
