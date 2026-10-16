import { existsSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { valid } from "semver";
import { fileURLToPath } from "node:url";
import { readAllowlist, readExceptions } from "../check-licenses/input.parse-boundary.ts";
import { checkRules } from "./policy.ts";
import { parseRegister } from "./register.ts";
import {
  justificationKeys,
  parseTauriVersion,
  readBinaryPins,
  readCatalog,
  readInstalledToolchain,
  readManifests,
  readRenovateConfig,
  readWorkspaceText,
  workspaceFilePath,
} from "./input.parse-boundary.ts";

export function checkDependencies(root: string, today: string) {
  readRenovateConfig(root);
  const catalog = readCatalog(root);
  const manifests = readManifests(root, catalog.packages);
  const register = parseRegister(readWorkspaceText(root, "docs/dependencies.md"));
  const cargo = ["Cargo.toml", "apps/desktop/src-tauri/Cargo.toml"].filter((path) =>
    existsSync(resolve(root, path)),
  );
  const tauriVersions = cargo.map((path) => parseTauriVersion(readWorkspaceText(root, path)));
  if (new Set(tauriVersions).size > 1) {
    throw new Error("Tauri manifest pins disagree");
  }
  const findings = checkRules({
    catalog: catalog.catalog,
    binaries: readBinaryPins(root),
    manifests,
    ...register,
    installed: readInstalledToolchain(root),
    justifications: [
      ...justificationKeys(catalog, ""),
      ...manifests.flatMap((item) => (item.pnpm ? justificationKeys(item.pnpm, "pnpm.") : [])),
      ...Object.entries(catalog.allowBuilds)
        .filter(([, allowed]) => allowed)
        .map(([name]) => `allowBuilds.${name}`),
    ],
    ...(tauriVersions[0] ? { tauriVersion: tauriVersions[0] } : {}),
    allowedLicenses: readAllowlist(workspaceFilePath(root, "tools/check-licenses/allowlist.json")),
    exceptions: readExceptions(workspaceFilePath(root, "tools/check-licenses/exceptions.json")),
    today,
  });
  const registry = readWorkspaceText(root, ".npmrc");
  if (
    registry
      .split("\n")
      .some(
        (line) =>
          /^\s*(?:@[^:]+:)?registry\s*=/u.test(line) &&
          !/^\s*(?:@[^:]+:)?registry\s*=\s*https:\/\/registry\.npmjs\.org\/?\s*$/u.test(line),
      )
  ) {
    findings.push({
      rule: "registry",
      subject: ".npmrc",
      message: "Only the official npm registry is permitted",
      level: "error",
    });
  }
  return { findings, catalog: catalog.catalog };
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { findings, catalog } = checkDependencies(
    process.cwd(),
    new Date().toISOString().slice(0, 10),
  );
  console.log("Package\tCatalog pin\tRegister");
  for (const [name, version] of Object.entries(catalog).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(
      `${name}\t${valid(version) === version ? version : "INVALID"}\t${findings.some((item) => item.subject === name && item.level === "error") ? "FAIL" : "OK"}`,
    );
  }
  console.log("Level\tRule\tSubject\tResult");
  for (const item of findings) {
    console.log([item.level, item.rule, item.subject, item.message].join("\t"));
  }
  process.exitCode = findings.some((item) => item.level === "error") ? 1 : 0;
}
