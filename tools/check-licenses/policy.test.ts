import { expect, it } from "vitest";
import { licenseAllowed } from "./policy.ts";
import { parseLicenseReport } from "./input.parse-boundary.ts";
const allow = new Set(["MIT", "Apache-2.0", "ISC"]);
const check = (expression?: string) =>
  licenseAllowed("fixture", expression, allow, [], "2026-10-15");
it("fails closed on absent, invalid and denied SPDX expressions", () => {
  for (const license of [
    undefined,
    "",
    "unknown",
    "UNLICENSED",
    "GPL-3.0-only",
    "AGPL-3.0-only",
    "LGPL-2.1-only",
    "SSPL-1.0",
    "BUSL-1.1",
    "CC-BY-NC-4.0",
    "MIT AND GPL-3.0-only",
    "MIT WITH Classpath-exception-2.0",
    "GPL-2.0+",
    "MIT OR unknown",
    "MIT OR",
    "MIT AND",
    "MIT Apache-2.0",
    "(MIT OR ISC",
    "MIT) OR ISC",
    "MIT OR (ISC AND)",
    "mit",
    "MIT WITH unknown",
    "MIT OR MIT WITH",
    "MIT WITH OR ISC",
    "MIT WITH (Classpath-exception-2.0)",
    "MIT++ OR ISC",
    "MIT-0",
    "CC-BY-3.0",
    "CC-BY-4.0",
    "(".repeat(33) + "MIT" + ")".repeat(33),
    "MIT OR ".repeat(200) + "MIT",
    "MIT" + " ".repeat(8192),
  ]) {
    expect(check(license), license).toBe(false);
  }
});
it("evaluates alternatives, conjunctions and parentheses using SPDX grammar", () => {
  for (const license of [
    "MIT",
    "MIT OR GPL-3.0-only",
    "(MIT AND ISC) OR GPL-3.0-only",
    "Apache-2.0 AND MIT",
    "MIT OR LicenseRef-Proprietary",
    "MIT OR DocumentRef-vendor:LicenseRef-Proprietary",
    "GPL-3.0-only AND MIT OR ISC",
    "MIT OR MIT WITH Classpath-exception-2.0",
    "MIT OR GPL-2.0+",
  ]) {
    expect(check(license), license).toBe(true);
  }
});
it("MPL requires a package-specific, justified and unexpired exception", () => {
  const exception = {
    package: "fixture",
    license: "MPL-2.0" as const,
    justification: "Required build-only CSS transformer with MPL source obligations preserved",
    expires: "2027-01-15",
  };
  expect(licenseAllowed("fixture", "MPL-2.0", allow, [exception], "2026-10-15")).toBe(true);
  expect(licenseAllowed("other", "MPL-2.0", allow, [exception], "2026-10-15")).toBe(false);
  expect(licenseAllowed("fixture", "MPL-2.0", allow, [exception], "2027-01-16")).toBe(false);
  expect(check("MPL-2.0")).toBe(false);
});
it("rejects malformed pnpm report data rather than skipping packages", () => {
  expect(() => parseLicenseReport('{"MIT":[{"name":"fixture","versions":[]}]}')).toThrow();
  expect(
    parseLicenseReport(
      '{"GPL-3.0-only":[{"name":"fixture","versions":["1.0.0"],"license":"GPL-3.0-only"}]}',
    )["GPL-3.0-only"],
  ).toHaveLength(1);
});
