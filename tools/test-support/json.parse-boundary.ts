import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";

const recordSchema = z.record(z.string(), z.unknown());
const strings = z.record(z.string(), z.string());
export function parseReactLintReport(text: string): string[] {
  const raw: unknown = JSON.parse(text);
  return z
    .object({
      number_of_files: z.number().int().positive(),
      diagnostics: z.array(
        z.object({ code: z.string().min(1), severity: z.enum(["warning", "error"]) }),
      ),
    })
    .parse(raw)
    .diagnostics.map((diagnostic) => diagnostic.code);
}
export function parseLintMessages(text: string): string[] {
  const raw: unknown = JSON.parse(text);
  return z
    .array(
      z.object({
        fatalErrorCount: z.literal(0),
        messages: z.array(
          z.object({
            ruleId: z.string().nullable(),
            message: z.string(),
            fatal: z.literal(false).optional(),
          }),
        ),
      }),
    )
    .min(1)
    .parse(raw)
    .flatMap((result) => result.messages.map((message) => message.ruleId ?? message.message));
}
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
