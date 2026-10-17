import { z } from "zod";

export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const nodeLock = z
  .object({
    version: z.literal("22.23.3"),
    target: z.literal("darwin-arm64"),
    url: z.literal("https://nodejs.org/dist/v22.23.3/node-v22.23.3-darwin-arm64.tar.gz"),
    sha256: hashSchema,
    signerFingerprint: z.literal("5BE8A3F6C8A5C01D106C0AD820B1A390B168D356"),
  })
  .strict();
export type NodeLock = z.infer<typeof nodeLock>;
export function parseNodeLock(value: unknown, nvmrc: string): NodeLock {
  const lock = nodeLock.parse(value);
  if (nvmrc.trim() !== lock.version) {
    throw new Error("Node lock must equal .nvmrc");
  }
  return lock;
}
export function json(text: string): unknown {
  return JSON.parse(text);
}
export const versionSchema = z
  .object({
    version: z.string().regex(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/u),
    protocol: z.number().int().positive(),
    buildSha: z.string().regex(/^(?:dev|[a-f0-9]{7,40})$/u),
    node: z.literal("22.23.3"),
    platform: z.literal("darwin"),
    arch: z.literal("arm64"),
  })
  .strict();
export type EngineVersion = z.infer<typeof versionSchema>;
export const manifestSchema = z
  .object({
    schema: z.literal(1),
    name: z.literal("overmind-engine"),
    version: versionSchema.shape.version,
    protocol: versionSchema.shape.protocol,
    buildSha: versionSchema.shape.buildSha,
    target: z.literal("aarch64-apple-darwin"),
    node: z.literal("22.23.3"),
    sha256: hashSchema,
    sha256Unsigned: hashSchema,
    bundleSha256: hashSchema,
    inputHashes: z
      .object({
        nodeArchive: hashSchema,
        nodeLock: hashSchema,
        pnpmLock: hashSchema,
        entitlements: hashSchema,
        runtimeLicenseLedger: hashSchema,
      })
      .strict(),
    runtimeLicenseStatus: z.enum(["proposed", "approved"]),
    companions: z
      .array(
        z
          .object({
            path: z.enum(["engine/LICENSE", "engine/engine.cjs.map"]),
            sha256: hashSchema,
          })
          .strict(),
      )
      .length(2)
      .refine((items) => new Set(items.map((item) => item.path)).size === 2),
    toolVersions: z
      .object({
        esbuild: z.literal("0.28.2"),
        postject: z.literal("1.0.0-alpha.6"),
        node: z.literal("22.23.3"),
      })
      .strict(),
    createdBy: z.literal("OVE_SETUP017"),
  })
  .strict();
export type Manifest = z.infer<typeof manifestSchema>;
export function packageVersion(text: string): string {
  return z.object({ version: z.string() }).parse(json(text)).version;
}
export function metafileInputs(text: string): string[] {
  return Object.keys(
    z.object({ inputs: z.record(z.string(), z.unknown()) }).parse(json(text)).inputs,
  );
}
export const sourceMapSchema = z
  .object({
    version: z.literal(3),
    file: z.string().optional(),
    sources: z.array(
      z.string().regex(/^file:\/\/\/overmind\/source\/(?!.*(?:\.\.|%|[?#]))[A-Za-z0-9_./@-]+$/u),
    ),
    sourcesContent: z.array(z.string().nullable()),
    names: z.array(z.string()),
    mappings: z.string(),
    sourceRoot: z.literal(""),
  })
  .strict();
