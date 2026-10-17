import type { z } from "zod";

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface ErrorDefinition {
  readonly http: number;
  readonly severity: "info" | "warn" | "error" | "fatal";
  readonly retryable: boolean;
  readonly messageKey: string;
  readonly defaultMessage: string;
  readonly detailsSchema?: z.ZodType<Record<string, JsonValue>>;
  readonly audit?: boolean;
  readonly telegramSafe: boolean;
  readonly deprecated?: boolean;
}

export type ErrorCatalogue = Record<
  string,
  ((...args: never[]) => unknown) & {
    readonly code: string;
    readonly definition: ErrorDefinition;
  }
>;

export function registrationInvariant(message: string): never {
  const error = new Error(message);
  error.name = "InvariantError";
  throw error;
}
