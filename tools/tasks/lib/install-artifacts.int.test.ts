import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  readlinkSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { isolatedGitEnvironment } from "../../hooks/git-test-environment.ts";
import { createGit, createRunner, gitText } from "./git.ts";
import type { Runner } from "./git.ts";
import { runCommand } from "./service.ts";

async function installedRace(change?: (path: string) => void, inventoryUnavailable = false) {
  const directory = mkdtempSync("/private/tmp/ove-install-claim-");
  try {
    const remote = join(directory, "remote.git");
    const root = join(directory, "a/repo");
    mkdirSync(root, { recursive: true });
    const real = createRunner({
      ...isolatedGitEnvironment(),
      COREPACK_ENABLE_NETWORK: "0",
      npm_config_offline: "true",
    });
    const git = createGit(root, real);
    await gitText(git, "init", "--bare", remote);
    await gitText(git, "init", "--initial-branch=DEVELOP");
    await gitText(git, "config", "user.name", "Fixture");
    await gitText(git, "config", "user.email", "fixture@example.invalid");
    mkdirSync(join(root, "tasks/OVE_FIX001"), { recursive: true });
    writeFileSync(
      join(root, "tasks/OVE_FIX001/TASK.md"),
      readFileSync(new URL("../fixtures/tasks/OVE_FIX001/TASK.md", import.meta.url), "utf8"),
    );
    writeFileSync(join(root, "tasks/PLAN.md"), "## 2. Area codes\n\n| FIX | Fixture | 1 |\n");
    writeFileSync(join(root, ".gitignore"), "node_modules/\n.cache/\n.tsbuild/\nprivate.txt\n");
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        private: true,
        packageManager: "pnpm@12.11.2",
        dependencies: { "@fixture/local": "workspace:*" },
      }),
    );
    writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
    for (const name of ["local", "peer"]) {
      mkdirSync(join(root, "packages", name), { recursive: true });
      writeFileSync(
        join(root, "packages", name, "package.json"),
        JSON.stringify({
          name: "@fixture/" + name,
          version: "1.0.0",
          ...(name === "local" ? { dependencies: { "@fixture/peer": "workspace:*" } } : {}),
        }),
      );
    }
    const lock = await real.run(
      "pnpm",
      ["install", "--lockfile-only", "--offline", "--ignore-scripts"],
      root,
    );
    expect(lock.exitCode, lock.stderr).toBe(0);
    await gitText(git, "add", ".");
    await gitText(git, "commit", "-m", "fixture with local workspace dependencies");
    await gitText(git, "remote", "add", "origin", remote);
    await gitText(git, "push", "origin", "DEVELOP");
    const second = join(directory, "b/repo");
    mkdirSync(join(directory, "b"));
    await gitText(git, "clone", "--branch", "DEVELOP", remote, second);
    await gitText(git.at(second), "config", "user.name", "Fixture");
    await gitText(git.at(second), "config", "user.email", "fixture@example.invalid");
    let arrivals = 0;
    let ready: () => void = () => {
      throw new Error("Missing race barrier");
    };
    const barrier = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const runner: Runner = {
      async run(executable, args, cwd) {
        if (inventoryUnavailable && executable === "git" && args[0] === "ls-files") {
          return { exitCode: 7, stdout: "", stderr: "private inventory diagnostics" };
        }
        if (
          executable === "git" &&
          args[0] === "push" &&
          args.some((arg) => arg.startsWith("--force-with-lease="))
        ) {
          expect(existsSync(join(cwd, "node_modules/.modules.yaml"))).toBe(true);
          expect(existsSync(join(cwd, "packages/local/node_modules/@fixture/peer"))).toBe(true);
          change?.(cwd);
          arrivals += 1;
          if (arrivals === 2) {
            ready();
          }
          await barrier;
        }
        return real.run(executable, args, cwd);
      },
    };
    return {
      directory,
      git,
      worktrees: [join(directory, "a/wt/OVE_FIX001"), join(directory, "b/wt/OVE_FIX001")],
      run: () =>
        Promise.allSettled([
          runCommand("claim", ["OVE_FIX001"], { root, runner }),
          runCommand("claim", ["OVE_FIX001"], { root: second, runner }),
        ]),
    };
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

it("cleans only the losing real frozen installation after an atomic two-clone claim race", async () => {
  const fixture = await installedRace();
  try {
    const results = await fixture.run();
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const loser = results.findIndex((result) => result.status === "rejected");
    expect(results[loser]).toMatchObject({ status: "rejected", reason: { exitCode: 3 } });
    const path = fixture.worktrees[loser]!;
    expect(existsSync(path)).toBe(false);
    const primary = join(fixture.directory, loser === 0 ? "a/repo" : "b/repo");
    expect(
      (
        await fixture.git
          .at(primary)
          .run("show-ref", "--verify", "--quiet", "refs/heads/task/OVE_FIX001")
      ).exitCode,
    ).toBe(1);
    expect(
      (await gitText(fixture.git, "ls-remote", "--heads", "origin", "refs/heads/task/OVE_FIX001"))
        .trim()
        .split("\n"),
    ).toHaveLength(1);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

const privateMarker = "private fixture data that must survive";

it.each([
  {
    name: "an unknown ignored file inside node_modules",
    change(path: string) {
      writeFileSync(join(path, "node_modules/owner-private.txt"), privateMarker);
    },
    verify(path: string) {
      expect(readFileSync(join(path, "node_modules/owner-private.txt"), "utf8")).toBe(
        privateMarker,
      );
    },
  },
  {
    name: "a modified installation file",
    change(path: string) {
      writeFileSync(join(path, "node_modules/.modules.yaml"), privateMarker);
    },
    verify(path: string) {
      expect(readFileSync(join(path, "node_modules/.modules.yaml"), "utf8")).toBe(privateMarker);
    },
  },
  {
    name: "an unknown ignored hook output",
    change(path: string) {
      mkdirSync(join(path, ".cache/tools"), { recursive: true });
      writeFileSync(join(path, ".cache/tools/owner-private.txt"), privateMarker);
      mkdirSync(join(path, ".tsbuild"));
      writeFileSync(join(path, ".tsbuild/owner-private.txt"), privateMarker);
    },
    verify(path: string) {
      expect(readFileSync(join(path, ".cache/tools/owner-private.txt"), "utf8")).toBe(
        privateMarker,
      );
      expect(readFileSync(join(path, ".tsbuild/owner-private.txt"), "utf8")).toBe(privateMarker);
    },
  },
  {
    name: "an unknown ignored empty directory",
    change(path: string) {
      mkdirSync(join(path, ".cache/owner-empty"), { recursive: true });
    },
    verify(path: string) {
      expect(existsSync(join(path, ".cache/owner-empty"))).toBe(true);
    },
  },
  {
    name: "a retargeted installation symlink",
    change(path: string) {
      const outside = join(path, "..", "owner-private.txt");
      writeFileSync(outside, privateMarker);
      rmSync(join(path, "node_modules/@fixture/local"));
      symlinkSync(outside, join(path, "node_modules/@fixture/local"));
    },
    verify(path: string) {
      const outside = join(path, "..", "owner-private.txt");
      expect(readlinkSync(join(path, "node_modules/@fixture/local"))).toBe(outside);
      expect(readFileSync(outside, "utf8")).toBe(privateMarker);
    },
  },
])("preserves $name added after installation while reporting the lost race", async (scenario) => {
  const fixture = await installedRace((path) => {
    scenario.change(path);
  });
  try {
    const results = await fixture.run();
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const loser = results.findIndex((result) => result.status === "rejected");
    expect(results[loser]).toMatchObject({
      status: "rejected",
      reason: {
        exitCode: 3,
      },
    });
    const path = fixture.worktrees[loser]!;
    scenario.verify(path);
    const primary = join(fixture.directory, loser === 0 ? "a/repo" : "b/repo");
    expect(
      (
        await fixture.git
          .at(primary)
          .run("show-ref", "--verify", "--quiet", "refs/heads/task/OVE_FIX001")
      ).exitCode,
    ).toBe(0);
    const rejected = results[loser];
    if (rejected?.status === "rejected") {
      expect(String(rejected.reason)).toContain("worktree retained for inspection");
      expect(String(rejected.reason)).not.toContain(privateMarker);
    }
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

it("retains a lost claim when installation inventory cannot be verified", async () => {
  const fixture = await installedRace(undefined, true);
  try {
    const results = await fixture.run();
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const loser = results.findIndex((result) => result.status === "rejected");
    expect(results[loser]).toMatchObject({
      status: "rejected",
      reason: { exitCode: 3 },
    });
    expect(existsSync(fixture.worktrees[loser]!)).toBe(true);
    const rejected = results[loser];
    if (rejected?.status === "rejected") {
      expect(String(rejected.reason)).toContain("retained for inspection");
      expect(String(rejected.reason)).not.toContain("private inventory diagnostics");
    }
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});
