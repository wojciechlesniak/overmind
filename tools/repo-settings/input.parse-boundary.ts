import { z } from "zod";
const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const setting = z
  .object({ path: z.string().min(1), value: z.union([scalar, z.array(scalar)]) })
  .strict();
export const expectedSchema = z
  .object({
    repository: z.array(setting),
    endpoints: z.array(z.object({ endpoint: z.string(), settings: z.array(setting) }).strict()),
    requiredChecks: z.array(z.string()).min(1),
    rulesets: z.array(
      z
        .object({
          name: z.string(),
          target: z.enum(["branch", "tag"]),
          include: z.array(z.string()),
          bypass: z.array(
            z
              .object({
                actor_id: z.number().int(),
                actor_type: z.literal("RepositoryRole"),
                bypass_mode: z.literal("always"),
              })
              .strict(),
          ),
          rules: z.array(setting),
        })
        .strict(),
    ),
    releaseReviewer: z.string().min(1),
    allowedRepositorySecrets: z.array(z.string()),
    releaseSecrets: z.array(z.string()),
  })
  .strict();
export const labelsSchema = z
  .array(
    z
      .object({
        name: z
          .string()
          .min(1)
          .max(50)
          .regex(/^[a-z0-9 :_-]+$/u),
        color: z
          .string()
          .regex(/^[a-fA-F0-9]{6}$/u)
          .transform((value) => value.toLowerCase()),
        description: z
          .string()
          .max(100)
          .regex(/^[\x20-\x7e]*$/u),
      })
      .strict(),
  )
  .superRefine((labels, context) => {
    if (new Set(labels.map((label) => label.name)).size !== labels.length) {
      context.addIssue({ code: "custom", message: "Duplicate labels" });
    }
  });
export function parseExpected(source: string) {
  const value: unknown = JSON.parse(source);
  return expectedSchema.parse(value);
}
export function parseLabels(source: string) {
  const value: unknown = JSON.parse(source);
  return labelsSchema.parse(value);
}
export function parseJson(source: string): unknown {
  return JSON.parse(source);
}
export function record(value: unknown): Record<string, unknown> {
  return z.record(z.string(), z.unknown()).parse(value);
}
export function records(value: unknown) {
  return z.array(z.record(z.string(), z.unknown())).parse(value);
}
export type Expected = z.infer<typeof expectedSchema>;
export type Label = z.infer<typeof labelsSchema>[number];
export function parseApiLabels(value: unknown): Label[] {
  return z
    .array(
      z.object({
        name: z.string().min(1).max(50),
        color: z.string().regex(/^[a-fA-F0-9]{6}$/u),
        description: z.string().nullable().optional(),
      }),
    )
    .parse(value)
    .map((label) => ({
      ...label,
      color: label.color.toLowerCase(),
      description: label.description ?? "",
    }));
}
