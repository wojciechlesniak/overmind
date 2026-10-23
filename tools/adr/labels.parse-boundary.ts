import { z } from "zod";
import { text } from "./text-schema.ts";

export function parseLabels(source: string): string[] {
  try {
    const event = z
      .object({
        pull_request: z.object({ labels: z.array(z.object({ name: text })).max(100) }).optional(),
      })
      .parse(JSON.parse(source));
    return event.pull_request?.labels.map((label) => label.name) ?? [];
  } catch {
    throw new Error("Invalid GitHub event JSON");
  }
}
