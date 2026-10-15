import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
export function cleanup(run) {
  let failed = false;
  for (const [list, remove] of [
    [
      ["list", "--all", "--quiet"],
      ["delete", "--force"],
    ],
    [
      ["volume", "list", "--quiet"],
      ["volume", "delete"],
    ],
  ]) {
    const result = run(list);
    if (result.error || result.status !== 0) {
      failed = true;
      continue;
    }
    for (const name of result.stdout.trim().split("\n").filter(Boolean)) {
      if (!/^ovm-ci-[a-zA-Z0-9_.-]+$/u.test(name)) {
        continue;
      }
      const removed = run([...remove, name]);
      if (removed.error || removed.status !== 0) {
        failed = true;
      }
    }
  }
  const stopped = run(["system", "stop"]);
  return !failed && !stopped.error && stopped.status === 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const executable = process.argv[2] ?? "";
  if (!isAbsolute(executable)) {
    throw new Error("An absolute trusted container executable is required");
  }
  process.exitCode = cleanup((args) =>
    spawnSync(executable, args, { encoding: "utf8", shell: false }),
  )
    ? 0
    : 1;
}
