// Generated catalogue seed; regenerate using docs/architecture/errors.md.
import { createErrorRegistry } from "./registry.ts";
import { internalErrors } from "./internal.errors.ts";
import { validationErrors } from "./validation.errors.ts";

export const catalogueModules = [
  { source: "internal.errors.ts", errors: internalErrors },
  { source: "validation.errors.ts", errors: validationErrors },
] as const;
export const errorRegistry = createErrorRegistry(catalogueModules);
export type ErrorCode = keyof typeof errorRegistry;
export function isKnownCode(code: string): code is ErrorCode {
  return Object.hasOwn(errorRegistry, code);
}
