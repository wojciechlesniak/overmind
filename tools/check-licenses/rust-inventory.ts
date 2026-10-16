import { execFileSync } from "node:child_process";

// GitHub's exclusions apply repository-wide, so every Cargo graph must be covered.
// Adding another Rust project requires extending this gate before granting exclusions.
export function checkRustInventory(root: string): void {
  const allowed = new Set([
    "apps/desktop/src-tauri/Cargo.toml",
    "apps/desktop/src-tauri/Cargo.lock",
  ]);
  const files = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    {
      cwd: root,
      encoding: "utf8",
      shell: false,
      timeout: 10000,
      maxBuffer: 4 * 1024 * 1024,
    },
  ).split("\0");
  for (const path of files) {
    if (/(?:^|\/)Cargo\.(?:toml|lock)$/iu.test(path) && !allowed.has(path)) {
      throw new Error(`Cargo graph outside the exact-version license gate: ${path}`);
    }
  }
}
