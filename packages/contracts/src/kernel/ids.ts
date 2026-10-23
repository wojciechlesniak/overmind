// SPDX-License-Identifier: Apache-2.0
import { z } from "zod";
import { err, ok, type Result } from "./result.ts";
import { fromThrown } from "./app-error.ts";

/** Prefixes are data, not credentials. Areas export additional prefix lists. */
export const initialIdPrefixes = Object.freeze([
  "wsp",
  "agt",
  "run",
  "nex",
  "wfl",
  "wfv",
  "tsk",
  "lan",
  "brd",
  "dsc",
  "dec",
  "msg",
  "amg",
  "cnv",
  "apr",
  "acr",
  "aud",
  "evt",
  "skl",
  "skv",
  "art",
  "con",
  "ntf",
  "req",
  "rul",
] as const);
export const idPrefixSchema = z
  .string()
  .length(3)
  .regex(/^[a-z]{3}$/u);
export type IdPrefix = z.infer<typeof idPrefixSchema>;
export type EntityId<P extends string> = string & { readonly __prefix: P };
/** Canonical UTC ISO-8601 milliseconds, supplied by a Clock rather than ambient time. */
export type Instant = string;

export const idPrefixRegistrySchema = z
  .array(idPrefixSchema)
  .min(1)
  .superRefine((prefixes, ctx) => {
    const seen = new Set<string>();
    for (const prefix of prefixes) {
      if (seen.has(prefix)) {
        ctx.addIssue({ code: "custom", message: "Duplicate ID prefix." });
      }
      seen.add(prefix);
    }
  })
  .readonly();

/** Validate the complete initial plus per-area registry without import-time side effects. */
export function parseIdPrefixes(prefixes: unknown): Result<readonly IdPrefix[]> {
  const result = idPrefixRegistrySchema.safeParse(prefixes);
  return result.success ? ok(result.data) : err(fromThrown(result.error));
}

export function entityId<const P extends string>(prefix: P) {
  const validatedPrefix = idPrefixSchema.parse(prefix);
  const pattern = new RegExp(`^${validatedPrefix}_[0-7][0-9A-HJKMNP-TV-Z]{25}$`, "u");
  // Preserve native string metadata and narrow the validated value without an unchecked cast.
  return z
    .string()
    .length(30)
    .regex(pattern)
    .refine((value): value is EntityId<P> => pattern.test(value));
}

export function parseEntityId<const P extends string>(
  prefix: P,
  input: unknown,
): Result<EntityId<P>> {
  try {
    return ok(entityId(prefix).parse(input));
  } catch (error) {
    return err(fromThrown(error));
  }
}
