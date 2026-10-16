import { gitText } from "./git.ts";
import type { Git } from "./git.ts";
import { TaskToolError } from "./errors.ts";
import { acceptance, safeText } from "./pr-body.ts";
import type { Task } from "./model.ts";
import { parsePr } from "./github.parse-boundary.ts";
import type { Repository } from "./repository.ts";
import { integration } from "./repository.ts";

const requiredChecks = [
  "ci-success",
  "gate",
  "secrets",
  "secrets-sarif",
  "tools",
  "sbom",
  "dependency-review",
];
const conditionalSkips = new Set(["rust", "desktop-e2e", "escape", "secrets-full", "report"]);

export async function verifyDone(repo: Repository, work: Git, task: Task) {
  const response = await repo.runner.run(
    "gh",
    [
      "pr",
      "view",
      `task/${task.id}`,
      "--json",
      "url,body,headRefOid,baseRefName,statusCheckRollup",
    ],
    repo.root,
  );
  if (response.exitCode !== 0) {
    throw new TaskToolError(4, "Exact-head CI evidence is unavailable");
  }
  const pr = parsePr(response.stdout);
  const head = (await gitText(work, "rev-parse", "HEAD")).trim();
  if (task.status !== "in_review" || pr.headRefOid !== head || pr.baseRefName !== integration) {
    throw new TaskToolError(2, "PR must target DEVELOP at the exact current in-review head");
  }
  const section =
    /^## Acceptance criteria\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/mu.exec(pr.body)?.[1] ?? "";
  const checked = section.split("\n").flatMap((line) => {
    const match = /^- \[x\] (.+)$/iu.exec(line);
    return match?.[1] ? [safeText(match[1].replaceAll("@\u200b", "@"))] : [];
  });
  const expected = acceptance(task).map((row) => row.text);
  if (
    section.includes("- [ ]") ||
    checked.length !== expected.length ||
    expected.some((text, index) => checked[index] !== text)
  ) {
    throw new TaskToolError(2, "PR acceptance criteria must match the task and all be checked");
  }
  const checks = pr.statusCheckRollup;
  const isPassed = (check: NonNullable<typeof checks>[number]) =>
    (check.status === "COMPLETED" && check.conclusion?.toUpperCase() === "SUCCESS") ||
    (!check.status && check.state === "SUCCESS");
  const passed = checks?.filter(isPassed).map((check) => check.name ?? check.context);
  if (
    !checks?.length ||
    requiredChecks.some((name) => !passed?.includes(name)) ||
    checks.some((check) => {
      if (isPassed(check)) {
        return false;
      }
      return !(
        check.status === "COMPLETED" &&
        check.conclusion?.toUpperCase() === "SKIPPED" &&
        conditionalSkips.has(check.name ?? "")
      );
    })
  ) {
    throw new TaskToolError(2, "Exact-head CI and security checks are not all successful");
  }
  return pr.url;
}
