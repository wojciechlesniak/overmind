import { defineErrors } from "./define-errors.ts";

export const internalErrors = defineErrors("internal", {
  unexpected: {
    http: 500,
    severity: "error",
    retryable: false,
    messageKey: "errors:internal.unexpected",
    defaultMessage: "An unexpected error occurred.",
    telegramSafe: false,
  },
  cancelled: {
    http: 409,
    severity: "info",
    retryable: false,
    messageKey: "errors:internal.cancelled",
    defaultMessage: "The operation was cancelled.",
    telegramSafe: true,
  },
});
