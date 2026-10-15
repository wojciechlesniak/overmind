import { execFileSync } from "node:child_process";
import { existsSync, appendFileSync } from "node:fs";
import { readEvent } from "./context.parse-boundary.ts";
import { readManifest } from "../test-support/json.parse-boundary.ts";
const event = readEvent();
const head =
  event.pull_request?.head.sha ?? event.merge_group?.head_sha ?? process.env["GITHUB_SHA"];
let base = event.pull_request?.base.sha ?? event.merge_group?.base_sha ?? event.before;
if (!base || /^0+$/u.test(base)) {
  base = execFileSync("git", ["rev-parse", "HEAD^"], { encoding: "utf8" }).trim();
}
if (!head || !/^[a-f0-9]{40}$/u.test(head) || !/^[a-f0-9]{40}$/u.test(base)) {
  throw new Error("Invalid CI comparison SHA");
}
const files = execFileSync("git", ["diff", "--name-only", "-z", base, head], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const desktopScripts = readManifest("apps/desktop/package.json").scripts ?? {};
const outputs = {
  base,
  head,
  full: String(!event.pull_request?.draft),
  rust: String(
    existsSync("apps/desktop/src-tauri/Cargo.toml") &&
      files.some((file) => file.startsWith("apps/desktop/src-tauri/") || file === "Cargo.lock"),
  ),
  desktop: String(Boolean(desktopScripts["test:e2e"] && desktopScripts["test:visual"])),
};
const destination = process.env["GITHUB_OUTPUT"];
if (!destination) {
  throw new Error("GITHUB_OUTPUT is required");
}
appendFileSync(
  destination,
  Object.entries(outputs)
    .map(([key, value]) => `${key}=${value}\n`)
    .join(""),
);
