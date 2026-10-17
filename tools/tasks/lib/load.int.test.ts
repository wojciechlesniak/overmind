import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { isolatedGitEnvironment } from "../../hooks/git-test-environment.ts";
import { createGit, createRunner, gitText } from "./git.ts";
import { loadTasks } from "./load.ts";

it("loads committed task metadata independently of dirty working-tree edits", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ove-task-load-")));
  const git = createGit(root, createRunner(isolatedGitEnvironment()));
  const path = "tasks/OVE_FIX001/TASK.md";
  const text = readFileSync(
    new URL("../fixtures/tasks/OVE_FIX001/TASK.md", import.meta.url),
    "utf8",
  );
  try {
    mkdirSync(join(root, "tasks/OVE_FIX001"), { recursive: true });
    writeFileSync(join(root, path), text);
    writeFileSync(join(root, "tasks/PLAN.md"), "## 2. Area codes\n\n| FIX | Fixture | 1 |\n");
    await gitText(git, "init", "--initial-branch=DEVELOP");
    await gitText(git, "config", "user.name", "Fixture");
    await gitText(git, "config", "user.email", "fixture@example.invalid");
    await gitText(git, "add", "tasks");
    await gitText(git, "commit", "-m", "fixture");
    writeFileSync(join(root, path), text.replace("status: todo", "status: in_review"));
    expect((await loadTasks("HEAD", { root, git })).get("OVE_FIX001")?.status).toBe("todo");
    expect((await loadTasks("WORKTREE", { root, git })).get("OVE_FIX001")?.status).toBe(
      "in_review",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("refuses symlinked working-tree task inputs even when their target is inside the repository", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ove-task-symlink-")));
  const text = readFileSync(
    new URL("../fixtures/tasks/OVE_FIX001/TASK.md", import.meta.url),
    "utf8",
  );
  try {
    mkdirSync(join(root, "tasks/OVE_FIX001"), { recursive: true });
    writeFileSync(join(root, "fixture.md"), text);
    writeFileSync(join(root, "tasks/PLAN.md"), "## 2. Area codes\n\n| FIX | Fixture | 1 |\n");
    symlinkSync(join(root, "fixture.md"), join(root, "tasks/OVE_FIX001/TASK.md"));
    await expect(loadTasks("WORKTREE", { root })).rejects.toThrow(/symlink/iu);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
