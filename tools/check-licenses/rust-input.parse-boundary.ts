import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
const hash = z.string().regex(/^[a-f0-9]{64}$/u);
const name = z.string().regex(/^[a-z][a-z0-9_-]*$/u);
const version = z.string().regex(/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.+-]+)?$/u);
const asset = z
  .object({
    path: z.string().min(1),
    sha256: hash,
    original: z.string().min(1),
    providedStandardText: z.literal(true).optional(),
  })
  .strict();
const entry = z
  .object({
    name,
    version,
    checksum: hash,
    license: z.enum([
      "MPL-2.0",
      "Zlib",
      "Unicode-3.0",
      "Apache-2.0 WITH LLVM-exception",
      "(MIT OR Apache-2.0) AND Unicode-3.0",
    ]),
    licenseFiles: z.array(asset).nonempty(),
    sourceArchive: z.string().optional(),
  })
  .strict();
const approval = z
  .object({
    approvedOn: z.literal("2026-10-16"),
    authority: z.literal(
      "Owner explicitly approved exceptions only for these 27 Rust dependencies in their current versions.",
    ),
    noticeSha256: hash,
    entries: z.array(entry).length(27),
  })
  .strict();
export type RustApprovalEntry = z.infer<typeof entry>;
export type RustApproval = z.infer<typeof approval>;
export function boundedFile(root: string, path: string): Buffer {
  if (
    !path ||
    path.split("/").some((part) => !part || part === "." || part === "..") ||
    !/^[A-Za-z0-9._/-]+$/u.test(path)
  ) {
    throw new Error("Unsafe Rust compliance path");
  }
  let current = root;
  for (const part of path.split("/")) {
    current = resolve(current, part);
    if (lstatSync(current).isSymbolicLink()) {
      throw new Error("Rust compliance symlink denied");
    }
  }
  const info = lstatSync(current);
  if (!info.isFile() || info.nlink !== 1 || info.size > 4 * 1024 * 1024) {
    throw new Error("Invalid Rust compliance file");
  }
  return readFileSync(current);
}
export function parseRustApproval(raw: unknown): RustApproval {
  const document = approval.parse(raw);
  const entries = document.entries;
  if (new Set(entries.map((item) => `${item.name}@${item.version}`)).size !== entries.length) {
    throw new Error("Duplicate Rust approval");
  }
  return document;
}
export function readRustApproval(root: string): RustApproval {
  const raw: unknown = JSON.parse(
    boundedFile(root, "tools/check-licenses/rust-approvals.json").toString("utf8"),
  );
  return parseRustApproval(raw);
}
const packageSchema = z.object({
  name,
  version,
  license: z.string().nullable(),
  source: z.string().nullable(),
});
export type RustPackage = z.infer<typeof packageSchema>;
export function parseRustMetadata(text: string): RustPackage[] {
  const raw: unknown = JSON.parse(text);
  return z.object({ packages: z.array(packageSchema).nonempty() }).parse(raw).packages;
}
export function parseRegistryLock(text: string): Map<string, string> {
  const records = new Map<string, string>();
  for (const stanza of text.split(/^\[\[package\]\]$/mu).slice(1)) {
    if (!/^source\s*=/mu.test(stanza)) {
      continue;
    }
    const match =
      /^\s*name = "([a-z][a-z0-9_-]*)"\nversion = "([A-Za-z0-9.+-]+)"\nsource = "registry\+https:\/\/github.com\/rust-lang\/crates.io-index"\nchecksum = "([a-f0-9]{64})"\n(?:dependencies = \[\n(?: "[A-Za-z0-9_. +-]+",\n)*\]\n)?\s*$/u.exec(
        stanza,
      );
    if (!match?.[1] || !match[2] || !match[3]) {
      throw new Error("Unsupported registry lockfile stanza");
    }
    const key = `${match[1]}@${match[2]}`;
    if (records.has(key)) {
      throw new Error("Duplicate registry lockfile identity");
    }
    records.set(key, match[3]);
  }
  return records;
}
