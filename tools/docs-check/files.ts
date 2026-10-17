import { constants, type Stats } from "node:fs";
import { lstat, open, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

export const MAX_DOCUMENT_BYTES = 1_048_576;
export interface ReadableFile {
  stat: () => Promise<Stats>;
  read: (
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
  ) => Promise<{ bytesRead: number }>;
}

function validateOpened(info: Stats, expected?: Stats): void {
  if (
    !info.isFile() ||
    info.size > MAX_DOCUMENT_BYTES ||
    (expected &&
      (info.dev !== expected.dev ||
        info.ino !== expected.ino ||
        info.size !== expected.size ||
        info.mtimeMs !== expected.mtimeMs))
  ) {
    throw new Error("Unsupported or changed repository file.");
  }
}

export async function readBoundedFile(handle: ReadableFile, expected?: Stats): Promise<string> {
  const before = await handle.stat();
  validateOpened(before, expected);
  const buffer = Buffer.alloc(65_536);
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { bytesRead } = await handle.read(
      buffer,
      0,
      Math.min(buffer.length, MAX_DOCUMENT_BYTES + 1 - total),
      total,
    );
    if (!bytesRead) {
      break;
    }
    total += bytesRead;
    if (total > MAX_DOCUMENT_BYTES) {
      throw new Error("Repository file exceeds the byte limit.");
    }
    chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
  }
  const after = await handle.stat();
  validateOpened(after, before);
  if (total !== before.size || after.ctimeMs !== before.ctimeMs) {
    throw new Error("Repository file changed while reading.");
  }
  return Buffer.concat(chunks, total).toString("utf8");
}

export async function canonicalTarget(
  root: string,
  file: string,
  executable = false,
): Promise<string> {
  const base = await realpath(root);
  if (
    isAbsolute(file) ||
    file.includes("\\") ||
    file.split("/").some((part) => part === ".." || !part)
  ) {
    throw new Error("Invalid repository path.");
  }
  const target = resolve(base, file);
  if (executable) {
    let path = base;
    for (const part of file.split("/")) {
      path = resolve(path, part);
      if ((await lstat(path)).isSymbolicLink()) {
        throw new Error("Executable aliases are forbidden.");
      }
    }
  }
  const canonical = await realpath(target);
  const difference = relative(base, canonical);
  if (difference === ".." || difference.startsWith(`..${sep}`) || isAbsolute(difference)) {
    throw new Error("Path escapes repository.");
  }
  const info = await stat(canonical);
  if (!info.isFile() || info.dev !== (await stat(base)).dev) {
    throw new Error("Unsupported repository file.");
  }
  return canonical;
}

export async function canonicalFile(
  root: string,
  file: string,
  executable = false,
): Promise<string> {
  const canonical = await canonicalTarget(root, file, executable);
  if ((await stat(canonical)).size > MAX_DOCUMENT_BYTES) {
    throw new Error("Repository document exceeds the byte limit.");
  }
  return canonical;
}

export async function readRepositoryFile(
  root: string,
  file: string,
  executable = false,
): Promise<string> {
  const canonical = await canonicalFile(root, file, executable);
  const expected = await lstat(canonical);
  const handle = await open(
    canonical,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const contents = await readBoundedFile(handle, expected);
    const after = await stat(await canonicalFile(root, file, executable));
    if (
      expected.dev !== after.dev ||
      expected.ino !== after.ino ||
      expected.size !== after.size ||
      expected.mtimeMs !== after.mtimeMs
    ) {
      throw new Error("Repository file changed while reading.");
    }
    return contents;
  } finally {
    await handle.close();
  }
}
