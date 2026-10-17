import { execFile } from "node:child_process";
import { dirname } from "node:path";
import { safeDirectory } from "./files.ts";

export interface RunOptions {
  cwd: string;
  timeout?: number;
  maxBuffer?: number;
  env?: Readonly<Record<string, string>>;
}
export interface RunResult {
  status: number;
  stdout: Buffer;
  stderr: Buffer;
}
export interface Runner {
  run(file: string, args: readonly string[], options: RunOptions): Promise<RunResult>;
}

export class NodeRunner implements Runner {
  private readonly root: string;
  constructor(root: string) {
    this.root = root;
  }
  run(file: string, args: readonly string[], options: RunOptions): Promise<RunResult> {
    const cwd = safeDirectory(this.root, options.cwd);
    if (options.env && Object.keys(options.env).some((name) => name !== "OVERMIND_DATA_DIR")) {
      return Promise.reject(new Error("Unsupported child environment"));
    }
    return new Promise((resolve, reject) => {
      execFile(
        file,
        [...args],
        {
          cwd,
          shell: false,
          encoding: "buffer",
          timeout: options.timeout ?? 60000,
          killSignal: "SIGKILL",
          maxBuffer: options.maxBuffer ?? 4 * 1024 * 1024,
          env: {
            PATH: `${dirname(process.execPath)}:${process.env["PATH"] ?? "/usr/bin:/bin"}`,
            LANG: "C",
            TZ: "UTC",
            SOURCE_DATE_EPOCH: "0",
            ...options.env,
          },
        },
        (error, stdout, stderr) => {
          if (error && (typeof error.code !== "number" || error.killed)) {
            reject(new Error("Process failed or exceeded limits"));
            return;
          }
          resolve({
            status: error && typeof error.code === "number" ? error.code : 0,
            stdout,
            stderr,
          });
        },
      );
    });
  }
}
export async function execute(
  runner: Runner,
  file: string,
  args: readonly string[],
  options: RunOptions,
): Promise<Buffer> {
  const result = await runner.run(file, args, options);
  if (result.status !== 0) {
    throw new Error("Packaging command failed");
  }
  return result.stdout;
}
export async function rejectQuarantine(runner: Runner, path: string, cwd: string): Promise<void> {
  const attributes = await execute(runner, "/usr/bin/xattr", ["-l", path], { cwd });
  if (attributes.includes("com.apple.quarantine")) {
    throw new Error("Quarantined packaging input is refused");
  }
}
export async function clearCreatedQuarantine(
  runner: Runner,
  path: string,
  cwd: string,
): Promise<void> {
  const attributes = await execute(runner, "/usr/bin/xattr", ["-l", path], { cwd });
  if (attributes.includes("com.apple.quarantine")) {
    await execute(runner, "/usr/bin/xattr", ["-d", "com.apple.quarantine", path], { cwd });
  }
}
