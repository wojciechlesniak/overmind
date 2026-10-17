import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CommandInput } from "./arguments.ts";
import { TaskToolError } from "./errors.ts";
import { nodeFiles } from "./files.ts";
import { gitText } from "./git.ts";
import { parsePr } from "./github.parse-boundary.ts";
import { loadTasks } from "./load.ts";
import { buildPrBody, safeText } from "./pr-body.ts";
import { ensureClean, integration, integrationRef, managedPath, refresh } from "./repository.ts";
import type { Repository } from "./repository.ts";
import { changeStatus } from "./transitions.ts";
import { verifyDone } from "./done.ts";

export async function finish(repo: Repository, input: CommandInput) {
  const id = input.id;
  if (!id || repo.root !== managedPath(repo, id)) {
    throw new TaskToolError(2, "Run finish from the task's managed worktree");
  }
  const work = repo.git.at(repo.root);
  if ((await gitText(work, "branch", "--show-current")).trim() !== `task/${id}`) {
    throw new TaskToolError(2, "Worktree branch does not match the task ID");
  }
  await ensureClean(work, false);
  await refresh(repo);
  const task = (await loadTasks("WORKTREE", { root: repo.root, git: work })).get(id);
  if (!task || !["in_progress", "in_review"].includes(task.status)) {
    throw new TaskToolError(2, "Task must be in progress or in review");
  }
  for (const [file, args] of [
    ["tools/tasks/lint.ts", ["check:tasks", "--area", task.area]],
    ["tools/tasks/check-owns.ts", ["check:owns"]],
  ] as const) {
    if (
      existsSync(join(repo.root, file)) &&
      (await repo.runner.run("pnpm", args, repo.root)).exitCode !== 0
    ) {
      throw new TaskToolError(2, "Task validation failed");
    }
  }
  if (input.done) {
    const pr = await verifyDone(repo, work, task);
    changeStatus(join(repo.root, task.path), "done");
    await gitText(work, "add", "--", task.path);
    await gitText(
      work,
      "commit",
      "-m",
      `chore(${task.area.toLowerCase()}): mark ${id} done\n\nRefs: ${id}\n`,
    );
    await gitText(work, "push", "origin", `HEAD:refs/heads/task/${id}`);
    return {
      schemaVersion: 1 as const,
      command: "finish" as const,
      id,
      status: "done" as const,
      bodyPath: "",
      pr,
    };
  }
  const directory = mkdtempSync(join(tmpdir(), "overmind-task-pr-"));
  const bodyPath = join(directory, "body.md");
  const templatePath = join(repo.root, ".github/pull_request_template.md");
  const template = existsSync(templatePath) ? nodeFiles.readText(templatePath) : "";
  const files = (await gitText(work, "diff", "--name-only", "-z", `${integrationRef}...HEAD`))
    .split("\0")
    .filter(Boolean);
  writeFileSync(bodyPath, buildPrBody(task, files, template), { mode: 0o600 });
  if (task.status !== "in_review") {
    changeStatus(join(repo.root, task.path), "in_review");
    await gitText(work, "add", "--", task.path);
    await gitText(
      work,
      "commit",
      "-m",
      `chore(${task.area.toLowerCase()}): finish ${id}\n\nRefs: ${id}\n`,
    );
  }
  await gitText(work, "push", "origin", `HEAD:refs/heads/task/${id}`);
  const available = await repo.runner.run("gh", ["--version"], repo.root);
  let pr: string | null = null;
  if (available.exitCode !== 127) {
    if (available.exitCode !== 0) {
      throw new TaskToolError(4, `GitHub CLI unavailable; PR body retained at ${bodyPath}`);
    }
    const existing = await repo.runner.run(
      "gh",
      ["pr", "view", `task/${id}`, "--json", "url,body,headRefOid,baseRefName,statusCheckRollup"],
      repo.root,
    );
    if (existing.exitCode === 0) {
      const candidate = parsePr(existing.stdout);
      if (candidate.baseRefName !== integration) {
        throw new TaskToolError(2, "Existing PR must target DEVELOP");
      }
      pr = candidate.url;
    } else {
      const title = `chore(${task.area.toLowerCase()}): ${safeText(task.title)}`.slice(0, 100);
      const created = await repo.runner.run(
        "gh",
        [
          "pr",
          "create",
          "--base",
          integration,
          "--head",
          `task/${id}`,
          "--draft=false",
          "--title",
          title,
          "--body-file",
          bodyPath,
        ],
        repo.root,
      );
      if (created.exitCode !== 0) {
        throw new TaskToolError(4, `PR creation failed; body retained at ${bodyPath}`);
      }
      const value = created.stdout.trim();
      pr = parsePr(
        JSON.stringify({
          url: value,
          body: "",
          headRefOid: (await gitText(work, "rev-parse", "HEAD")).trim(),
          baseRefName: integration,
          statusCheckRollup: null,
        }),
      ).url;
    }
  }
  return {
    schemaVersion: 1 as const,
    command: "finish" as const,
    id,
    status: "in_review" as const,
    bodyPath,
    pr,
  };
}
