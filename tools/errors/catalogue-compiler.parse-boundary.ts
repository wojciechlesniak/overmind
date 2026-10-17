import { z } from "zod";

const inputSchema = z.strictObject({
  assertionPath: z.string().min(1).max(4096),
  files: z
    .array(z.tuple([z.string().min(1).max(4096), z.string().max(200_000)]))
    .min(2)
    .max(8),
});

export function parseCompilerInput(text: string): z.infer<typeof inputSchema> {
  return inputSchema.parse(JSON.parse(text) as unknown);
}
