import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { expect, it } from "vitest";

const name = "Check error catalogue integration";
const command =
  "pnpm exec vitest run --config vitest.int.config.ts tools/errors/catalogue-types.int.test.ts";
const stepSchema = z.object({
  name: z.string().optional(),
  run: z.string().optional(),
  if: z.union([z.string(), z.boolean()]).optional(),
  "continue-on-error": z.literal(false).optional(),
});
const workflowSchema = z.object({
  jobs: z.object({
    test: z.object({
      if: z.literal("needs.plan.outputs.full == 'true'"),
      needs: z.array(z.string()).refine((needs) => needs.includes("plan")),
      "continue-on-error": z.literal(false).optional(),
      strategy: z.object({
        matrix: z.strictObject({
          shard: z.array(z.number()).refine((shards) => shards.includes(1)),
        }),
      }),
      steps: z.array(stepSchema),
    }),
    "ci-success": z.object({
      if: z.literal("always()"),
      needs: z.array(z.string()).refine((needs) => needs.includes("test")),
    }),
  }),
});
type Workflow = z.infer<typeof workflowSchema>;

function requireCatalogueGate(input: unknown): void {
  const workflow = workflowSchema.parse(input);
  const steps = workflow.jobs.test.steps;
  const probes = steps.filter((step) => step.name === name);
  const probe = probes[0];
  const coverageIndex = steps.findIndex((step) => step.run?.includes("pnpm test:coverage"));
  if (
    probes.length !== 1 ||
    probe?.run !== command ||
    probe.if !== "matrix.shard == 1" ||
    coverageIndex < 0 ||
    steps.indexOf(probe) <= coverageIndex
  ) {
    throw new Error("Required catalogue integration gate is absent or bypassed.");
  }
}

function actualWorkflow(): Workflow {
  const source = readFileSync(
    resolve(import.meta.dirname, "../../.github/workflows/ci.yml"),
    "utf8",
  );
  const input: unknown = parse(source);
  return workflowSchema.parse(input);
}

it("requires the actual full-CI catalogue integration after covered units in a mandatory shard", () => {
  expect(() => {
    requireCatalogueGate(actualWorkflow());
  }).not.toThrow();
});

it.each([
  {
    name: "removing the integration step",
    mutate: (workflow: Workflow): unknown => ({
      ...workflow,
      jobs: {
        ...workflow.jobs,
        test: {
          ...workflow.jobs.test,
          steps: workflow.jobs.test.steps.filter((step) => step.name !== name),
        },
      },
    }),
  },
  {
    name: "using a shard which the matrix never starts",
    mutate: (workflow: Workflow): unknown => ({
      ...workflow,
      jobs: {
        ...workflow.jobs,
        test: {
          ...workflow.jobs.test,
          steps: workflow.jobs.test.steps.map((step) =>
            step.name === name ? { ...step, if: "matrix.shard == 999" } : step,
          ),
        },
      },
    }),
  },
  {
    name: "allowing the integration assertion to fail",
    mutate: (workflow: Workflow): unknown => ({
      ...workflow,
      jobs: {
        ...workflow.jobs,
        test: {
          ...workflow.jobs.test,
          steps: workflow.jobs.test.steps.map((step) =>
            step.name === name ? { ...step, "continue-on-error": true } : step,
          ),
        },
      },
    }),
  },
  {
    name: "dropping the required test dependency",
    mutate: (workflow: Workflow): unknown => ({
      ...workflow,
      jobs: {
        ...workflow.jobs,
        "ci-success": {
          ...workflow.jobs["ci-success"],
          needs: workflow.jobs["ci-success"].needs.filter((need) => need !== "test"),
        },
      },
    }),
  },
])("detects $name in a structural mutation of the real workflow", ({ mutate }) => {
  expect(() => {
    requireCatalogueGate(mutate(actualWorkflow()));
  }).toThrow();
});
