import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";

const recordSchema = z.record(z.string(), z.unknown());
const strings = z.record(z.string(), z.string());
const manifestSchema = z.object({
  name: z.string(),
  version: z.string(),
  private: z.boolean(),
  type: z.string(),
  license: z.string(),
  exports: strings.optional(),
  sideEffects: z.boolean().optional(),
  main: z.string().optional(),
  dependencies: strings.optional(),
  devDependencies: strings.optional(),
  optionalDependencies: strings.optional(),
  scripts: strings.optional(),
  engines: strings.optional(),
  packageManager: z.string().optional(),
});
export function readJsonRecord(path: string): Record<string, unknown> {
  const data: unknown = JSON.parse(readFileSync(path, "utf8"));
  return recordSchema.parse(data);
}
export function readManifest(path: string) {
  const data: unknown = JSON.parse(readFileSync(path, "utf8"));
  return manifestSchema.parse(data);
}
export function readWorkspace(path: string) {
  const data: unknown = parse(readFileSync(path, "utf8"));
  return z
    .object({
      packages: z.array(z.string()),
      catalog: strings,
      allowBuilds: z.record(z.string(), z.boolean()),
      minimumReleaseAge: z.number(),
      strictDepBuilds: z.boolean(),
      engineStrict: z.boolean(),
      strictPeerDependencies: z.boolean(),
      autoInstallPeers: z.boolean(),
      savePrefix: z.string(),
      linkWorkspacePackages: z.boolean(),
      shamefullyHoist: z.boolean(),
      verifyDepsBeforeRun: z.string(),
    })
    .parse(data);
}
