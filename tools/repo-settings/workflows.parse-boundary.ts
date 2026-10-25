import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { compare, type Row } from "./policy.ts";
const step = z.object({
  uses: z.string().optional(),
  with: z.record(z.string(), z.unknown()).optional(),
});
const schema = z.object({
  jobs: z
    .record(
      z.string(),
      z.object({
        name: z.string().optional(),
        uses: z.string().optional(),
        steps: z.array(step).optional(),
      }),
    )
    .optional(),
  runs: z.object({ steps: z.array(step) }).optional(),
});
export function inventory(sources: string[], checks: string[]) {
  const jobs = new Set<string>();
  const actions = new Set<string>();
  const rows: Row[] = [];
  for (const source of sources) {
    const raw: unknown = parse(source);
    const document = schema.parse(raw);
    const steps = [
      ...Object.entries(document.jobs ?? {}).flatMap(([id, job]) => {
        jobs.add(job.name ?? id);
        return [...(job.steps ?? []), ...(job.uses === undefined ? [] : [{ uses: job.uses }])];
      }),
      ...(document.runs?.steps ?? []),
    ];
    for (const stepValue of steps) {
      const uses = stepValue.uses;
      if (!uses) {
        continue;
      }
      const local = /^(?:\$\/|\.\/)\.github\/actions\/[a-zA-Z0-9_/-]+$/u.test(uses);
      if (local) {
        continue;
      }
      rows.push(
        compare(`workflow.action.${uses}`, true, /^[\w.-]+\/[\w./-]+@[a-f0-9]{40}$/u.test(uses)),
      );
      actions.add(uses);
      if (uses.startsWith("actions/upload-artifact@")) {
        const retention = stepValue.with?.["retention-days"];
        rows.push(
          compare(
            "workflow.artifacts.maximum_30_days",
            true,
            typeof retention === "number" && retention >= 1 && retention <= 30,
          ),
        );
      }
    }
  }
  for (const check of checks) {
    rows.push(compare(`workflow.required_check.${check}`, true, jobs.has(check)));
  }
  return { actions: [...actions].toSorted(), rows };
}
export function workflowSources(root: string): string[] {
  const scan = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      if (entry.isSymbolicLink()) {
        throw new Error("Workflow inventory refuses symbolic links");
      }
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? scan(path)
        : /\.ya?ml$/u.test(entry.name)
          ? [readFileSync(path, "utf8")]
          : [];
    });
  return [...scan(join(root, ".github/workflows")), ...scan(join(root, ".github/actions"))];
}
