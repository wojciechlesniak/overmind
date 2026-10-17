import { z } from "zod";
import { defineErrors } from "./define-errors.ts";

export const validationErrors = defineErrors("validation", {
  invalid_input: {
    http: 400,
    severity: "warn",
    retryable: false,
    messageKey: "errors:validation.invalid_input",
    defaultMessage: "The input is invalid.",
    telegramSafe: true,
    detailsSchema: z.strictObject({
      issues: z
        .array(
          z.strictObject({
            path: z.array(z.union([z.literal("field"), z.number().int().nonnegative()])).max(8),
            code: z.literal("invalid_input"),
            message: z.literal("Invalid input."),
          }),
        )
        .max(20),
      truncated: z.boolean(),
    }),
  },
  malformed_json: {
    http: 400,
    severity: "warn",
    retryable: false,
    messageKey: "errors:validation.malformed_json",
    defaultMessage: "The request contains malformed JSON.",
    telegramSafe: true,
  },
});
