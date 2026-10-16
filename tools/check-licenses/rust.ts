import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readAllowlist } from "./input.parse-boundary.ts";
import {
  boundedFile,
  parseRegistryLock,
  parseRustMetadata,
  readRustApproval,
} from "./rust-input.parse-boundary.ts";
import { checkRustGraph, renderNativePolicy, rustExclusions } from "./rust-policy.ts";
import { checkRustAssets } from "./rust-assets.ts";
import { checkRustInventory } from "./rust-inventory.ts";
export function checkRustLicenses(root: string): string[] {
  checkRustInventory(root);
  const approval = readRustApproval(root);
  const entries = approval.entries;
  if (boundedFile(root, "deny.toml").toString("utf8") !== renderNativePolicy(entries)) {
    throw new Error("Native license/source/advisory policy drift");
  }
  const checksums = parseRegistryLock(
    boundedFile(root, "apps/desktop/src-tauri/Cargo.lock").toString("utf8"),
  );
  const metadata = execFileSync(
    "cargo",
    [
      "metadata",
      "--manifest-path",
      "apps/desktop/src-tauri/Cargo.toml",
      "--locked",
      "--format-version",
      "1",
    ],
    {
      cwd: root,
      encoding: "utf8",
      shell: false,
      timeout: 120000,
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  checkRustGraph(
    entries,
    parseRustMetadata(metadata),
    checksums,
    readAllowlist(resolve(root, "tools/check-licenses/allowlist.json")),
  );
  checkRustAssets(root, approval);
  return rustExclusions(entries);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(
    `Verified ${String(checkRustLicenses(process.cwd()).length)} exact Rust approvals and compliance artifacts`,
  );
}
