import {
  createAppError,
  errorRegistry,
  fromThrown,
  lookupError,
  resolveUserMessage,
  validateDetails,
  isSafeText,
  type ErrorRegistry,
  type ErrorResponse,
  type ErrorChannel,
} from "@overmind/contracts";

export interface ErrorResponseContext {
  readonly correlationId: string;
  readonly channel?: ErrorChannel;
  readonly registry?: ErrorRegistry;
  readonly logger?: { warn(message: string, fields: Readonly<Record<string, string>>): void };
}

function dataProperty(input: unknown, key: string): unknown {
  try {
    return input !== null && typeof input === "object"
      ? Object.getOwnPropertyDescriptor(input, key)?.value
      : undefined;
  } catch {
    return undefined;
  }
}

export function toErrorResponse(
  input: unknown,
  context: ErrorResponseContext,
): { status: number; body: ErrorResponse } {
  const registry = context.registry ?? errorRegistry;
  const inputCode = dataProperty(input, "code");
  const registered = typeof inputCode === "string" ? lookupError(registry, inputCode) : undefined;
  const fallback = fromThrown(input);
  const code = registered && typeof inputCode === "string" ? inputCode : fallback.code;
  const definition = registered ?? errorRegistry[fallback.code];
  const inputDetails = registered ? dataProperty(input, "details") : fallback.details;
  const details = validateDetails(definition, inputDetails);
  if (inputDetails !== undefined && details === undefined) {
    context.logger?.warn("Invalid error details were dropped.", {
      code: "internal.invalid_error_details",
      errorCode: code,
    });
  }
  const error = createAppError(code, definition, details);
  const correlation: unknown = context.correlationId;
  const correlationId =
    typeof correlation === "string" &&
    /^[A-Za-z0-9_-]{1,128}$/u.test(correlation) &&
    isSafeText(correlation)
      ? correlation
      : "unavailable";
  return {
    status: definition.http,
    body: {
      ok: false,
      error: {
        code,
        message: definition.defaultMessage,
        ...(details ? { details } : {}),
        retryable: definition.retryable,
        correlationId,
        userMessage: resolveUserMessage(
          error,
          context.channel ?? "ui",
          registered ? registry : errorRegistry,
        ),
      },
    },
  };
}
