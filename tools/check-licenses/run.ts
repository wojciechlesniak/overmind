import { existsSync } from "node:fs";
import { checkRustLicenses } from "./rust.ts";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readAllowlist, readExceptions, parseLicenseReport } from "./input.parse-boundary.ts";
import { licenseAllowed } from "./policy.ts";

const allowed = readAllowlist(fileURLToPath(new URL("./allowlist.json", import.meta.url)));
const exceptions = readExceptions(fileURLToPath(new URL("./exceptions.json", import.meta.url)));
const today = new Date().toISOString().slice(0, 10);
let failed = false;
console.log("Scope\tPackage\tVersions\tLicense\tResult");
for (const scope of ["prod", "dev"]) {
  const report = parseLicenseReport(
    execFileSync("pnpm", ["licenses", "list", "--json", `--${scope}`], {
      encoding: "utf8",
      shell: false,
    }),
  );
  for (const entries of Object.values(report)) {
    for (const entry of entries) {
      const passed = licenseAllowed(entry.name, entry.license, allowed, exceptions, today);
      console.log(
        [
          scope,
          entry.name,
          entry.versions.join(","),
          entry.license ?? "MISSING",
          passed ? "allow" : "deny",
        ].join("\t"),
      );
      failed ||= !passed;
    }
  }
}
if (existsSync("apps/desktop/src-tauri/Cargo.toml")) {
  checkRustLicenses(process.cwd());
}
process.exitCode = failed ? 1 : 0;
