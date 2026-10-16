import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { checkRustAssets } from "./rust-assets.ts";
import { readRustApproval } from "./rust-input.parse-boundary.ts";
const root = resolve(import.meta.dirname, "../..");
const approval = readRustApproval(root);
const entries = approval.entries;
const firstEntry = entries[0];
const sourceEntry = entries.find((item) => item.sourceArchive);
if (!firstEntry || !sourceEntry?.sourceArchive) {
  throw new Error("Missing compliance fixture");
}
const notice = firstEntry.licenseFiles[0]?.path;
const source = sourceEntry.sourceArchive;
if (!notice) {
  throw new Error("Missing notice fixture");
}
function fixture(run: (path: string) => void) {
  const path = mkdtempSync(resolve(tmpdir(), "ove010-licenses-"));
  try {
    cpSync(resolve(root, "third-party"), resolve(path, "third-party"), { recursive: true });
    run(path);
  } finally {
    rmSync(path, { recursive: true, force: true });
  }
}
it("verifies every shipped notice and complete upstream MPL archive", () => {
  expect(() => {
    checkRustAssets(root, approval);
  }).not.toThrow();
  expect(entries.filter((item) => item.sourceArchive)).toHaveLength(5);
});
it("rejects missing/tampered notices, missing sources and extra files", () => {
  for (const change of [
    (path: string) => {
      writeFileSync(
        resolve(path, "third-party/rust/README.md"),
        "missing source availability notice",
      );
    },
    (path: string) => {
      rmSync(resolve(path, notice));
    },
    (path: string) => {
      writeFileSync(resolve(path, notice), "tampered");
    },
    (path: string) => {
      rmSync(resolve(path, source));
    },
    (path: string) => {
      writeFileSync(resolve(path, "third-party/rust/unapproved.txt"), "extra");
    },
  ]) {
    fixture((path) => {
      change(path);
      expect(() => {
        checkRustAssets(path, approval);
      }).toThrow();
    });
  }
});
it("rejects symlink notice files and symlink parent directories", () => {
  fixture((path) => {
    const original = resolve(path, notice);
    const bytes = readFileSync(original);
    rmSync(original);
    const other = resolve(path, "copied.txt");
    writeFileSync(other, bytes);
    symlinkSync(other, original);
    expect(() => {
      checkRustAssets(path, approval);
    }).toThrow(/symlink/u);
  });
  fixture((path) => {
    rmSync(resolve(path, "third-party/rust/licenses"), { recursive: true });
    symlinkSync(
      resolve(root, "third-party/rust/licenses"),
      resolve(path, "third-party/rust/licenses"),
    );
    expect(() => {
      checkRustAssets(path, approval);
    }).toThrow(/symlink/u);
  });
});
