import { readFileSync } from "node:fs";
import { z } from "zod";
const sha = z.string().regex(/^[a-f0-9]{40}$/u);
const ref = z.object({ sha, ref: z.string(), repo: z.object({ full_name: z.string() }) });
const event = z.object({
  pull_request: z
    .object({
      number: z.number().int().positive(),
      title: z.string(),
      draft: z.boolean(),
      head: ref,
      base: ref,
      labels: z.array(z.object({ name: z.string() })),
    })
    .optional(),
  merge_group: z.object({ base_sha: sha, head_sha: sha }).optional(),
  before: sha.optional(),
});
export function readEvent(path = process.env["GITHUB_EVENT_PATH"]) {
  if (!path) {
    throw new Error("GITHUB_EVENT_PATH is required");
  }
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  return event.parse(raw);
}
export function readJobResults(text: string) {
  const raw: unknown = JSON.parse(text);
  return z
    .record(
      z.string(),
      z.object({ result: z.enum(["success", "failure", "cancelled", "skipped"]) }),
    )
    .parse(raw);
}
