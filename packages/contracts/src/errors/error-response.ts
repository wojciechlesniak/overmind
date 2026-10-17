import { z } from "zod";
import { isSafeText } from "./safe-details.ts";
import { userMessageSchema } from "./user-message.ts";

export const errorResponseSchema = z.strictObject({
  ok: z.literal(false),
  error: z.strictObject({
    code: z.string().regex(/^[a-z]+\.[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u),
    message: z.string().max(240).refine(isSafeText),
    details: z.record(z.string(), z.json()).optional(),
    retryable: z.boolean(),
    correlationId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,128}$/u)
      .refine(isSafeText),
    userMessage: userMessageSchema,
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
