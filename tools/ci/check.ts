import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { install } from "../pinned-bin/install.ts";
import { readManifest } from "../test-support/json.parse-boundary.ts";

function pnpm(args: string[]) {
  execFileSync("pnpm", args, { stdio: "inherit", shell: false });
}
for (const command of [
  ["format:check"],
  ["lint"],
  ["typecheck"],
  ["test:coverage"],
  ["test:int"],
  ["build"],
  ["--filter", "@overmind/ui-kit", "--if-present", "run", "build:storybook"],
  ["exec", "tsx", "tools/ci/architecture.ts"],
  ["exec", "tsx", "tools/ci/workflow-lint.ts"],
  ["check:licenses"],
  ["audit", "--audit-level=high", "--prod"],
  ["audit", "--audit-level=critical"],
]) {
  pnpm(command);
}
if (existsSync("apps/desktop/src-tauri/Cargo.toml")) {
  execFileSync(
    await install("cargo-deny"),
    [
      "--manifest-path",
      "apps/desktop/src-tauri/Cargo.toml",
      "check",
      "licenses",
      "bans",
      "sources",
    ],
    { stdio: "inherit", shell: false },
  );
  for (const command of [
    ["fmt", "--manifest-path", "apps/desktop/src-tauri/Cargo.toml", "--check"],
    [
      "clippy",
      "--manifest-path",
      "apps/desktop/src-tauri/Cargo.toml",
      "--all-targets",
      "--",
      "-D",
      "warnings",
    ],
    ["test", "--manifest-path", "apps/desktop/src-tauri/Cargo.toml"],
  ]) {
    execFileSync("cargo", command, { stdio: "inherit", shell: false });
  }
}
if (existsSync("apps/desktop/src-tauri/Cargo.lock")) {
  execFileSync(
    await install("cargo-audit"),
    ["audit", "--file", "apps/desktop/src-tauri/Cargo.lock"],
    {
      stdio: "inherit",
      shell: false,
    },
  );
}
const desktop = readManifest("apps/desktop/package.json");
if (desktop.scripts?.["test:e2e"] && desktop.scripts["test:visual"]) {
  pnpm(["test:e2e"]);
  pnpm(["test:visual"]);
}
// These checks need a GitHub event; normal local commits are enforced by hooks.
if (process.env["GITHUB_EVENT_PATH"]) {
  pnpm(["exec", "tsx", "tools/ci/commits.ts"]);
  pnpm(["exec", "tsx", "tools/ci/config-integrity.ts"]);
}
