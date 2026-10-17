import { z } from "zod";
import { TaskToolError } from "./errors.ts";

const recordSchema = z
  .object({
    token: z.uuid(),
    pid: z.number().int().min(2),
    createdAt: z.number().int().nonnegative(),
  })
  .strict();

export function parseLock(text: string): z.infer<typeof recordSchema> {
  try {
    const value: unknown = JSON.parse(text);
    const result = recordSchema.safeParse(value);
    if (result.success) {
      return result.data;
    }
  } catch {
    // Malformed files never grant permission to take over an operation.
  }
  throw new TaskToolError(4, "Invalid task lock record");
}
