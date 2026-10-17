import { execFile } from "node:child_process";
import { TaskToolError } from "./errors.ts";

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}
export interface Runner {
  run(executable: string, args: readonly string[], cwd: string): Promise<CommandResult>;
}
export interface Git {
  run(...args: string[]): Promise<CommandResult>;
  at(cwd: string): Git;
}

export function createRunner(environment: NodeJS.ProcessEnv = process.env): Runner {
  return {
    run(executable, args, cwd) {
      return new Promise((resolve) => {
        execFile(
          executable,
          args,
          { cwd, env: environment, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 600000 },
          (error, stdout, stderr) => {
            resolve({
              exitCode: !error
                ? 0
                : typeof error.code === "number"
                  ? error.code
                  : error.code === "ENOENT"
                    ? 127
                    : 1,
              stdout,
              stderr,
            });
          },
        );
      });
    },
  };
}

export function createGit(cwd: string, runner: Runner = createRunner()): Git {
  return {
    run: (...args) => runner.run("git", args, cwd),
    at: (directory) => createGit(directory, runner),
  };
}

export async function gitText(git: Git, ...args: string[]): Promise<string> {
  const result = await git.run(...args);
  if (result.exitCode !== 0) {
    // stderr may include remote credential details; never publish it in CLI errors.
    throw new TaskToolError(
      4,
      `Git ${args[0] ?? "command"} failed (exit ${String(result.exitCode)})`,
    );
  }
  return result.stdout;
}

export function git(...args: string[]): Promise<string> {
  return gitText(createGit(process.cwd()), ...args);
}
