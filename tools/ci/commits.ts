import { execFileSync } from "node:child_process";
import { readEvent } from "./context.parse-boundary.ts";
for (const name of ["CI_BASE", "CI_HEAD"]) {
  if (!/^[a-f0-9]{40}$/u.test(process.env[name] ?? "")) {
    throw new Error(`Invalid ${name}`);
  }
}
execFileSync(
  "pnpm",
  [
    "exec",
    "commitlint",
    "--from",
    process.env["CI_BASE"] ?? "",
    "--to",
    process.env["CI_HEAD"] ?? "",
  ],
  { stdio: "inherit", shell: false },
);
const pr = readEvent().pull_request;
if (pr) {
  if (/[\r\n]/u.test(pr.title)) {
    throw new Error("PR title must be one line");
  }
  execFileSync("pnpm", ["exec", "commitlint", "--config", "tools/ci/commitlint-title.config.mjs"], {
    input: pr.title,
    stdio: ["pipe", "inherit", "inherit"],
    shell: false,
  });
}
