import { execFileSync } from "node:child_process";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";
export interface Clock {
  today(): string;
}
export interface Git {
  run(args: readonly string[]): string;
}
export function nodeGit(root: string): Git {
  return {
    run(args) {
      try {
        return execFileSync("git", [...args], {
          cwd: root,
          env: isolatedGitEnvironment(),
          encoding: "utf8",
          timeout: 15000,
          maxBuffer: 2 * 1024 * 1024,
          stdio: ["ignore", "pipe", "ignore"],
        });
      } catch {
        throw new Error("ADR Git operation is unavailable or exceeds its limits");
      }
    },
  };
}
export const systemClock: Clock = { today: () => new Date().toISOString().slice(0, 10) };
export function observedNumbers(git: Git, local: readonly string[]): number {
  git.run(["fetch", "--no-tags", "origin", "DEVELOP"]);
  const base = git.run(["rev-parse", "origin/DEVELOP"]).trim();
  if (!/^[a-f0-9]{40}$/u.test(base)) {
    throw new Error("Invalid integration commit");
  }
  const paths = [
    ...local,
    ...git.run(["ls-tree", "-r", "--name-only", "-z", base, "--", "docs/adr"]).split("\0"),
  ];
  const heads = git.run(["ls-remote", "--heads", "origin", "refs/heads/task/*"]).trim();
  const lines = heads ? heads.split("\n") : [];
  if (lines.length > 1000) {
    throw new Error("Too many task reservations");
  }
  for (const line of lines) {
    const match = /^([a-f0-9]{40})\t(refs\/heads\/task\/OVE_[A-Z]{2,6}\d{3})$/u.exec(line);
    if (!match) {
      throw new Error("Invalid task branch reservation");
    }
    const sha = match[1] ?? "";
    git.run(["fetch", "--no-tags", "origin", sha]);
    paths.push(
      ...git
        .run(["diff", "--name-only", "--diff-filter=A", "-z", base, sha, "--", "docs/adr"])
        .split("\0"),
    );
  }
  if (paths.length > 10000) {
    throw new Error("Too many ADR reservation paths");
  }
  return nextNumber(
    paths.flatMap((path) => {
      const match = /^docs\/adr\/(\d{4})-[^/]+\.md$/u.exec(path);
      return match ? [Number(match[1])] : [];
    }),
  );
}
import { nextNumber } from "./model.ts";
