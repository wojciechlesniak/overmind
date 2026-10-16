import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import {
  parseRustApproval,
  parseRegistryLock,
  readRustApproval,
  type RustPackage,
} from "./rust-input.parse-boundary.ts";
import { checkRustGraph, renderNativePolicy, rustExclusions } from "./rust-policy.ts";
const root = resolve(import.meta.dirname, "../..");
const approval = readRustApproval(root);
const entries = approval.entries;
const checksums = new Map(entries.map((item) => [`${item.name}@${item.version}`, item.checksum]));
const packages: RustPackage[] = entries.map((item) => ({
  name: item.name,
  version: item.version,
  license: item.license,
  source: "registry+https://github.com/rust-lang/crates.io-index",
}));
const firstPackage = packages[0];
if (!firstPackage) {
  throw new Error("Missing approved fixture");
}
const common = new Set(["MIT", "Apache-2.0", "BSD-3-Clause"]);
it("approves only the actual 27 identities and emits versioned Cargo-only exclusions", () => {
  expect(() => {
    checkRustGraph(entries, packages, checksums, common);
  }).not.toThrow();
  expect(rustExclusions(entries)).toHaveLength(27);
  expect(
    rustExclusions(entries).every((item) => /^pkg:cargo\/[a-z0-9_-]+@\d+\.\d+\.\d+$/u.test(item)),
  ).toBe(true);
  expect(renderNativePolicy(entries)).toBe(readFileSync(resolve(root, "deny.toml"), "utf8"));
  expect(
    parseRegistryLock(readFileSync(resolve(root, "apps/desktop/src-tauri/Cargo.lock"), "utf8")).get(
      "cssparser@0.37.0",
    ),
  ).toBe(checksums.get("cssparser@0.37.0"));
});
it("rejects an upgrade, a new MPL/Unicode package, changed license, checksum or source", () => {
  for (const change of [
    { version: "99.0.0" },
    { license: "GPL-3.0-only" },
    { source: "git+https://example.invalid" },
    { license: null },
  ]) {
    expect(() => {
      checkRustGraph(
        entries,
        [{ ...firstPackage, ...change }, ...packages.slice(1)],
        checksums,
        common,
      );
    }).toThrow();
  }
  for (const license of ["MPL-2.0", "Unicode-3.0", "Zlib", "Apache-2.0 WITH LLVM-exception"]) {
    expect(() => {
      checkRustGraph(
        entries,
        [
          ...packages,
          { name: "unapproved", version: "1.0.0", license, source: firstPackage.source },
        ],
        checksums,
        common,
      );
    }).toThrow(/new exact-version/u);
  }
  const wrong = new Map(checksums);
  wrong.set("cssparser@0.37.0", "0".repeat(64));
  expect(() => {
    checkRustGraph(entries, packages, wrong, common);
  }).toThrow(/checksum/u);
  expect(() => {
    checkRustGraph(entries, packages.slice(1), checksums, common);
  }).toThrow();
});
it("retains SPDX alternative rules and confines legacy Cargo slash normalization", () => {
  for (const license of [
    "Apache-2.0 / MIT",
    "MIT/Apache-2.0",
    "BSD-3-Clause/MIT",
    "(Apache-2.0 OR MIT) AND BSD-3-Clause",
  ]) {
    expect(() => {
      checkRustGraph(
        [],
        [{ name: "safe", version: "1.0.0", license, source: firstPackage.source }],
        new Map(),
        common,
      );
    }).not.toThrow();
  }
  for (const license of ["MIT/Unknown", "MIT AND GPL-3.0-only", "MIT WITH unknown", "MISSING"]) {
    expect(() => {
      checkRustGraph(
        [],
        [{ name: "unsafe", version: "1.0.0", license, source: firstPackage.source }],
        new Map(),
        common,
      );
    }).toThrow();
  }
});
it("rejects malformed approvals and noncanonical Cargo registry records", () => {
  const raw = approval;
  expect(parseRustApproval(raw).entries).toHaveLength(27);
  expect(() =>
    parseRustApproval({ approvedOn: "2026-10-16", authority: "forged", entries }),
  ).toThrow();
  const lock =
    'version = 4\n\n[[package]]\nname = "fake"\nversion = "1.0.0"\nsource = "git+https://example.invalid"\n';
  expect(() => parseRegistryLock(lock)).toThrow();
});
