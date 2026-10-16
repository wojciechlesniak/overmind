import { resolve } from "node:path";
import { expect, it } from "vitest";
import { readWorkflow } from "../ci/workflow.parse-boundary.ts";

const workflow = () =>
  readWorkflow(resolve(import.meta.dirname, "../../.github/workflows/security.yml"));
it("fork scans and dependency review stay read-only, with SARIF privilege isolated to same-repository PRs", () => {
  const { jobs, permissions } = workflow();
  expect(permissions).toEqual({ contents: "read" });
  for (const name of ["tools", "secrets", "dependency-review", "sbom", "secrets-full"]) {
    expect(jobs[name]?.permissions).toBeUndefined();
  }
  expect(jobs["secrets-sarif"]?.permissions).toEqual({
    contents: "read",
    "security-events": "write",
  });
  expect(jobs["secrets-sarif"]?.if).toContain(
    "github.event.pull_request.head.repo.full_name == github.repository",
  );
  expect(jobs["secrets-sarif"]?.if).toContain("github.event_name == 'pull_request'");
  expect(
    jobs["dependency-review"]?.steps.find((step) =>
      step.uses?.startsWith("actions/dependency-review-action@"),
    )?.with,
  ).toMatchObject({ "fail-on-severity": "high", "comment-summary-in-pr": "never" });
  expect(jobs["report"]?.permissions).toEqual({ contents: "read", issues: "write" });
  expect(jobs["report"]?.if).toContain("github.event.repository.default_branch");
});
it("required secret jobs use full Git history and actual integration tests; SBOM artifacts survive 90 days", () => {
  const { jobs } = workflow();
  for (const name of ["secrets", "secrets-full"]) {
    expect(
      jobs[name]?.steps.find((step) => step.uses?.startsWith("actions/checkout@"))?.with,
    ).toMatchObject({ "fetch-depth": 0, "persist-credentials": false });
    expect(jobs[name]?.steps.some((step) => step.uses?.includes("setup"))).toBe(false);
  }
  const integration = jobs["tools"]?.steps.find((step) =>
    step.run?.includes("vitest.int.config.ts"),
  )?.run;
  expect(integration).toContain("scan.int.test.ts");
  expect(integration).toContain("generate.int.test.ts");
  expect(integration).not.toContain("passWithNoTests");
  expect(
    jobs["sbom"]?.steps.find((step) => step.uses?.startsWith("actions/upload-artifact@"))?.with,
  ).toMatchObject({ name: "sbom", "retention-days": 90, "if-no-files-found": "error" });
});
