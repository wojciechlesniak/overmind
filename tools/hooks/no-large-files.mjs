import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function largeFiles(files) {
  return files.filter((file) => {
    if (/^(?:tasks|docs)\/.*\.png$/u.test(file)) {
      return false;
    }
    const size = execFileSync("git", ["cat-file", "-s", `:${file}`], {
      encoding: "utf8",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    if (!/^\d+$/u.test(size) || !Number.isSafeInteger(Number(size))) {
      throw new Error(`Cannot determine staged blob size: ${file}`);
    }
    return Number(size) > 1024 * 1024;
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const rejected = largeFiles(process.argv.slice(2).filter((file) => file !== "--"));
  if (rejected.length) {
    process.stderr.write(`Files exceed 1 MiB: ${rejected.join(", ")}\n`);
    process.exitCode = 1;
  }
}
