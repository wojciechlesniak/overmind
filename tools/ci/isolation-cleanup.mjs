import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
export function cleanup(
  run = (args) => spawnSync("container", args, { encoding: "utf8", shell: false }),
) {
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
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = cleanup() ? 0 : 1;
}
