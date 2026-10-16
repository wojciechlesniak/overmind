import {
  readFileSync,
  readdirSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
  chmodSync,
  existsSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { parseActionSteps, parseWorkflow, readWorkflow } from "./ci/workflow.parse-boundary.ts";
import { actionlintCompatible } from "./ci/workflow-lint.ts";
import { isolatedGitEnvironment } from "./hooks/git-test-environment.ts";
const root = resolve(import.meta.dirname, "..");
function pinned(uses: string): boolean {
  return (
    /^(?:\$\/|\.\/)\.github\/actions\/[a-z0-9/-]+$/u.test(uses) ||
    /^[\w.-]+\/[\w./-]+@[a-f0-9]{40}$/u.test(uses)
  );
}
function validate(source: string, name: string) {
  const workflow = parseWorkflow(source);
  if (name !== "pr-gate.yml") {
    expect(Object.keys(workflow.on)).not.toContain("pull_request_target");
  }
  for (const value of Object.values(workflow.jobs)) {
    expect(JSON.stringify(value["runs-on"])).not.toContain("-latest");
    for (const step of value.steps) {
      if (step.uses) {
        expect(pinned(step.uses), step.uses).toBe(true);
      }
      if (step.run) {
        expect(step.run).not.toMatch(/\$\{\{\s*github\.(?:event|head_ref|ref_name)/u);
      }
    }
  }
  return workflow;
}
it("all workflows and the setup action enforce pins, permissions, timeouts and safe triggers", () => {
  for (const name of readdirSync(resolve(root, ".github/workflows")).filter((file) =>
    /\.ya?ml$/u.test(file),
  )) {
    validate(readFileSync(resolve(root, ".github/workflows", name), "utf8"), name);
  }
  for (const step of parseActionSteps(
    readFileSync(resolve(root, ".github/actions/setup/action.yml"), "utf8"),
  )) {
    if (step.uses) {
      expect(pinned(step.uses)).toBe(true);
    }
  }
  const source = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
  expect(source).not.toContain("secrets.");
  expect([...source.matchAll(/vars\.([A-Z_]+)/gu)].map((match) => match[1])).toEqual(
    expect.arrayContaining(["CI_STRICT_TOOLS"]),
  );
  for (const match of source.matchAll(/vars\.([A-Z_]+)/gu)) {
    expect(["CI_STRICT_TOOLS"]).toContain(match[1]);
  }
  const workflow = readWorkflow(resolve(root, ".github/workflows/ci.yml"));
  expect(workflow.jobs["rust"]?.["runs-on"]).toBe("macos-26");
  const needs = workflow.jobs["ci-success"]?.needs;
  expect(Array.isArray(needs) ? needs.toSorted() : []).toEqual(
    Object.keys(workflow.jobs)
      .filter((key) => key !== "ci-success")
      .toSorted(),
  );
});
it("tag refs, missing timeouts, write permissions and forbidden triggers fail validation", () => {
  const source = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
  expect(() =>
    validate(source.replace(/actions\/checkout@[a-f0-9]{40}/gu, "actions/checkout@v7"), "ci.yml"),
  ).toThrow();
  expect(() =>
    validate(source.replace("pull_request:", "pull_request_target:"), "ci.yml"),
  ).toThrow();
  expect(() =>
    validate(source.replace(/timeout-minutes: \d+/u, "timeout-minutes: invalid"), "ci.yml"),
  ).toThrow();
  expect(() => validate(source.replace("contents: read", "contents: write"), "ci.yml")).toThrow();
});
it("actionlint compatibility only translates the dedicated local uses syntax", () => {
  const source =
    "- uses: $/.github/actions/setup\n- uses: attacker/action@main\n  run: echo '$/literal'\n";
  expect(actionlintCompatible(source)).toBe(
    "- uses: ./.github/actions/setup\n- uses: attacker/action@main\n  run: echo '$/literal'\n",
  );
});
it("setup does not publish a cache path when pnpm fails or returns invalid output", () => {
  const script = parseActionSteps(
    readFileSync(resolve(root, ".github/actions/setup/action.yml"), "utf8"),
  ).find((step) => step.run?.includes("pnpm store path"))?.run;
  expect(script).toBeDefined();
  if (!script) {
    throw new Error("Missing store step");
  }
  const fixture = mkdtempSync(resolve(tmpdir(), "overmind-store-step-"));
  try {
    const output = resolve(fixture, "output");
    const pnpm = resolve(fixture, "pnpm");
    for (const body of ["exit 17", "exit 0", "printf '/store\\n/injected\\n'"]) {
      writeFileSync(pnpm, `#!/bin/sh\n${body}\n`);
      chmodSync(pnpm, 0o700);
      const result = spawnSync("/bin/bash", ["-c", script], {
        env: { ...isolatedGitEnvironment(), PATH: fixture, GITHUB_OUTPUT: output },
      });
      expect(result.status).not.toBe(0);
      expect(existsSync(output)).toBe(false);
    }
    writeFileSync(pnpm, "#!/bin/sh\nprintf '/store\\n'\n");
    const result = spawnSync("/bin/bash", ["-c", script], {
      env: { ...isolatedGitEnvironment(), PATH: fixture, GITHUB_OUTPUT: output },
    });
    expect(result.status).toBe(0);
    expect(readFileSync(output, "utf8")).toBe("path=/store\n");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
