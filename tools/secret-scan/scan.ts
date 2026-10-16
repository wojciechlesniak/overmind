import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { readSecretCounts } from "./report.parse-boundary.ts";

export function scanSecrets(options: {
  binary: string;
  config: string;
  cwd: string;
  report: string;
  mode: "range" | "all" | "tree" | "staged";
  base?: string;
  head?: string;
  env?: NodeJS.ProcessEnv;
}) {
  const result = spawnSync(
    "/bin/bash",
    [
      resolve(import.meta.dirname, "scan.sh"),
      options.binary,
      options.cwd,
      options.report,
      options.mode,
      options.base ?? "",
      options.head ?? "",
      options.config,
    ],
    {
      cwd: options.cwd,
      env: options.env,
      encoding: "utf8",
      shell: false,
      timeout: 120000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  if (result.error || (result.status !== 0 && result.status !== 1)) {
    throw new Error("Secret scanner execution unavailable");
  }
  const counts = readSecretCounts(options.report);
  if (result.status === 1 && counts.findings + counts.warnings === 0) {
    throw new Error("Secret scanner failed without a valid finding report");
  }
  // Keychain literal commands are the warning-only guard requested by TASK007.
  // Never echo scanner output or matching source; only counts leave this wrapper.
  return counts;
}
