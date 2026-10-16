import { evaluateLicenseExpression } from "./expression.ts";
import type { RustApprovalEntry, RustPackage } from "./rust-input.parse-boundary.ts";
// Cargo historically accepted '/' between SPDX alternatives. This normalization
// is confined to known identifier-only Cargo expressions; npm parsing is unchanged.
function cargoExpression(value: string): string {
  return /^[A-Za-z0-9.-]+(?:\s*\/\s*[A-Za-z0-9.-]+)+$/u.test(value)
    ? value.replace(/\s*\/\s*/gu, " OR ")
    : value;
}
export function rustExclusions(entries: readonly RustApprovalEntry[]): string[] {
  return entries.map((item) => `pkg:cargo/${item.name}@${item.version}`).toSorted();
}
export function checkRustGraph(
  entries: readonly RustApprovalEntry[],
  packages: readonly RustPackage[],
  checksums: ReadonlyMap<string, string>,
  common: ReadonlySet<string>,
): void {
  const registry = packages.filter((item) => item.source !== null);
  const grants = new Map(entries.map((item) => [`${item.name}@${item.version}`, item]));
  for (const grant of entries) {
    const matches = registry.filter(
      (item) => item.name === grant.name && item.version === grant.version,
    );
    if (
      matches.length !== 1 ||
      matches[0]?.license !== grant.license ||
      checksums.get(`${grant.name}@${grant.version}`) !== grant.checksum
    ) {
      throw new Error(`Approved Rust identity/version/license/checksum changed: ${grant.name}`);
    }
  }
  for (const item of registry) {
    if (item.source !== "registry+https://github.com/rust-lang/crates.io-index" || !item.license) {
      throw new Error(`Rust package has unapproved source or missing license: ${item.name}`);
    }
    if (
      evaluateLicenseExpression(cargoExpression(item.license), (license) => common.has(license))
    ) {
      continue;
    }
    const grant = grants.get(`${item.name}@${item.version}`);
    if (
      grant?.license !== item.license ||
      checksums.get(`${item.name}@${item.version}`) !== grant.checksum
    ) {
      throw new Error(
        `Rust license requires a new exact-version approval: ${item.name}@${item.version}`,
      );
    }
  }
}
export function renderNativePolicy(entries: readonly RustApprovalEntry[]): string {
  const exceptions = entries
    .filter((item) => ["MPL-2.0", "Apache-2.0 WITH LLVM-exception"].includes(item.license))
    .map(
      (item) =>
        `[[licenses.exceptions]]\nname = "${item.name}"\nversion = "=${item.version}"\nallow = ["${item.license}"]\n`,
    )
    .join("\n");
  return `[advisories]
yanked = "deny"

[licenses]
confidence-threshold = 0.95
allow = [
  "Apache-2.0", "MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "0BSD",
  "BlueOak-1.0.0", "CC0-1.0", "Python-2.0", "Unlicense", "Unicode-3.0", "Zlib",
]

# Owner-approved exact-version exceptions (2026-10-16).
${exceptions}
[bans]
multiple-versions = "warn"
wildcards = "deny"

[sources]
unknown-registry = "deny"
unknown-git = "deny"
allow-registry = ["https://github.com/rust-lang/crates.io-index"]
allow-git = []
`;
}
