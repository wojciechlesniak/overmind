import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";
const step = z.object({ uses: z.string().optional(), run: z.string().optional() });
const job = z.object({
  "runs-on": z.union([z.string(), z.array(z.string())]),
  "timeout-minutes": z.number().positive(),
  needs: z.union([z.string(), z.array(z.string())]).optional(),
  steps: z.array(step),
});
const schema = z.object({
  name: z.string().min(1),
  on: z.record(z.string(), z.unknown()),
  permissions: z.object({ contents: z.literal("read") }).strict(),
  concurrency: z.object({
    group: z.string(),
    "cancel-in-progress": z.union([z.boolean(), z.string()]),
  }),
  jobs: z.record(z.string(), job),
});
export function parseWorkflow(text: string) {
  const raw: unknown = parse(text);
  return schema.parse(raw);
}
export function readWorkflow(path: string) {
  return parseWorkflow(readFileSync(path, "utf8"));
}
export function parseActionSteps(text: string) {
  const raw: unknown = parse(text);
  return z
    .object({ runs: z.object({ using: z.literal("composite"), steps: z.array(step) }) })
    .parse(raw).runs.steps;
}
