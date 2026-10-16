import { copyFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

// Keep the experiment's installation outside the product manifest inventory.
const directory = import.meta.dirname;
const target = resolve(directory, "node_modules/.toolchain");
mkdirSync(target, { recursive: true });
for (const [source, destination] of [
  ["package-manifest.json", "package.json"],
  ["pnpm-lock.yaml", "pnpm-lock.yaml"],
  ["pnpm-workspace.yaml", "pnpm-workspace.yaml"],
]) {
  copyFileSync(resolve(directory, source), resolve(target, destination));
}
execFileSync("pnpm", ["install", "--frozen-lockfile", "--ignore-workspace", "--ignore-scripts"], {
  cwd: target,
  stdio: "inherit",
});
