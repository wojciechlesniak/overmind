import { execFileSync } from "node:child_process";
import { readEvent } from "./context.parse-boundary.ts";
const pr = readEvent().pull_request;
if (pr) {
  const files = execFileSync("git", ["diff", "--name-only", "-z", pr.base.sha, pr.head.sha], {
    encoding: "utf8",
  }).split("\0");
  const protectedFiles = files.filter((file) =>
    /^(?:lefthook(?:-secrets)?\.yml|commitlint\.config\.mjs|eslint\.config[^/]*(?:\/.*)?|vitest(?:\.shared|\.ci\.config)\.ts|\.github\/actionlint\.yaml|\.github\/workflows\/.*|\.github\/actions\/.*|deny\.toml|\.gitleaks\.toml|tools\/pinned-bin\/lock\.json|tools\/check-licenses\/(?:allowlist|exceptions)\.json|tools\/commitlint\/.*)$/u.test(
      file,
    ),
  );
  const labels = new Set(pr.labels.map((label) => label.name));
  if (protectedFiles.length && !labels.has("config-change")) {
    throw new Error(
      `Protected configuration changes require config-change: ${protectedFiles.join(", ")}`,
    );
  }
  if (
    files.some((file) => file === "lefthook.yml" || file === "commitlint.config.mjs") &&
    !labels.has("hooks-change")
  ) {
    throw new Error("Hook configuration changes also require hooks-change");
  }
}
