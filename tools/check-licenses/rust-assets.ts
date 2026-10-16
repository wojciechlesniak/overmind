import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { boundedFile, type RustApproval } from "./rust-input.parse-boundary.ts";
export function checkRustAssets(
  root: string,
  approval: Pick<RustApproval, "entries" | "noticeSha256">,
): void {
  const expected = new Set<string>();
  const verify = (path: string, hash: string) => {
    if (expected.has(path)) {
      throw new Error("Duplicate Rust compliance asset");
    }
    const bytes = boundedFile(root, path);
    if (createHash("sha256").update(bytes).digest("hex") !== hash) {
      throw new Error(`Rust compliance checksum mismatch: ${path}`);
    }
    expected.add(path);
  };
  verify("third-party/rust/README.md", approval.noticeSha256);
  for (const item of approval.entries) {
    for (const file of item.licenseFiles) {
      if (file.path !== `third-party/rust/licenses/${item.name}-${item.version}/${file.original}`) {
        throw new Error("Rust notice does not match the approved package");
      }
      verify(file.path, file.sha256);
    }
    if (item.license === "MPL-2.0") {
      if (item.sourceArchive !== `third-party/rust/sources/${item.name}-${item.version}.crate`) {
        throw new Error("MPL source archive missing");
      }
      verify(item.sourceArchive, item.checksum);
    } else if (item.sourceArchive) {
      throw new Error("Unexpected Rust source archive");
    }
  }
  const actual = new Set<string>();
  function walk(path: string): void {
    for (const entry of readdirSync(resolve(root, path), { withFileTypes: true })) {
      const name = `${path}/${entry.name}`;
      if (entry.isSymbolicLink()) {
        throw new Error("Rust compliance symlink denied");
      }
      if (entry.isDirectory()) {
        walk(name);
      } else {
        boundedFile(root, name);
        actual.add(name);
      }
    }
  }
  walk("third-party/rust");
  if (actual.size !== expected.size || [...actual].some((path) => !expected.has(path))) {
    throw new Error("Unexpected or absent Rust compliance assets");
  }
}
