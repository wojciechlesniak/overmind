import { readJobResults } from "./context.parse-boundary.ts";
const results = readJobResults(process.env["CI_NEEDS"] ?? "");
const always = ["plan", "format-lint", "typecheck"];
const full = [
  "test",
  "test-merge",
  "build",
  "architecture",
  "licenses",
  "audit",
  "commits",
  "config-integrity",
  "workflow-lint",
];
const expected = new Set([...always, ...(process.env["CI_FULL"] === "true" ? full : [])]);
if (process.env["CI_FULL"] === "true" && process.env["CI_RUST"] === "true") {
  expected.add("rust");
}
if (process.env["CI_FULL"] === "true" && process.env["CI_DESKTOP"] === "true") {
  expected.add("desktop-e2e");
}
for (const job of expected) {
  if (results[job]?.result !== "success") {
    throw new Error(`Required job ${job} did not succeed`);
  }
}
for (const [job, { result }] of Object.entries(results)) {
  if (
    result === "failure" ||
    result === "cancelled" ||
    (result === "skipped" && expected.has(job))
  ) {
    throw new Error(`CI job ${job}: ${result}`);
  }
}
