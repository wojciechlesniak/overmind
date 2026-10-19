// SPDX-License-Identifier: Apache-2.0
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
  type BigIntStats,
} from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { z } from "zod";

const SOURCE_LIMIT = 2 * 1024 * 1024;
const POLICY_LIMIT = 512 * 1024;
const identifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*)*$/u);
const repositoryPath = z
  .string()
  .min(1)
  .max(256)
  .refine(
    (path) =>
      !isAbsolute(path) &&
      !path.includes("\\") &&
      !/[\p{Cc}]/u.test(path) &&
      path.split("/").every((part) => part !== "" && part !== "." && part !== ".."),
  );
const boundedString = z
  .string()
  .min(1)
  .max(256)
  .refine((value) => !/[\p{Cc}]/u.test(value));
const strings = z.array(boundedString).max(512).readonly();
const references = z.array(identifier).max(512).readonly();
const packageSchema = z
  .object({
    id: identifier,
    path: repositoryPath,
    layer: z.number().int().min(-1).max(4),
    allowedImports: references,
    allowedSubpaths: z.record(identifier, z.array(repositoryPath).max(512).readonly()).readonly(),
    forbiddenBuiltins: strings,
    forbiddenGlobals: strings,
    forbiddenPackages: strings,
  })
  .strict()
  .readonly();
const catalogSchema = z
  .object({
    version: z.literal(1),
    packages: z.array(packageSchema).min(1).max(512).readonly(),
    testOnly: references,
    toolsMayImportAny: z.boolean(),
  })
  .strict()
  .superRefine((catalog, context) => {
    const ids = new Set(catalog.packages.map((entry) => entry.id));
    const paths = new Set(catalog.packages.map((entry) => entry.path));
    const referenced = [
      ...catalog.testOnly,
      ...catalog.packages.flatMap((entry) => [
        ...entry.allowedImports,
        ...Object.keys(entry.allowedSubpaths),
      ]),
    ];
    if (
      ids.size !== catalog.packages.length ||
      paths.size !== catalog.packages.length ||
      referenced.some((id) => !ids.has(id))
    ) {
      context.addIssue({ code: "custom", message: "Invalid catalogue identities or references." });
    }
  })
  .readonly();
export type BoundaryPackage = z.infer<typeof packageSchema>;
export type BoundaryCatalog = z.infer<typeof catalogSchema>;

function identity(info: BigIntStats): string {
  return [info.dev, info.ino, info.mode, info.nlink, info.size, info.mtimeNs, info.ctimeNs].join(
    ":",
  );
}
function admittedPath(root: string, path: string, limit: number): BigIntStats {
  const distance = relative(root, path);
  if (
    !distance ||
    isAbsolute(distance) ||
    distance === ".." ||
    distance.startsWith(`..${sep}`) ||
    realpathSync(root) !== root
  ) {
    throw new Error("Invalid repository source input.");
  }
  const base = lstatSync(root, { bigint: true });
  if (!base.isDirectory() || base.isSymbolicLink()) {
    throw new Error("Invalid repository source input.");
  }
  let current = root;
  const parts = distance.split(sep);
  for (const [index, part] of parts.entries()) {
    current = resolve(current, part);
    const info = lstatSync(current, { bigint: true });
    if (
      info.isSymbolicLink() ||
      info.dev !== base.dev ||
      (index < parts.length - 1 && !info.isDirectory())
    ) {
      throw new Error("Invalid repository source input.");
    }
  }
  const info = lstatSync(path, { bigint: true });
  if (
    !info.isFile() ||
    info.nlink !== 1n ||
    info.dev !== base.dev ||
    info.size > BigInt(limit) ||
    realpathSync(path) !== path
  ) {
    throw new Error("Invalid repository source input.");
  }
  return info;
}
function readInput(root: string, absolutePath: string, maxBytes: number) {
  if (
    !isAbsolute(absolutePath) ||
    absolutePath !== resolve(absolutePath) ||
    /[\p{Cc}]/u.test(absolutePath) ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1
  ) {
    throw new Error("Invalid repository source input.");
  }
  const canonicalRoot = realpathSync(root);
  const before = admittedPath(canonicalRoot, absolutePath, maxBytes);
  const expected = identity(before);
  const descriptor = openSync(
    absolutePath,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    if (!opened.isFile() || identity(opened) !== expected) {
      throw new Error("Invalid repository source input.");
    }
    const buffer = Buffer.alloc(Math.min(65_536, maxBytes + 1));
    const chunks: Buffer[] = [];
    let total = 0;
    for (;;) {
      const count = readSync(
        descriptor,
        buffer,
        0,
        Math.min(buffer.length, maxBytes + 1 - total),
        total,
      );
      if (!count) {
        break;
      }
      total += count;
      if (total > maxBytes) {
        throw new Error("Invalid repository source input.");
      }
      chunks.push(Buffer.from(buffer.subarray(0, count)));
    }
    if (
      BigInt(total) !== before.size ||
      identity(fstatSync(descriptor, { bigint: true })) !== expected ||
      identity(admittedPath(canonicalRoot, absolutePath, maxBytes)) !== expected
    ) {
      throw new Error("Invalid repository source input.");
    }
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      Buffer.concat(chunks, total),
    );
    return { text, identity: expected, root: canonicalRoot };
  } finally {
    closeSync(descriptor);
  }
}
export function readSource(root: string, absolutePath: string, maxBytes = SOURCE_LIMIT): string {
  try {
    return readInput(root, absolutePath, maxBytes).text;
  } catch {
    throw new Error("Invalid repository source input.");
  }
}
const cache = new Map<string, { identity: string; catalog: BoundaryCatalog }>();
export function loadCatalog(root: string): BoundaryCatalog {
  let canonicalRoot: string | undefined;
  try {
    canonicalRoot = realpathSync(root);
    const input = readInput(
      canonicalRoot,
      resolve(canonicalRoot, "docs/architecture/boundaries.json"),
      POLICY_LIMIT,
    );
    const previous = cache.get(canonicalRoot);
    if (previous?.identity === input.identity) {
      return previous.catalog;
    }
    cache.delete(canonicalRoot);
    const raw: unknown = JSON.parse(input.text);
    const parsed = catalogSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error("Invalid boundary policy.");
    }
    cache.set(canonicalRoot, { identity: input.identity, catalog: parsed.data });
    return parsed.data;
  } catch {
    if (canonicalRoot !== undefined) {
      cache.delete(canonicalRoot);
    }
    throw new Error("Invalid boundary policy.");
  }
}
