import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { parse } from "yaml";
import { valid } from "semver";
import { z } from "zod";
import { readBinaryLock } from "../pinned-bin/lock.parse-boundary.ts";
const packageName = z.string().regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u);
const specs = z.record(packageName, z.string().min(1).max(1024)).default({});
const policyMap = z.record(z.string().min(1).max(200), z.string().min(1).max(1024)).default({});
const adjustments = z
  .object({
    overrides: z
      .record(
        z.string().min(1).max(200),
        z
          .string()
          .refine((value) => valid(value) === value, "Overrides require exact registry versions"),
      )
      .default({}),
    patchedDependencies: policyMap,
    onlyBuiltDependencies: z.array(packageName).default([]),
  })
  .strict();
const manifest = z.object({
  name: packageName,
  private: z.boolean().default(false),
  dependencies: specs,
  devDependencies: specs,
  peerDependencies: specs,
  optionalDependencies: specs,
  pnpm: adjustments.optional(),
});
const workspace = adjustments
  .extend({
    packages: z
      .array(z.string().regex(/^(?:[a-z][a-z0-9-]*\/)*[a-z][a-z0-9-]*(?:\/\*)?$/u))
      .nonempty(),
    catalog: z.record(packageName, z.string().min(1).max(100)),
    allowBuilds: z.record(packageName, z.boolean()).default({}),
    minimumReleaseAge: z.literal(4320),
    strictDepBuilds: z.literal(true),
    strictPeerDependencies: z.literal(true),
    autoInstallPeers: z.literal(false),
    engineStrict: z.literal(true),
    savePrefix: z.literal(""),
    linkWorkspacePackages: z.literal(false),
    shamefullyHoist: z.literal(false),
    verifyDepsBeforeRun: z.literal("error"),
  })
  .strict();
function confinedPath(root: string, path: string): string {
  const resolved = realpathSync(resolve(root, path));
  const distance = relative(realpathSync(root), resolved);
  if (distance === ".." || distance.startsWith(`..${sep}`) || isAbsolute(distance)) {
    throw new Error("Dependency policy inputs must stay inside the workspace");
  }
  return resolved;
}
export function workspaceFilePath(root: string, path: string): string {
  const resolved = confinedPath(root, path);
  const file = lstatSync(resolved);
  if (!file.isFile() || file.size > 4 * 1024 * 1024) {
    throw new Error("Dependency policy inputs must be bounded regular files inside the workspace");
  }
  return resolved;
}
export function readWorkspaceText(root: string, path: string): string {
  return readFileSync(workspaceFilePath(root, path), "utf8");
}
function json(root: string, path: string): unknown {
  return JSON.parse(readWorkspaceText(root, path));
}
export function readCatalog(root: string) {
  const raw: unknown = parse(readWorkspaceText(root, "pnpm-workspace.yaml"));
  return workspace.parse(raw);
}
export function readManifests(root: string, patterns: string[]) {
  const paths = new Set(["package.json"]);
  for (const pattern of patterns) {
    if (!pattern.endsWith("/*")) {
      paths.add(`${pattern}/package.json`);
      continue;
    }
    const parent = pattern.slice(0, -2);
    const directory = resolve(root, parent);
    if (!existsSync(directory)) {
      continue;
    }
    for (const entry of readdirSync(confinedPath(root, parent), { withFileTypes: true })) {
      if (entry.isSymbolicLink()) {
        throw new Error("Workspace package directories cannot be symlinks");
      }
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const path = `${parent}/${entry.name}/package.json`;
        if (existsSync(resolve(root, path))) {
          paths.add(path);
        }
      }
    }
  }
  return [...paths].map((path) => manifest.parse(json(root, path)));
}
export function readRegistryPolicy(root: string): void {
  const lines = readWorkspaceText(root, ".npmrc").split("\n");
  for (const line of lines.map((item) => item.trim())) {
    if (!line || /^[#;]/u.test(line)) {
      continue;
    }
    if (
      line !== "engine-strict=true" &&
      !/^(?:@[a-z0-9._-]+:)?registry\s*=\s*https:\/\/registry\.npmjs\.org\/?$/u.test(line)
    ) {
      throw new Error("Unreviewed project npm configuration is forbidden");
    }
  }
  for (const path of [".pnpmfile.cjs", ".pnpmfile.mjs"]) {
    if (existsSync(resolve(root, path))) {
      throw new Error("Unreviewed pnpm hooks are forbidden");
    }
  }
}
export function readInstalledToolchain(root: string) {
  const typescript = z
    .object({ version: z.string() })
    .parse(json(root, "node_modules/typescript/package.json"));
  const eslint = z
    .object({ version: z.string(), peerDependencies: z.object({ typescript: z.string() }) })
    .parse(json(root, "node_modules/typescript-eslint/package.json"));
  return {
    typescript: typescript.version,
    typescriptEslint: eslint.version,
    typescriptPeer: eslint.peerDependencies.typescript,
  };
}
export function readBinaryPins(root: string) {
  return Object.fromEntries(
    [
      ...readBinaryLock(workspaceFilePath(root, "tools/pinned-bin/lock.json")),
      ...readBinaryLock(
        workspaceFilePath(root, "tools/secret-scan/gitleaks.lock.json"),
        "gitleaks",
      ),
      ...readBinaryLock(workspaceFilePath(root, "tools/secret-scan/syft.lock.json"), "syft"),
    ].map((entry) => [entry.name, entry.version]),
  );
}
export function justificationKeys(
  configuration: z.infer<typeof adjustments>,
  prefix: string,
): string[] {
  return [
    ...Object.keys(configuration.overrides).map((name) => `${prefix}overrides.${name}`),
    ...Object.keys(configuration.patchedDependencies).map(
      (name) => `${prefix}patchedDependencies.${name}`,
    ),
    ...configuration.onlyBuiltDependencies.map((name) => `${prefix}onlyBuiltDependencies.${name}`),
  ];
}
export function validatePatchPaths(root: string, configuration: z.infer<typeof adjustments>): void {
  for (const path of Object.values(configuration.patchedDependencies)) {
    if (isAbsolute(path) || path.split(/[\\/]/u).includes("..")) {
      throw new Error("Dependency patches must be reviewed workspace files");
    }
    let current = root;
    for (const part of path.split(/[\\/]/u)) {
      current = resolve(current, part);
      if (lstatSync(current).isSymbolicLink()) {
        throw new Error("Dependency patches cannot use symlinks");
      }
    }
    workspaceFilePath(root, path);
  }
}
export function parseTauriVersion(source: string): string | undefined {
  const sections = source.split(/^\[/mu);
  for (const section of sections) {
    if (!/^(?:workspace\.)?dependencies\]\s*$/mu.test(section.split("\n")[0] ?? "")) {
      continue;
    }
    const line = section.split("\n").find((item) => /^tauri\s*=/u.test(item));
    if (!line) {
      continue;
    }
    // Only these complete, registry-only TOML forms are supported. Requiring the
    // actual first version field avoids matching suffix keys or nested strings.
    const version =
      /^tauri\s*=\s*"=([0-9]+\.[0-9]+\.[0-9]+)"\s*(?:#.*)?$/u.exec(line) ??
      /^tauri\s*=\s*\{\s*version\s*=\s*"=([0-9]+\.[0-9]+\.[0-9]+)"(?:\s*,\s*(?:features\s*=\s*\[\s*(?:"[a-zA-Z0-9_/-]+"(?:\s*,\s*"[a-zA-Z0-9_/-]+")*)?\s*\]|default-features\s*=\s*(?:true|false)))*\s*\}\s*(?:#.*)?$/u.exec(
        line,
      );
    if (!version) {
      throw new Error("Tauri dependency requires a supported exact pin");
    }
    return version[1];
  }
  throw new Error("Cargo manifest has no supported pinned Tauri dependency");
}

export function readRenovateConfig(root: string) {
  const value = json(root, "renovate.json");
  const config = z
    .object({
      extends: z.tuple([
        z.literal("config:best-practices"),
        z.literal("helpers:pinGitHubActionDigestsToSemver"),
      ]),
      rangeStrategy: z.literal("pin"),
      minimumReleaseAge: z.literal("3 days"),
      automerge: z.literal(false),
      dependencyDashboard: z.literal(true),
      ignoreScripts: z.literal(true),
      prConcurrentLimit: z.literal(5),
      packageRules: z.array(
        z
          .object({
            groupName: z.string().optional(),
            matchPackageNames: z.array(z.string()).optional(),
            matchFileNames: z.array(z.string()).optional(),
            matchManagers: z.array(z.string()).optional(),
            allowedVersions: z.string().optional(),
            dependencyDashboardApproval: z.boolean().optional(),
          })
          .loose(),
      ),
      customManagers: z.array(
        z
          .object({
            customType: z.literal("regex"),
            managerFilePatterns: z.array(z.string()),
            matchStrings: z.array(z.string()),
            depNameTemplate: z.string(),
            datasourceTemplate: z.string(),
          })
          .loose(),
      ),
    })
    .parse(value);
  function rejectAutomaticExceptions(item: unknown): void {
    if (!item || typeof item !== "object") {
      return;
    }
    for (const [key, child] of Object.entries(item)) {
      if ((key === "automerge" || key === "platformAutomerge") && child !== false) {
        throw new Error("Renovate automatic merging is forbidden at every scope");
      }
      if (key === "ignoreScripts" && child !== true) {
        throw new Error("Renovate install scripts must remain disabled at every scope");
      }
      if (key === "minimumReleaseAge" && child !== "3 days") {
        throw new Error("Automatic release-age exceptions are not authorized");
      }
      rejectAutomaticExceptions(child);
    }
  }
  rejectAutomaticExceptions(value);
  return config;
}
