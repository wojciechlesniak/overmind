import type { AppError } from "../kernel/app-error.ts";
import { z } from "zod";
import { errorRegistry } from "./index.generated.ts";
import { lookupError, type ErrorRegistry } from "./registry.ts";
import { validateDetails } from "./safe-details.ts";

export type ErrorChannel = "ui" | "telegram" | "notification";
export const userMessageSchema = z.strictObject({
  key: z.string().regex(/^errors:[a-z]+\.[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});
export type UserMessage = z.infer<typeof userMessageSchema>;

export function resolveUserMessage(
  error: AppError<string>,
  channel: ErrorChannel,
  registry: ErrorRegistry = errorRegistry,
): UserMessage {
  const definition = lookupError(registry, error.code);
  if (!definition || (channel === "telegram" && !definition.telegramSafe)) {
    return { key: "errors:generic.try_again_on_desktop", params: {} };
  }
  const params: UserMessage["params"] = {};
  for (const [key, value] of Object.entries(validateDetails(definition, error.details) ?? {})) {
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      params[key] = value as string | number | boolean | null;
    }
  }
  return { key: definition.messageKey, params };
}
