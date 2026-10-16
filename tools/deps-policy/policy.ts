import { major, minor, satisfies, valid, validRange } from "semver";
import type { LicenseException } from "../check-licenses/input.parse-boundary.ts";
import { licenseAllowed } from "../check-licenses/policy.ts";
import type { RegisterEntry } from "./register.ts";

export interface Manifest {
  name: string;
  private: boolean;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
}
export interface PolicyInput {
  catalog: Record<string, string>;
  binaries: Record<string, string>;
  manifests: Manifest[];
  entries: ReadonlyMap<string, RegisterEntry>;
  matrix: ReadonlyMap<string, string>;
  verified: string;
  installed: { typescript: string; typescriptEslint: string; typescriptPeer: string };
  justifications: string[];
  tauriVersion?: string;
  allowedLicenses: ReadonlySet<string>;
  exceptions: readonly LicenseException[];
  today: string;
}
export interface Finding {
  rule: string;
  subject: string;
  message: string;
  level: "error" | "warning";
}
const pureLayers = new Set([
  "@overmind/contracts",
  "@overmind/domain",
  "@overmind/application",
  "@overmind/workflow-runtime",
]);
export function checkRules(input: PolicyInput): Finding[] {
  const findings: Finding[] = [];
  const fail = (rule: string, subject: string, message: string) => {
    findings.push({ rule, subject, message, level: "error" });
  };
  const internal = new Set(input.manifests.map((item) => item.name));
  const adopted = new Set(
    input.manifests.flatMap((item) =>
      Object.keys({
        ...item.dependencies,
        ...item.devDependencies,
        ...item.peerDependencies,
        ...item.optionalDependencies,
      }),
    ),
  );
  if (internal.size !== input.manifests.length) {
    fail("manifest", "workspace", "Duplicate package names");
  }
  for (const manifest of input.manifests) {
    if (
      !manifest.private ||
      (manifest.name !== "overmind" && !manifest.name.startsWith("@overmind/"))
    ) {
      fail(
        "confusion",
        manifest.name,
        "Workspace packages must be private and use the Overmind scope",
      );
    }
    for (const dependencies of [
      manifest.dependencies,
      manifest.devDependencies,
      manifest.peerDependencies,
      manifest.optionalDependencies,
    ]) {
      for (const [name, specifier] of Object.entries(dependencies)) {
        if (specifier.startsWith("workspace:")) {
          if (!internal.has(name)) {
            fail("specifier", name, "Workspace reference has no local package");
          }
          continue;
        }
        if (specifier !== "catalog:" || !Object.hasOwn(input.catalog, name)) {
          fail(
            "specifier",
            name,
            "External dependencies require the default catalog and an exact catalog pin",
          );
        }
        if (
          pureLayers.has(manifest.name) &&
          input.entries.get(name)?.fields["Pure layer"] !== "pure-layer-ok"
        ) {
          fail("pure-layer", name, "External dependency is not approved for pure layers");
        }
      }
    }
  }
  for (const [name, version] of [
    ...Object.entries(input.catalog),
    ...Object.entries(input.binaries),
  ]) {
    if (valid(version) !== version) {
      fail("pin", name, "Catalog version must be an exact semver");
    }
    const entry = input.entries.get(name);
    if (entry?.fields["Version"] !== version || input.matrix.get(name) !== version) {
      fail("register", name, "Catalog, matrix and register versions must agree");
    }
    if (
      !licenseAllowed(
        name,
        entry?.fields["License"],
        input.allowedLicenses,
        input.exceptions,
        input.today,
      )
    ) {
      if (adopted.has(name) || Object.hasOwn(input.binaries, name)) {
        fail(
          "license",
          name,
          "Adopted dependency license is outside the unchanged SETUP006 allow-list",
        );
      } else {
        findings.push({
          rule: "reserved-license",
          subject: name,
          message: "Uninstalled catalog reserve has a denied license; adoption remains blocked",
          level: "warning",
        });
      }
    }
  }
  const { installed } = input;
  if (
    installed.typescript !== input.catalog["typescript"] ||
    installed.typescriptEslint !== input.catalog["typescript-eslint"]
  ) {
    fail("typescript", "toolchain", "Installed TypeScript tooling must match catalog pins");
  }
  if (
    !validRange(installed.typescriptPeer) ||
    !satisfies(installed.typescript, installed.typescriptPeer)
  ) {
    fail(
      "typescript",
      "typescript",
      "Installed TypeScript is outside the installed typescript-eslint peer range",
    );
  }
  const groups = [
    ["vitest", "@vitest/coverage-v8"],
    ["react", "react-dom"],
    ["storybook", ...Object.keys(input.catalog).filter((name) => name.startsWith("@storybook/"))],
    ["playwright", "@playwright/test"],
    ["@commitlint/cli", "@commitlint/config-conventional"],
  ];
  for (const names of groups) {
    const versions = names
      .map((name) => input.catalog[name])
      .filter((version) => version !== undefined);
    if (new Set(versions).size > 1) {
      fail("group", names[0] ?? "group", "Coordinated package versions differ");
    }
  }
  if (input.tauriVersion) {
    const api = input.catalog["@tauri-apps/api"];
    if (
      !api ||
      !valid(api) ||
      !valid(input.tauriVersion) ||
      major(api) !== major(input.tauriVersion) ||
      minor(api) !== minor(input.tauriVersion)
    ) {
      fail("tauri", "@tauri-apps/api", "Tauri JavaScript and Rust must use the same major/minor");
    }
  }
  for (const key of input.justifications) {
    if (
      ![...input.entries.values()].some(
        (entry) => entry.fields["Justifies"] === key && (entry.fields["Value"]?.length ?? 0) >= 20,
      )
    ) {
      fail(
        "justification",
        key,
        "Dependency override, patch or allowed build requires a register justification block",
      );
    }
  }
  const age = Date.parse(input.today) - Date.parse(input.verified);
  if (age < 0 || !Number.isFinite(age)) {
    fail("date", "register", "Verification date is invalid or in the future");
  }
  if (age > 90 * 86400000) {
    findings.push({
      rule: "date",
      subject: "register",
      message: "Verification is older than 90 days",
      level: "warning",
    });
  }
  return findings;
}
