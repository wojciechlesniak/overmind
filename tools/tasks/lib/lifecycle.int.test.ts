import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { isolatedGitEnvironment } from "../../hooks/git-test-environment.ts";
import { createGit, createRunner, gitText } from "./git.ts";
import { runCommand } from "./service.ts";
import { writeFileSync } from "node:fs";
import type { Runner } from "./git.ts";
import { outputSchema } from "./output.ts";

// Each scenario creates real repositories and runs multiple Git subprocesses.
// Keep that fixture budget separate from the production subprocess limits.
vi.setConfig({ testTimeout: 30_000 });

async function fixture() {
  const directory = mkdtempSync("/private/tmp/ove-task-life-");
  const remote = join(directory, "remote.git");
  const root = join(directory, "a", "repo");
  mkdirSync(root, { recursive: true });
  const runner = createRunner(isolatedGitEnvironment());
  const git = createGit(root, runner);
  await gitText(git, "init", "--bare", remote);
  await gitText(git, "init", "--initial-branch=DEVELOP");
  await gitText(git, "config", "user.name", "Fixture");
  await gitText(git, "config", "user.email", "fixture@example.invalid");
  mkdirSync(join(root, "tasks/OVE_FIX001"), { recursive: true });
  const text = readFileSync(
    new URL("../fixtures/tasks/OVE_FIX001/TASK.md", import.meta.url),
    "utf8",
  );
  writeFileSync(join(root, "tasks/OVE_FIX001/TASK.md"), text);
  writeFileSync(join(root, "tasks/PLAN.md"), "## 2. Area codes\n\n| FIX | Fixture | 1 |\n");
  await gitText(git, "add", "tasks");
  await gitText(git, "commit", "-m", "fixture base");
  await gitText(git, "remote", "add", "origin", remote);
  await gitText(git, "push", "origin", "DEVELOP");
  return { directory, root, remote, runner, git };
}

it("claims from merged integration metadata despite dirty local task edits", async () => {
  const f = await fixture();
  try {
    const path = join(f.root, "tasks/OVE_FIX001/TASK.md");
    const original = readFileSync(path, "utf8");
    writeFileSync(path, original.replace("status: todo", "status: cancelled"));
    const result = await runCommand("claim", ["OVE_FIX001", "--install=false"], {
      root: f.root,
      runner: f.runner,
    });
    expect(result).toMatchObject({
      schemaVersion: 1,
      command: "claim",
      id: "OVE_FIX001",
      worktree: join(f.directory, "a/wt/OVE_FIX001"),
    });
    expect(readFileSync(path, "utf8")).toContain("status: cancelled");
    const taskGit = f.git.at(join(f.directory, "a/wt/OVE_FIX001"));
    expect(await gitText(taskGit, "rev-list", "--count", "origin/DEVELOP..HEAD")).toBe("1\n");
    expect(
      readFileSync(join(f.directory, "a/wt/OVE_FIX001/tasks/OVE_FIX001/TASK.md"), "utf8"),
    ).toContain("status: in_progress");
    await expect(
      runCommand("claim", ["OVE_FIX001", "--install=false"], { root: f.root, runner: f.runner }),
    ).rejects.toMatchObject({ exitCode: 2 });
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

it("lists only ready unclaimed tasks and reports the live claim separately from integration status", async () => {
  const f = await fixture();
  try {
    await runCommand("claim", ["OVE_FIX001", "--install=false"], {
      root: f.root,
      runner: f.runner,
    });
    const next = await runCommand("next", ["--json"], { root: f.root, runner: f.runner });
    expect(next).toMatchObject({ schemaVersion: 1, command: "next", tasks: [] });
    const status = await runCommand("status", ["--mine", "--json"], {
      root: f.root,
      runner: f.runner,
    });
    expect(status).toMatchObject({
      command: "status",
      ready: [],
      counts: [{ area: "FIX", todo: 1, done: 0 }],
      claims: [
        {
          id: "OVE_FIX001",
          author: "Fixture",
          status: "in_progress",
          integrationStatus: "todo",
          stale: false,
        },
      ],
    });
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

it("ranks ready tasks by priority and downstream work, placing live ownership conflicts last", async () => {
  const f = await fixture();
  try {
    const source = readFileSync(join(f.root, "tasks/OVE_FIX001/TASK.md"), "utf8");
    for (const number of ["002", "003", "004"]) {
      const id = `OVE_FIX${number}`;
      mkdirSync(join(f.root, "tasks", id));
      let text = source.replaceAll("OVE_FIX001", id);
      if (number === "002") {
        text = text.replace("size: S", "size: XS");
      }
      if (number === "003") {
        text = text.replace("priority: P0", "priority: P1").replace("fixture/**", "other/**");
      }
      if (number === "004") {
        text = text.replace("depends_on: []", "depends_on: [OVE_FIX002]");
      }
      writeFileSync(join(f.root, "tasks", id, "TASK.md"), text);
    }
    await gitText(f.git, "add", "tasks");
    await gitText(f.git, "commit", "-m", "fixture dependency graph");
    await gitText(f.git, "push", "origin", "DEVELOP");
    const options = { root: f.root, runner: f.runner };
    const initial = outputSchema.parse(await runCommand("next", ["--json"], options));
    expect(initial).toMatchObject({
      command: "next",
      tasks: [{ id: "OVE_FIX002", unblocks: 1 }, { id: "OVE_FIX001" }, { id: "OVE_FIX003" }],
    });
    await runCommand("claim", ["OVE_FIX001", "--install=false"], options);
    const next = outputSchema.parse(await runCommand("next", ["--json"], options));
    expect(next).toMatchObject({
      command: "next",
      tasks: [
        { id: "OVE_FIX003", conflicts: [] },
        { id: "OVE_FIX002", conflicts: [{ id: "OVE_FIX001" }] },
      ],
    });
    await expect(
      runCommand("claim", ["OVE_FIX004", "--install=false"], options),
    ).rejects.toMatchObject({ exitCode: 2 });
    const status = outputSchema.parse(await runCommand("status", ["--json"], options));
    expect(status).toMatchObject({
      command: "status",
      ready: ["OVE_FIX002", "OVE_FIX003"],
      counts: [{ area: "FIX", todo: 4 }],
    });
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
}, 30_000);

it("performs a real frozen install and prepare in the new worktree by default", async () => {
  const f = await fixture();
  try {
    writeFileSync(
      join(f.root, "package.json"),
      JSON.stringify({
        private: true,
        name: "task-install-fixture",
        packageManager: "pnpm@12.11.2",
        scripts: { prepare: "node prepare.cjs" },
      }),
    );
    writeFileSync(
      join(f.root, "prepare.cjs"),
      "require('node:fs').writeFileSync('prepared-marker', process.cwd())\n",
    );
    writeFileSync(join(f.root, ".gitignore"), "node_modules/\nprepared-marker\n");
    const lock = await f.runner.run("pnpm", ["install", "--lockfile-only"], f.root);
    expect(lock.exitCode, lock.stderr).toBe(0);
    await gitText(f.git, "add", "package.json", "pnpm-lock.yaml", "prepare.cjs", ".gitignore");
    await gitText(f.git, "commit", "-m", "fixture package installation");
    await gitText(f.git, "push", "origin", "DEVELOP");
    const result = outputSchema.parse(
      await runCommand("claim", ["OVE_FIX001"], { root: f.root, runner: f.runner }),
    );
    expect(result.command).toBe("claim");
    const path = join(f.directory, "a/wt/OVE_FIX001");
    expect(readFileSync(join(path, "prepared-marker"), "utf8")).toBe(path);
    expect(await gitText(f.git.at(path), "rev-list", "--count", "origin/DEVELOP..HEAD")).toBe(
      "1\n",
    );
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

it("refuses to reuse a PR targeting a branch other than DEVELOP", async () => {
  const f = await fixture();
  const runner: Runner = {
    run(program, args, cwd) {
      if (program !== "gh") {
        return f.runner.run(program, args, cwd);
      }
      return Promise.resolve({
        exitCode: 0,
        stderr: "",
        stdout:
          args[0] === "--version"
            ? "fixture gh"
            : JSON.stringify({
                url: "https://github.com/fixture/repo/pull/1",
                body: "",
                headRefOid: "a".repeat(40),
                baseRefName: "master",
                statusCheckRollup: null,
              }),
      });
    },
  };
  try {
    await runCommand("claim", ["OVE_FIX001", "--install=false"], { root: f.root, runner });
    await expect(
      runCommand("finish", ["OVE_FIX001"], { root: join(f.directory, "a/wt/OVE_FIX001"), runner }),
    ).rejects.toMatchObject({ exitCode: 2 });
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

it("allows release only for an owned claim without implementation commits", async () => {
  const f = await fixture();
  try {
    await runCommand("claim", ["OVE_FIX001", "--install=false"], {
      root: f.root,
      runner: f.runner,
    });
    const result = await runCommand("release", ["OVE_FIX001"], { root: f.root, runner: f.runner });
    expect(result).toMatchObject({ command: "release", id: "OVE_FIX001" });
    expect(
      await gitText(f.git, "ls-remote", "--heads", "origin", "refs/heads/task/OVE_FIX001"),
    ).toBe("");
    await runCommand("claim", ["OVE_FIX001", "--install=false"], {
      root: f.root,
      runner: f.runner,
    });
    const work = f.git.at(join(f.directory, "a/wt/OVE_FIX001"));
    await gitText(work, "commit", "--allow-empty", "-m", "implementation commit");
    await gitText(work, "push", "origin", "HEAD:refs/heads/task/OVE_FIX001");
    await expect(
      runCommand("release", ["OVE_FIX001", "--force-owner"], { root: f.root, runner: f.runner }),
    ).rejects.toMatchObject({ exitCode: 2 });
    expect(
      await gitText(f.git, "ls-remote", "--heads", "origin", "refs/heads/task/OVE_FIX001"),
    ).toContain("refs/heads/task/OVE_FIX001");
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
}, 30_000);

it("never releases an implementation commit hidden before a status-only claim, even with maintainer override", async () => {
  const f = await fixture();
  const path = join(f.directory, "a/wt/OVE_FIX001");
  try {
    writeFileSync(join(f.root, "implementation.txt"), "unmerged developer implementation");
    await gitText(f.git, "add", "implementation.txt");
    await gitText(f.git, "commit", "-m", "unmerged implementation before claim");
    mkdirSync(join(f.directory, "a/wt"));
    await gitText(f.git, "worktree", "add", "-b", "task/OVE_FIX001", path, "HEAD");
    const work = f.git.at(path);
    const taskPath = join(path, "tasks/OVE_FIX001/TASK.md");
    writeFileSync(
      taskPath,
      readFileSync(taskPath, "utf8").replace("status: todo", "status: in_progress"),
    );
    await gitText(work, "add", "tasks/OVE_FIX001/TASK.md");
    await gitText(
      work,
      "commit",
      "-m",
      "chore(fix): claim OVE_FIX001\n\nRefs: OVE_FIX001\nClaimed-By: Fixture\n",
    );
    await gitText(work, "push", "origin", "HEAD:refs/heads/task/OVE_FIX001");
    const head = (await gitText(work, "rev-parse", "HEAD")).trim();
    expect(await gitText(work, "rev-list", "--count", "origin/DEVELOP..HEAD")).toBe("2\n");
    await gitText(f.git, "config", "overmind.maintainer", "true");
    for (const flags of [[], ["--force-owner"]]) {
      await expect(
        runCommand("release", ["OVE_FIX001", ...flags], { root: f.root, runner: f.runner }),
      ).rejects.toMatchObject({ exitCode: 2 });
      expect(
        await gitText(f.git, "ls-remote", "--heads", "origin", "refs/heads/task/OVE_FIX001"),
      ).toContain(head);
      expect(readFileSync(join(path, "implementation.txt"), "utf8")).toBe(
        "unmerged developer implementation",
      );
    }
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

it("cleans only merged fully pushed worktrees and retains remote branches and dirty data", async () => {
  const f = await fixture();
  try {
    await runCommand("claim", ["OVE_FIX001", "--install=false"], {
      root: f.root,
      runner: f.runner,
    });
    const path = join(f.directory, "a/wt/OVE_FIX001");
    const work = f.git.at(path);
    await gitText(f.git, "fetch", "origin", "task/OVE_FIX001");
    await gitText(f.git, "merge", "--ff-only", "FETCH_HEAD");
    await gitText(f.git, "push", "origin", "DEVELOP");
    writeFileSync(join(f.root, ".git/info/exclude"), "private.env\n");
    writeFileSync(join(path, "private.env"), "fixture-owned data");
    expect(await gitText(work, "status", "--porcelain")).toBe("");
    await expect(
      runCommand("cleanup", ["OVE_FIX001"], { root: f.root, runner: f.runner }),
    ).rejects.toMatchObject({ exitCode: 2 });
    expect(readFileSync(join(path, "private.env"), "utf8")).toBe("fixture-owned data");
    rmSync(join(path, "private.env"));
    expect(await gitText(work, "status", "--porcelain")).toBe("");
    expect(
      await runCommand("cleanup", ["--merged"], { root: f.root, runner: f.runner }),
    ).toMatchObject({ command: "cleanup", removed: ["OVE_FIX001"] });
    expect(
      await gitText(f.git, "ls-remote", "--heads", "origin", "refs/heads/task/OVE_FIX001"),
    ).toContain("refs/heads/task/OVE_FIX001");
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

it("retains the worktree when new work appears while a claim is being released", async () => {
  const f = await fixture();
  const path = join(f.directory, "a/wt/OVE_FIX001");
  const runner: Runner = {
    async run(program, args, cwd) {
      const result = await f.runner.run(program, args, cwd);
      if (
        program === "git" &&
        args[0] === "push" &&
        args.includes(":refs/heads/task/OVE_FIX001") &&
        result.exitCode === 0
      ) {
        writeFileSync(join(path, "new-work.txt"), "concurrent developer work");
        const work = f.git.at(path);
        await gitText(work, "add", "new-work.txt");
        await gitText(work, "commit", "-m", "concurrent implementation");
      }
      return result;
    },
  };
  try {
    await runCommand("claim", ["OVE_FIX001", "--install=false"], { root: f.root, runner });
    await expect(
      runCommand("release", ["OVE_FIX001"], { root: f.root, runner }),
    ).rejects.toMatchObject({ exitCode: 2 });
    expect(readFileSync(join(path, "new-work.txt"), "utf8")).toBe("concurrent developer work");
    expect(await gitText(f.git.at(path), "log", "-1", "--format=%s")).toBe(
      "concurrent implementation\n",
    );
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

it("two clones racing at the real atomic push yield one winner and one clean loser", async () => {
  const f = await fixture();
  const second = join(f.directory, "b/repo");
  mkdirSync(join(f.directory, "b"));
  let waiting = 0;
  let release: () => void = () => {
    throw new Error("Missing barrier");
  };
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const runner: Runner = {
    async run(executable, args, cwd) {
      if (executable === "git" && args[0] === "push" && args[1]?.endsWith("OVE_FIX001:")) {
        waiting++;
        if (waiting === 2) {
          release();
        }
        await barrier;
      }
      return f.runner.run(executable, args, cwd);
    },
  };
  try {
    await gitText(f.git, "clone", "--branch", "DEVELOP", f.remote, second);
    const secondGit = f.git.at(second);
    await gitText(secondGit, "config", "user.name", "Second Fixture");
    await gitText(secondGit, "config", "user.email", "second@example.invalid");
    const outcomes = await Promise.allSettled(
      [f.root, second].map((root) =>
        runCommand("claim", ["OVE_FIX001", "--install=false"], { root, runner }),
      ),
    );
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const loser = outcomes.findIndex((outcome) => outcome.status === "rejected");
    expect(outcomes[loser]).toMatchObject({ status: "rejected", reason: { exitCode: 3 } });
    expect(existsSync(join(f.directory, loser === 0 ? "a" : "b", "wt/OVE_FIX001"))).toBe(false);
    expect(
      (
        await (loser === 0 ? f.git : secondGit).run(
          "show-ref",
          "--verify",
          "--quiet",
          "refs/heads/task/OVE_FIX001",
        )
      ).exitCode,
    ).toBe(1);
  } finally {
    release();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

it("finishes to in_review, writes an escaped checklist body and fails closed without exact-head CI", async () => {
  const f = await fixture();
  const runner: Runner = {
    run: (program, args, cwd) =>
      program === "gh"
        ? Promise.resolve({ exitCode: 127, stdout: "", stderr: "" })
        : f.runner.run(program, args, cwd),
  };
  try {
    await runCommand("claim", ["OVE_FIX001", "--install=false"], { root: f.root, runner });
    const path = join(f.directory, "a/wt/OVE_FIX001");
    const result = await runCommand("finish", ["OVE_FIX001"], { root: path, runner });
    expect(result).toMatchObject({
      command: "finish",
      id: "OVE_FIX001",
      status: "in_review",
      pr: null,
    });
    if (result.command !== "finish") {
      throw new Error("Wrong result command");
    }
    const body = readFileSync(result.bodyPath, "utf8");
    expect(body).toContain("## Acceptance criteria");
    expect(body).toContain("@\u200bfixture-owner");
    expect(body).not.toContain("@fixture-owner");
    expect(readFileSync(join(path, "tasks/OVE_FIX001/TASK.md"), "utf8")).toContain(
      "status: in_review",
    );
    await expect(
      runCommand("finish", ["OVE_FIX001", "--done"], { root: path, runner }),
    ).rejects.toMatchObject({ exitCode: 4 });
    expect(readFileSync(join(path, "tasks/OVE_FIX001/TASK.md"), "utf8")).toContain(
      "status: in_review",
    );
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

it("marks done only with checked acceptance and successful CI for the exact current head", async () => {
  const f = await fixture();
  const path = join(f.directory, "a/wt/OVE_FIX001");
  let evidenceHead = "0000000000000000000000000000000000000000";
  let evidenceBody = "## Acceptance criteria\n\n- [x] First criterion\n- [x] Another criterion\n";
  let conclusion = "success";
  const runner: Runner = {
    async run(program, args, cwd) {
      if (program !== "gh") {
        return f.runner.run(program, args, cwd);
      }
      return {
        exitCode: 0,
        stderr: "",
        stdout:
          args[0] === "--version"
            ? "fixture gh"
            : JSON.stringify({
                url: "https://github.com/fixture/repo/pull/1",
                body: evidenceBody,
                headRefOid: evidenceHead,
                baseRefName: "DEVELOP",
                statusCheckRollup: [
                  "ci-success",
                  "gate",
                  "secrets",
                  "secrets-sarif",
                  "tools",
                  "sbom",
                  "dependency-review",
                ].map((name) => ({ name, status: "COMPLETED", conclusion })),
              }),
      };
    },
  };
  try {
    await runCommand("claim", ["OVE_FIX001", "--install=false"], { root: f.root, runner });
    const work = f.git.at(path);
    const taskPath = join(path, "tasks/OVE_FIX001/TASK.md");
    writeFileSync(
      taskPath,
      readFileSync(taskPath, "utf8").replace("status: in_progress", "status: in_review"),
    );
    await gitText(work, "add", "tasks/OVE_FIX001/TASK.md");
    await gitText(work, "commit", "-m", "reviewed implementation");
    await gitText(work, "push", "origin", "HEAD:refs/heads/task/OVE_FIX001");
    await expect(
      runCommand("finish", ["OVE_FIX001", "--done"], { root: path, runner }),
    ).rejects.toMatchObject({ exitCode: 2 });
    evidenceHead = (await gitText(work, "rev-parse", "HEAD")).trim();
    evidenceBody = "## Acceptance criteria\n\n- [ ] unchecked criterion\n";
    await expect(
      runCommand("finish", ["OVE_FIX001", "--done"], { root: path, runner }),
    ).rejects.toMatchObject({ exitCode: 2 });
    evidenceBody =
      "## Acceptance criteria\n\n- [x] The fixture completes its lifecycle without deleting other work.\n- [x] Mention text @\u200bfixture-owner remains inert in generated PR bodies.\n";
    conclusion = "failure";
    await expect(
      runCommand("finish", ["OVE_FIX001", "--done"], { root: path, runner }),
    ).rejects.toMatchObject({ exitCode: 2 });
    conclusion = "success";
    expect(
      await runCommand("finish", ["OVE_FIX001", "--done"], { root: path, runner }),
    ).toMatchObject({ command: "finish", status: "done" });
    expect(readFileSync(taskPath, "utf8")).toContain("status: done");
    expect(await gitText(work, "log", "-1", "--format=%s")).toBe(
      "chore(fix): mark OVE_FIX001 done\n",
    );
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

it("refuses a dangling symlink as the managed parent or target before creating a worktree", async () => {
  const f = await fixture();
  const parent = join(f.directory, "a/wt");
  try {
    symlinkSync(join(f.directory, "outside"), parent);
    await expect(
      runCommand("claim", ["OVE_FIX001", "--install=false"], { root: f.root, runner: f.runner }),
    ).rejects.toMatchObject({ exitCode: 4 });
    expect(existsSync(join(f.directory, "outside"))).toBe(false);
    rmSync(parent);
    mkdirSync(parent);
    symlinkSync(join(f.directory, "outside"), join(parent, "OVE_FIX001"));
    await expect(
      runCommand("claim", ["OVE_FIX001", "--install=false"], { root: f.root, runner: f.runner }),
    ).rejects.toMatchObject({ exitCode: 2 });
    expect(existsSync(join(f.directory, "outside"))).toBe(false);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});
