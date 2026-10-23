import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";
import { readWorkflow } from "./workflow.parse-boundary.ts";

const workflow = readWorkflow(
  resolve(import.meta.dirname, "../../.github/workflows/native-integration.yml"),
);
const native = workflow.jobs["native-integration"];
const run = native?.steps.find((step) => step.id === "native")?.run;
const program = run?.match(/node --input-type=module <<'NODE'\n([\s\S]*?)\nNODE/u)?.[1];
const valid = {
  success: true,
  numTotalTests: 1,
  numPassedTests: 1,
  numFailedTests: 0,
  numPendingTests: 0,
  numTodoTests: 0,
  testResults: [{ status: "passed", assertionResults: [{ status: "passed" }] }],
};
function accepts(report: unknown): boolean {
  if (!program) {
    throw new Error("Native report verifier is missing");
  }
  const directory = mkdtempSync(resolve(tmpdir(), "overmind-native-report-"));
  try {
    const path = resolve(directory, "report.json");
    writeFileSync(path, typeof report === "string" ? report : JSON.stringify(report));
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", program], {
      env: { NATIVE_REPORT: path },
      timeout: 5000,
    });
    return result.status === 0;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("native verification runs every existing integration on the exact public ARM64 head", () => {
  expect(native?.["runs-on"]).toBe("macos-26");
  expect(native?.if).toBe("github.event.repository.visibility == 'public'");
  expect(run).toContain('pnpm test:int --reporter=json --outputFile="$NATIVE_REPORT"');
  expect(run).toContain('test "$(uname -m)" = arm64');
  expect(run?.match(/test "\$\(git rev-parse HEAD\)" = "\$EXPECTED_SHA"/gu)).toHaveLength(2);
  expect(run).not.toMatch(/--(?:retry|shard|testNamePattern|exclude|testTimeout|bail)\b/u);
  expect(workflow.permissions).toEqual({ contents: "read" });
  expect(accepts(valid)).toBe(true);
});
test.each([
  "{invalid",
  { ...valid, success: false },
  { ...valid, numTotalTests: 0, numPassedTests: 0 },
  { ...valid, numPendingTests: 1 },
  { ...valid, numTodoTests: 1 },
  { ...valid, numFailedTests: 1 },
  { ...valid, numPassedTests: 0 },
  { ...valid, testResults: [] },
  { ...valid, numTotalTests: 2, numPassedTests: 2 },
  { ...valid, testResults: [{ status: "passed", assertionResults: [{ status: "skipped" }] }] },
  { ...valid, testResults: [{ status: "failed", assertionResults: [{ status: "passed" }] }] },
])("incomplete, failed, skipped or malformed native evidence is denied: %#", (report) => {
  expect(accepts(report)).toBe(false);
});
